/**
 * Infrastructure Service: AutodocHttpClient
 *
 * Client HTTP para API Autodoc (autenticacao, crawl de projetos, descoberta).
 * Lazy init, rate limiting, crawl recursivo com otimizacao via subfolders/size.
 *
 * Suporta dois modos:
 * - NG API (projetos-ng-bff.autodoc.com.br) para contas com produto "docs"
 * - Classic API (projetos3.autodoc.com.br) para contas legacy (4BIM/projetos)
 */

const CLASSIC_BASE = 'https://projetos3.autodoc.com.br';

const EMPTY_FOLDER_TTL = 24 * 60 * 60 * 1000; // 24h

class AutodocHttpClient {
  #idToken;
  #accessToken;
  #refreshToken;
  #tokenExpiry;
  #email;
  #password;
  /** Cache de pastas vazias: folderId → timestamp. Persiste entre syncs, TTL 24h. */
  #emptyFolderCache = new Map();

  constructor() {
    this.#email = process.env.AUTODOC_EMAIL;
    this.#password = process.env.AUTODOC_PASSWORD;
    this.#tokenExpiry = 0;
  }

  async #ensureAuth() {
    if (this.#idToken && Date.now() < this.#tokenExpiry - 60000) return;

    if (!this.#email || !this.#password) {
      throw new Error('AUTODOC_EMAIL e AUTODOC_PASSWORD devem estar configurados');
    }

    const response = await fetch('https://sso.autodoc.com.br/v1/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: this.#email, password: this.#password }),
    });

    if (!response.ok) {
      throw new Error(`Autodoc auth falhou: ${response.status} ${response.statusText}`);
    }

    // Extrair tokens do body da resposta (formato: { data: { accessToken, idToken, refreshToken } })
    const body = await response.json().catch(() => null);
    if (body?.data) {
      this.#idToken = body.data.idToken;
      this.#accessToken = body.data.accessToken;
      this.#refreshToken = body.data.refreshToken;
    } else if (body) {
      this.#idToken = body.idToken || body.IdToken;
      this.#accessToken = body.accessToken || body.AccessToken;
      this.#refreshToken = body.refreshToken || body.RefreshToken;
    }

    if (!this.#idToken) {
      throw new Error('Autodoc auth: nao foi possivel extrair idToken');
    }

