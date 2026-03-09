/**
 * Infrastructure Service: AutodocHttpClient
 *
 * Client HTTP para API Autodoc (autenticacao, crawl de projetos, descoberta).
 * Lazy init, rate limiting, crawl recursivo com otimizacao via subfolders/size.
 */

class AutodocHttpClient {
  #idToken;
  #accessToken;
  #refreshToken;
  #tokenExpiry;
  #email;
  #password;

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
      body: JSON.stringify({ email: this.#email, password: this.#password }),
    });

    if (!response.ok) {
      throw new Error(`Autodoc auth falhou: ${response.status} ${response.statusText}`);
    }

    // Extrair tokens dos cookies da resposta
    const cookies = response.headers.getSetCookie?.() || [];
    for (const cookie of cookies) {
      if (cookie.startsWith('idToken=')) {
        this.#idToken = cookie.split('=')[1].split(';')[0];
      } else if (cookie.startsWith('accessToken=')) {
        this.#accessToken = cookie.split('=')[1].split(';')[0];
      } else if (cookie.startsWith('refreshToken=')) {
        this.#refreshToken = cookie.split('=')[1].split(';')[0];
      }
    }

    // Se cookies nao vieram no header, tentar body
    if (!this.#idToken) {
      const body = await response.json().catch(() => null);
      if (body) {
        this.#idToken = body.idToken || body.IdToken;
        this.#accessToken = body.accessToken || body.AccessToken;
        this.#refreshToken = body.refreshToken || body.RefreshToken;
      }
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

    return response.json();
  }

  /**
   * Lista contas (customers) do usuario autenticado
   */
  async getCustomers() {
    await this.#ensureAuth();

    const url = `https://suite.autodoc.com.br/v2/users/email/${encodeURIComponent(this.#email)}/customers?filter[product]=projetos`;
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
    return this.#apiGet('status', customerId);
  }

  /**
   * Lista subitens de uma pasta (subFolders + documents)
   */
  async getFolderSubitems(customerId, folderId) {
    return this.#apiGet(`folders/${folderId}/subitems/light?filter[obsolete]=false`, customerId);
  }

  /**
   * Lista tamanhos das subpastas (para otimizar crawl pulando pastas vazias)
   */
  async getSubfoldersSize(customerId, folderId) {
    return this.#apiGet(`folders/${folderId}/subfolders/size`, customerId);
  }

  /**
   * Crawl recursivo de documentos de um projeto Autodoc.
   * Hierarquia: Project → Phase → Discipline → Format → Documents
   *
   * @param {string} customerId
   * @param {string} projectFolderId
   * @param {Map<string,string>} statusMap - mapa de status id → nome
   * @returns {Array<Object>} docs flat com contexto (phase, discipline, format)
   */
  async crawlProjectDocuments(customerId, projectFolderId, statusMap) {
    const documents = [];

    // Nivel 1: Fases do projeto
    const phases = await this.#crawlLevel(customerId, projectFolderId);

    for (const phase of phases.subFolders || []) {
      // Verificar se fase tem conteudo
      const phaseHasContent = await this.#folderHasContent(customerId, projectFolderId, phase.id);
      if (!phaseHasContent) continue;

      // Nivel 2: Disciplinas da fase
      const disciplines = await this.#crawlLevel(customerId, phase.id);

      for (const discipline of disciplines.subFolders || []) {
        const discHasContent = await this.#folderHasContent(customerId, phase.id, discipline.id);
        if (!discHasContent) continue;

        // Nivel 3: Formatos da disciplina
        const formats = await this.#crawlLevel(customerId, discipline.id);

        for (const format of formats.subFolders || []) {
          const fmtHasContent = await this.#folderHasContent(customerId, discipline.id, format.id);
          if (!fmtHasContent) continue;

          // Nivel 4: Documentos do formato
          const items = await this.#crawlLevel(customerId, format.id);

          for (const doc of items.documents || []) {
            documents.push({
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
              phaseName: phase.name,
              disciplineName: discipline.name,
              formatFolder: format.name,
            });
          }

          // Documentos diretos na disciplina tambem
          for (const doc of formats.documents || []) {
            documents.push({
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
              phaseName: phase.name,
              disciplineName: discipline.name,
              formatFolder: null,
            });
          }
        }

        // Documentos diretos na disciplina (sem subpasta de formato)
        for (const doc of disciplines.documents || []) {
          documents.push({
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
            phaseName: phase.name,
            disciplineName: discipline.name,
            formatFolder: null,
          });
        }
      }
    }

    return documents;
  }

  async #crawlLevel(customerId, folderId) {
    try {
      return await this.getFolderSubitems(customerId, folderId);
    } catch (err) {
      console.warn(`[AutodocHttpClient] Erro ao crawlar folder ${folderId}:`, err.message);
      return { subFolders: [], documents: [] };
    }
  }

  async #folderHasContent(customerId, parentFolderId, folderId) {
    try {
      const sizes = await this.getSubfoldersSize(customerId, parentFolderId);
      const folderSize = (sizes || []).find(s => String(s.id) === String(folderId));
      return folderSize ? (folderSize.hasContent || folderSize.amount > 0) : true; // default true se nao encontrar
    } catch {
      return true; // Em caso de erro, assume que tem conteudo
    }
  }

  /**
   * Descobre todos os projetos de todas as contas.
   * Retorna lista de projetos com metadata da conta.
   */
  async discoverAllProjects() {
    const customers = await this.getCustomers();
    const allProjects = [];

    for (const customer of (customers || [])) {
      const customerId = String(customer.id || customer.customerId);
      const customerName = customer.name || customer.customerName || customerId;

      try {
        // Root folder da conta - listar projetos (nivel PROJECT)
        const rootItems = await this.getFolderSubitems(customerId, 'root');
        const projectFolders = (rootItems.subFolders || []).filter(
          f => f.type === 'PROJECT' || !f.type // Se nao tem type, assume que e projeto
        );

        for (const project of projectFolders) {
          allProjects.push({
            customerId,
            customerName,
            projectFolderId: String(project.id),
            projectName: project.name,
          });
        }
      } catch (err) {
        console.warn(`[AutodocHttpClient] Erro ao descobrir projetos da conta ${customerName}:`, err.message);
      }

      // Rate limit entre contas
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return allProjects;
  }
}

export { AutodocHttpClient };