    // Parsear expiracao do JWT
    try {
      const payload = JSON.parse(Buffer.from(this.#idToken.split('.')[1], 'base64').toString());
      this.#tokenExpiry = (payload.exp || 0) * 1000;
    } catch {
      // Fallback: 23h
      this.#tokenExpiry = Date.now() + 23 * 60 * 60 * 1000;
    }

    console.log('[AutodocHttpClient] Autenticado com sucesso');
  }

  async #apiGet(path, customerId) {
    await this.#ensureAuth();

    const url = `https://projetos-ng-bff.autodoc.com.br/v1/${path}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.#idToken}`,
        'x-customer-id': customerId,
        'x-product-value': 'projetos',
      },
    });

    if (!response.ok) {
      throw new Error(`Autodoc API ${path}: ${response.status} ${response.statusText}`);
    }

    // Rate limit: 200ms entre requests
    await new Promise(resolve => setTimeout(resolve, 200));

    // Handle 204 No Content
    if (response.status === 204) {
      return { subFolders: [], documents: [] };
    }

    const text = await response.text();
    if (!text) return { subFolders: [], documents: [] };

    try {
      return JSON.parse(text);
    } catch {
      return { subFolders: [], documents: [] };
    }
  }

  /**
   * Lista contas (customers) do usuario autenticado.
   * Sem filtro de produto para obter todas as 26 contas.
   */
  async getCustomers() {
    await this.#ensureAuth();

    const url = `https://suite.autodoc.com.br/v2/users/email/${encodeURIComponent(this.#email)}/customers`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.#idToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Autodoc getCustomers: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Lista status disponiveis de uma conta
   */
  async getStatuses(customerId) {
    const response = await this.#apiGet('status', customerId);
    // API pode retornar { data: [...] } ou array direto
    return response?.data || (Array.isArray(response) ? response : []);
  }

  /**
   * Lista subitens de uma pasta (subFolders + documents) — NG API
   */
  async getFolderSubitems(customerId, folderId) {
    const result = await this.#apiGet(`folders/${folderId}/subitems/light?filter[obsolete]=false`, customerId);

    // Normalizar campos
    if (!result.subFolders && result.folders) {
      result.subFolders = result.folders;
    }
    if (!result.subFolders && result.data?.subFolders) {
      result.subFolders = result.data.subFolders;
    }
    if (!result.subFolders && Array.isArray(result.data)) {
      result.subFolders = result.data;
    }
    if (!result.documents && result.data?.documents) {
      result.documents = result.data.documents;
    }

    return result;
  }

  /**
   * Lista tamanhos das subpastas (para otimizar crawl pulando pastas vazias)
   */
  async getSubfoldersSize(customerId, folderId) {
    return this.#apiGet(`folders/${folderId}/subfolders/size`, customerId);
  }

  /**
   * Crawl recursivo de documentos de um projeto Autodoc.
   * Despacha para NG API ou Classic API conforme options.useClassicApi.
   *
   * @param {string} customerId
   * @param {string} projectFolderId
   * @param {Map} statusMap
   * @param {object} options - { useClassicApi, classicInstanceId, customerName }
   */
  async crawlProjectDocuments(customerId, projectFolderId, statusMap, options = {}) {
    if (options.useClassicApi) {
      return this.#classicCrawlDocuments(
        customerId,
        options.customerName || customerId,
        options.classicInstanceId,
        projectFolderId,
      );
    }
    return this.#ngCrawlDocuments(customerId, projectFolderId, statusMap);
  }

  /**
   * Crawl recursivo de documentos via NG API.
   * Hierarquia: Project → Phase → Discipline → Format → Documents
   *
   * Otimizacoes:
   * - Busca subfolders/size 1x por pai (nao 1x por filho)
   * - Cache de pastas vazias com TTL 24h entre syncs
   */
  async #ngCrawlDocuments(customerId, projectFolderId, statusMap) {
    const documents = [];
    const NG_TIMEOUT_MS = 120_000; // 120s por projeto NG
    const startTime = Date.now();
    let aborted = false;

    const checkTimeout = () => {
      if (!aborted && Date.now() - startTime > NG_TIMEOUT_MS) {
        console.warn(`[AutodocHttpClient] NG crawl customer ${customerId}/folder ${projectFolderId}: timeout ${NG_TIMEOUT_MS}ms (${documents.length} docs coletados)`);
        aborted = true;
      }
      return aborted;
    };

    // Nivel 1: Fases do projeto
    const phases = await this.#crawlLevel(customerId, projectFolderId);
    const phaseNonEmpty = await this.#filterNonEmptyFolders(customerId, projectFolderId, phases.subFolders || []);

    for (const phase of phaseNonEmpty) {
      if (checkTimeout()) break;

      // Nivel 2: Disciplinas da fase
      const disciplines = await this.#crawlLevel(customerId, phase.id);
      const discNonEmpty = await this.#filterNonEmptyFolders(customerId, phase.id, disciplines.subFolders || []);

      for (const discipline of discNonEmpty) {
        if (checkTimeout()) break;

        // Nivel 3: Formatos da disciplina
        const formats = await this.#crawlLevel(customerId, discipline.id);
        const fmtNonEmpty = await this.#filterNonEmptyFolders(customerId, discipline.id, formats.subFolders || []);

        for (const format of fmtNonEmpty) {
          if (checkTimeout()) break;

          // Nivel 4: Documentos do formato
          const items = await this.#crawlLevel(customerId, format.id);

          for (const doc of items.documents || []) {
            documents.push(this.#normalizeNgDoc(doc, statusMap, phase.name, discipline.name, format.name));
          }

          // Documentos diretos na disciplina tambem
          for (const doc of formats.documents || []) {
            documents.push(this.#normalizeNgDoc(doc, statusMap, phase.name, discipline.name, null));
          }

          if ((items.documents || []).length === 0 && (items.subFolders || []).length === 0) {
            this.#markFolderEmpty(format.id);
          }
        }

        // Documentos diretos na disciplina (sem subpasta de formato)
        for (const doc of disciplines.documents || []) {
          documents.push(this.#normalizeNgDoc(doc, statusMap, phase.name, discipline.name, null));
        }
      }
    }

    if (aborted) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[AutodocHttpClient] NG crawl ${customerId}/${projectFolderId}: retornando ${documents.length} docs parciais em ${elapsed}s`);
    }

    return documents;
  }

  #normalizeNgDoc(doc, statusMap, phaseName, disciplineName, formatFolder) {
    return {
      id: String(doc.id),
      name: doc.name,
      code: doc.code || null,
      revision: doc.revision || null,
      fileUrl: doc.fileUrl || null,
      rawSize: doc.raw_size || doc.rawSize || null,
      status: doc.status ? String(doc.status) : null,
      statusName: doc.status && statusMap ? (statusMap.get(String(doc.status)) || null) : null,
      author: doc.author || null,
      createdAt: doc.created_at || doc.createdAt || null,
      phaseName,
      disciplineName,
      formatFolder,
    };
  }

  async #crawlLevel(customerId, folderId) {
    // Se pasta esta no cache de vazias, pular
    if (this.#isFolderCachedEmpty(folderId)) {
      return { subFolders: [], documents: [] };
    }
    try {
      return await this.getFolderSubitems(customerId, folderId);
    } catch (err) {
      console.warn(`[AutodocHttpClient] Erro ao crawlar folder ${folderId}:`, err.message);
      return { subFolders: [], documents: [] };
    }
  }

  /**
   * Busca sizes 1x por pai e filtra apenas filhos com conteudo.
   * Evita o bug anterior de chamar getSubfoldersSize N vezes para o mesmo pai.
   */
  async #filterNonEmptyFolders(customerId, parentFolderId, folders) {
    if (!folders.length) return [];

    // Primeiro: remover pastas que sabemos serem vazias (cache 24h)
    const candidates = folders.filter(f => !this.#isFolderCachedEmpty(f.id));
    if (!candidates.length) return [];

    // Buscar sizes do pai (1 request para todos os filhos)
    let sizeMap = new Map();
    try {
      const sizes = await this.getSubfoldersSize(customerId, parentFolderId);
      for (const s of (sizes || [])) {
        sizeMap.set(String(s.id), s.hasContent || s.amount > 0);
      }
    } catch {
      // Em caso de erro, assume que todos tem conteudo
      return candidates;
    }

    const nonEmpty = [];
    for (const folder of candidates) {
      const hasContent = sizeMap.get(String(folder.id));
      if (hasContent === false) {
        this.#markFolderEmpty(folder.id);
      } else {
        // true ou undefined (nao encontrado) — assume conteudo
        nonEmpty.push(folder);
      }
    }

    return nonEmpty;
  }

  #isFolderCachedEmpty(folderId) {
    const ts = this.#emptyFolderCache.get(String(folderId));
    if (!ts) return false;
    if (Date.now() - ts > EMPTY_FOLDER_TTL) {
      this.#emptyFolderCache.delete(String(folderId));
      return false;
    }
    return true;
  }

  #markFolderEmpty(folderId) {
    this.#emptyFolderCache.set(String(folderId), Date.now());
  }

  // ==========================================
  // Classic API (projetos3.autodoc.com.br)
  // ==========================================

  /**
   * Busca filhos de uma pasta no Classic via TreeView.
   * @returns {Array} array de { id, name, isParent, tipo }
   */
  async #classicGetChildren(session, folderId) {
    const { cookieStr } = session;
    const url = `${CLASSIC_BASE}/Diretorios/TreeViewDiretorios/?idDiretorio=${folderId}`;
    try {
      const resp = await fetch(url, {
        headers: { 'Cookie': cookieStr() },
      });
      if (resp.status !== 200) return [];
      const body = await resp.text();
      if (!body.startsWith('[')) return [];
      await new Promise(resolve => setTimeout(resolve, 200));
      return JSON.parse(body);
    } catch (err) {
      console.warn(`[AutodocHttpClient] Classic TreeView erro folder ${folderId}:`, err.message);
      return [];
    }
  }

  /**
   * Crawl recursivo de documentos via Classic API (projetos3.autodoc.com.br).
   *
   * A TreeView retorna { id, name, isParent, tipo }:
   *   tipo 0 = folder, 1 = project, 2 = discipline, 3 = linked, 4 = document
   *
   * Hierarquia tipica: Project → Fase (folder) → Disciplina (folder/tipo2) → Documento (tipo4)
   * Metadados limitados (sem code, revision, status) — suficiente para contagem de entregas.
   */
  async #classicCrawlDocuments(customerId, customerName, classicInstanceId, projectFolderId) {
    if (!classicInstanceId) {
      console.warn(`[AutodocHttpClient] Classic crawl: classicInstanceId ausente para ${customerName}`);
      return [];
    }

    const MAX_DEPTH = 10;
    const TIMEOUT_MS = 60_000; // 60s por projeto Classic
    const MAX_CONSECUTIVE_ERRORS = 3;
    const startTime = Date.now();
    let aborted = false;
    let consecutiveErrors = 0;

    // Nova sessao para cada crawl (evita corrupcao)
    const session = await this.#classicLogin(customerId, customerName);
    const projects = await this.#classicListProjects(session, classicInstanceId);
    if (!projects) {
      console.warn(`[AutodocHttpClient] Classic crawl: falha ao selecionar empresa ${classicInstanceId}`);
      return [];
    }

    const documents = [];

    // Crawl recursivo com rastreamento de fase/disciplina pela hierarquia
    const crawlFolder = async (folderId, depth, phaseName, disciplineName) => {
      if (aborted) return;
      if (depth > MAX_DEPTH) {
        console.warn(`[AutodocHttpClient] Classic crawl ${customerName}: maxDepth ${MAX_DEPTH} atingido em folder ${folderId}`);
        return;
      }
      if (Date.now() - startTime > TIMEOUT_MS) {
        if (!aborted) console.warn(`[AutodocHttpClient] Classic crawl ${customerName}: timeout ${TIMEOUT_MS}ms atingido (${documents.length} docs coletados)`);
        aborted = true;
        return;
      }

      const children = await this.#classicGetChildren(session, folderId);

      if (children.length === 0) {
        consecutiveErrors++;
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          console.warn(`[AutodocHttpClient] Classic crawl ${customerName}: ${MAX_CONSECUTIVE_ERRORS} erros consecutivos, abortando`);
          aborted = true;
          return;
        }
      } else {
        consecutiveErrors = 0;
      }

      for (const child of children) {
        if (aborted) return;

        if (child.tipo === 4) {
          // Documento encontrado
          documents.push({
            id: String(child.id),
            name: child.name || '',
            code: this.#extractDocCode(child.name),
            revision: this.#extractRevision(child.name),
            fileUrl: null,
            rawSize: null,
            status: null,
            statusName: null,
            author: null,
            createdAt: null,
            phaseName: phaseName || null,
            disciplineName: disciplineName || null,
            formatFolder: null,
          });
        } else if (child.isParent || child.tipo === 0 || child.tipo === 1 || child.tipo === 2) {
          // Pasta/projeto/disciplina — recursao
          let nextPhase = phaseName;
          let nextDisc = disciplineName;

          if (depth === 0) {
            // Primeiro nivel dentro do projeto = fase
            nextPhase = child.name;
            nextDisc = null;
          } else if (depth === 1) {
            // Segundo nivel = disciplina
            nextDisc = child.name;
          }
          // depth >= 2: manter fase/disciplina atuais

          await crawlFolder(child.id, depth + 1, nextPhase, nextDisc);
        }
        // tipo 3 (linked) — ignorar
      }
    };

    await crawlFolder(projectFolderId, 0, null, null);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[AutodocHttpClient] Classic crawl ${customerName}/${projectFolderId}: ${documents.length} documentos em ${elapsed}s${aborted ? ' (abortado)' : ''}`);
    return documents;
  }

  /**
   * Tenta extrair codigo do documento do nome do arquivo.
   * Ex: "ARQ-PB-001 R01.dwg" → "ARQ-PB-001"
   */
  #extractDocCode(name) {
    if (!name) return null;
    // Padrao: letras-letras-numeros (codigo tipico de documento de engenharia)
    const match = name.match(/^([A-Z]{2,5}[-_][A-Z]{1,5}[-_]\d{2,5})/i);
    return match ? match[1].toUpperCase() : null;
  }

  /**
   * Tenta extrair revisao do nome do arquivo.
   * Ex: "ARQ-PB-001 R01.dwg" → "R01", "DOC_Rev03.pdf" → "Rev03"
   */
  #extractRevision(name) {
    if (!name) return null;
    const match = name.match(/\b(R(?:ev)?\.?\s*\d{1,3})\b/i);
    return match ? match[1].replace(/\s/g, '') : null;
  }

  /**
   * Estabelece sessao no Classic Autodoc (projetos3.autodoc.com.br).
   * Retorna { cookieJar, instanceMap } onde instanceMap mapeia nome_conta → classicInstanceId.
   *
   * Flow:
   * 1. GET /LoginSuiteObras com tokens SSO nos cookies → 302 → /Login/ValidaUsuarioSuiteObras
   * 2. GET /Login/ValidaUsuarioSuiteObras → 200 (pagina de selecao de empresa com <select>)
   * 3. Parse options do <select> para obter classicInstanceId de cada conta
   */
  async #classicLogin(customerId, customerName) {
    await this.#ensureAuth();

    const cookies = new Map();
    cookies.set('accessToken', this.#accessToken);
    cookies.set('idToken', this.#idToken);
    cookies.set('refreshToken', this.#refreshToken);
    cookies.set('customer_id', customerId);
    cookies.set('customer_name', encodeURIComponent(customerName));
    cookies.set('last_login', encodeURIComponent(JSON.stringify({ customer_id: customerId, is_nextgen: false })));

    const cookieStr = () => [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');

    const addCookies = (resp) => {
      for (const sc of resp.headers.getSetCookie?.() || []) {
        const part = sc.split(';')[0];
        const eqIdx = part.indexOf('=');
        if (eqIdx > 0) cookies.set(part.substring(0, eqIdx), part.substring(eqIdx + 1));
      }
    };

    // Step 1: GET /LoginSuiteObras
    let resp = await fetch(`${CLASSIC_BASE}/LoginSuiteObras`, {
      headers: { 'Cookie': cookieStr() },
      redirect: 'manual',
    });
    addCookies(resp);

    if (resp.status !== 302) {
      throw new Error(`Classic LoginSuiteObras: esperava 302, recebeu ${resp.status}`);
    }

    // Step 2: GET /Login/ValidaUsuarioSuiteObras
    const redirectUrl = resp.headers.get('location');
    resp = await fetch(`${CLASSIC_BASE}${redirectUrl}`, {
      headers: { 'Cookie': cookieStr() },
      redirect: 'manual',
    });
    addCookies(resp);

    if (resp.status !== 200) {
      throw new Error(`Classic ValidaUsuarioSuiteObras: esperava 200, recebeu ${resp.status}`);
    }

    const html = await resp.text();

    // Parse company options: <option value="928943">CFL INCORPORADORA</option>
    const instanceMap = new Map();
    const optionRegex = /<option\s+value=['"](\d+)['"][^>]*>([^<]+)/gi;
    let m;
    while ((m = optionRegex.exec(html)) !== null) {
      const name = m[2].trim()
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n))
        .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&ccedil;/g, 'ç').replace(/&atilde;/g, 'ã').replace(/&otilde;/g, 'õ')
        .replace(/&eacute;/g, 'é').replace(/&iacute;/g, 'í').replace(/&aacute;/g, 'á')
        .replace(/&oacute;/g, 'ó').replace(/&uacute;/g, 'ú');
      instanceMap.set(name, m[1]);
    }

    return { cookies, cookieStr, addCookies, instanceMap };
  }

  /**
   * Seleciona uma empresa no Classic e lista seus projetos.
   * Retorna array de { id, name, tipo } ou null em caso de erro.
   */
  async #classicListProjects(session, classicInstanceId) {
    const { cookieStr, addCookies } = session;

    // POST /Home/Clientes para validar e selecionar a empresa
    let resp = await fetch(`${CLASSIC_BASE}/Home/Clientes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookieStr(),
      },
      body: `idEscolhaCliente=${classicInstanceId}`,
      redirect: 'manual',
    });
    addCookies(resp);

    const validation = (await resp.text()).trim();
    if (validation !== '1') return null;

    // GET /Home/Projetos para finalizar seleção
    resp = await fetch(`${CLASSIC_BASE}/Home/Projetos`, {
      headers: { 'Cookie': cookieStr() },
      redirect: 'manual',
    });
    addCookies(resp);

    // Seguir redirects até chegar no Diretorios
    let attempts = 0;
    while (resp.status >= 300 && resp.status < 400 && attempts < 5) {
      attempts++;
      const loc = resp.headers.get('location');
      const fullUrl = loc.startsWith('http') ? loc : `${CLASSIC_BASE}${loc}`;
      resp = await fetch(fullUrl, {
        headers: { 'Cookie': cookieStr() },
        redirect: 'manual',
      });
      addCookies(resp);
    }
    if (resp.status === 200) await resp.text();

    // GET TreeViewDiretorios para listar projetos
    resp = await fetch(`${CLASSIC_BASE}/Diretorios/TreeViewDiretorios/?isListaProjetos=true`, {
      headers: { 'Cookie': cookieStr() },
    });

    if (resp.status !== 200) return null;

    const body = await resp.text();
    if (!body.startsWith('[')) return null;

    await new Promise(resolve => setTimeout(resolve, 200));
    return JSON.parse(body);
  }

  /**
   * Descobre projetos de contas Classic-only via projetos3.autodoc.com.br.
   *
   * @param {Array} classicCustomers - contas sem produto 'docs'
   * @returns {{ projects: Array, diagnostics: Array }}
   */
  async #discoverClassicProjects(classicCustomers) {
    const projects = [];
    const diagnostics = [];

    if (classicCustomers.length === 0) return { projects, diagnostics };

    console.log(`[AutodocHttpClient] Classic: ${classicCustomers.length} contas para descobrir`);

    for (const customer of classicCustomers) {
      const customerId = String(customer.id || customer.customerId);
      const customerName = customer.name || customer.customerName || customerId;
      const allProductCodes = (customer.products || []).map(p => p.code || p.name || p.product);

      try {
        // Nova sessao para cada conta (evita corrupcao de sessao)
        const session = await this.#classicLogin(customerId, customerName);

        // Encontrar classicInstanceId pelo nome
        let classicId = session.instanceMap.get(customerName);
        if (!classicId) {
          // Busca fuzzy: o nome no select pode ter diferenças de encoding
          for (const [instName, instId] of session.instanceMap) {
            if (instName.toLowerCase() === customerName.toLowerCase() ||
                instName.includes(customerName) || customerName.includes(instName)) {
              classicId = instId;
              break;
            }
          }
        }

        if (!classicId) {
          console.log(`[AutodocHttpClient] Classic ${customerName}: instance ID não encontrado no select`);
          diagnostics.push({
            customerName, product: allProductCodes.join(', '), rootPath: null,
            status: 'classic-no-instance', projectCount: 0, api: 'classic',
            reason: 'Conta não encontrada no seletor de empresas do Classic.',
          });
          continue;
        }

        const classicProjects = await this.#classicListProjects(session, classicId);

        if (!classicProjects) {
          console.log(`[AutodocHttpClient] Classic ${customerName}: falha ao listar projetos`);
          diagnostics.push({
            customerName, product: allProductCodes.join(', '), rootPath: null,
            status: 'classic-error', projectCount: 0, api: 'classic',
            reason: 'Falha ao listar projetos via Classic API.',
          });
          continue;
        }

        console.log(`[AutodocHttpClient] Classic ${customerName}: ${classicProjects.length} projetos`);
        diagnostics.push({
          customerName, product: allProductCodes.join(', '), rootPath: null,
          status: classicProjects.length > 0 ? 'success' : 'empty',
          projectCount: classicProjects.length, api: 'classic',
        });

        for (const proj of classicProjects) {
          projects.push({
            customerId,
            customerName,
            projectFolderId: String(proj.id),
            projectName: proj.name,
            autodocProduct: allProductCodes.join(', '),
            useClassicApi: true,
            classicInstanceId: classicId,
          });
        }
      } catch (err) {
        console.warn(`[AutodocHttpClient] Classic ${customerName}: erro — ${err.message}`);
        diagnostics.push({
          customerName, product: allProductCodes.join(', '), rootPath: null,
          status: 'classic-error', projectCount: 0, api: 'classic',
          error: err.message,
        });
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return { projects, diagnostics };
  }

  /**
   * Descobre todos os projetos de todas as contas.
   * Usa NG API para contas com produto "docs" e Classic API para contas legado.
   */
  async discoverAllProjects() {
    const customersResponse = await this.getCustomers();
    const customers = customersResponse?.data || customersResponse || [];
    const allProjects = [];
    const diagnostics = [];
    const seenKeys = new Set();

    const customerList = Array.isArray(customers) ? customers : [];
    console.log(`[AutodocHttpClient] discoverAllProjects: ${customerList.length} contas para iterar`);

    // Separar contas NG (com produto 'docs') e Classic (sem 'docs')
    const ngCustomers = [];
    const classicCustomers = [];

    for (const customer of customerList) {
      const products = customer.products || [];
      const docsProduct = products.find(p => (p.code || p.name || p.product) === 'docs');
      if (docsProduct && (docsProduct.root_path || docsProduct.rootPath)) {
        ngCustomers.push({ customer, docsProduct });
      } else {
        classicCustomers.push(customer);
      }
    }

    console.log(`[AutodocHttpClient] NG: ${ngCustomers.length} contas, Classic: ${classicCustomers.length} contas`);

    // === NG API: contas com produto 'docs' ===
    for (const { customer, docsProduct } of ngCustomers) {
      const customerId = String(customer.id || customer.customerId);
      const customerName = customer.name || customer.customerName || customerId;
      const rootPath = docsProduct.root_path || docsProduct.rootPath;

      let rootItems = null;
      try {
        rootItems = await this.getFolderSubitems(customerId, rootPath);
      } catch (err) {
        console.warn(`[AutodocHttpClient] Erro ao listar projetos de ${customerName}: ${err.message}`);
        diagnostics.push({ customerName, product: 'docs', rootPath, status: 'error', projectCount: 0, api: 'ng', error: err.message });
        await new Promise(resolve => setTimeout(resolve, 300));
        continue;
      }

      const projectFolders = (rootItems?.subFolders || []).filter(
        f => f.type === 'PROJECT' || !f.type
      );

      console.log(`[AutodocHttpClient] Conta ${customerName} (docs) rootPath=${rootPath}: ${projectFolders.length} projetos encontrados`);
      diagnostics.push({ customerName, product: 'docs', rootPath, status: projectFolders.length > 0 ? 'success' : 'empty', projectCount: projectFolders.length, api: 'ng' });

      for (const project of projectFolders) {
        const key = `${customerId}::${project.id}`;
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);

        allProjects.push({
          customerId,
          customerName,
          projectFolderId: String(project.id),
          projectName: project.name,
          autodocProduct: 'docs',
          useClassicApi: false,
        });
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // === Classic API: contas sem produto 'docs' ===
    const { projects: classicProjects, diagnostics: classicDiagnostics } =
      await this.#discoverClassicProjects(classicCustomers);

    for (const proj of classicProjects) {
      const key = `${proj.customerId}::${proj.projectFolderId}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      allProjects.push(proj);
    }

    diagnostics.push(...classicDiagnostics);

    console.log(`[AutodocHttpClient] Total: ${allProjects.length} projetos (${allProjects.filter(p => !p.useClassicApi).length} NG + ${allProjects.filter(p => p.useClassicApi).length} Classic)`);

    return { projects: allProjects, diagnostics };
  }
}

export { AutodocHttpClient };
