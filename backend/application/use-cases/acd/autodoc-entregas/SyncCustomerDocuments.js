/**
 * Use Case: SyncCustomerDocuments
 * Sincroniza documentos de um customer Autodoc especifico.
 *
 * Otimizações:
 * - Batch classification: busca todos document_codes de uma vez (findByDocumentCodes)
 * - Paralelização de projetos NG (concorrência 2)
 * - Retry com backoff exponencial em crawls
 */

import { DocumentClassifier } from '../../../../domain/acd/autodoc-entregas/services/DocumentClassifier.js';
import { AutodocDocument } from '../../../../domain/acd/autodoc-entregas/entities/AutodocDocument.js';

class SyncCustomerDocuments {
  #repository;
  #autodocClient;

  constructor(repository, autodocClient) {
    this.#repository = repository;
    this.#autodocClient = autodocClient;
  }

  async execute({ customerId, mappings, onProjectProgress, projectConcurrency = 1 }) {
    let totalDocuments = 0;
    let newDocuments = 0;
    const projectResults = [];

    // Determinar se algum mapping desta conta usa API classica
    const anyClassic = mappings.some(m => m.use_classic_api === true);

    // Buscar status map da conta
    let statusMap = new Map();
    try {
      const statuses = await this.#autodocClient.getStatuses(customerId, { useClassicApi: anyClassic });
      for (const s of (statuses || [])) {
        statusMap.set(String(s.id), s.name);
      }
    } catch (err) {
      console.warn(`[SyncCustomerDocuments] Erro ao buscar status do customer ${customerId}:`, err.message);
    }

    // Processar projetos com concorrência controlada
    const limit = pLimit(projectConcurrency);
    let completedCount = 0;

    const tasks = mappings.map((mapping, idx) =>
      limit(async () => {
        const startMs = Date.now();
        const projectCode = mapping.portfolio_project_code;
        try {
          const result = await this.#syncOneProject({ customerId, mapping, statusMap, anyClassic });
          completedCount++;

          if (onProjectProgress) {
            await onProjectProgress({
              projectName: mapping.autodoc_project_name || projectCode,
              index: completedCount,
              total: mappings.length,
            });
          }

          projectResults.push({
            projectCode,
            status: 'success',
            totalDocuments: result.totalDocuments,
            newDocuments: result.newDocuments,
            durationMs: Date.now() - startMs,
          });

          return result;
        } catch (err) {
          completedCount++;

          if (onProjectProgress) {
            await onProjectProgress({
              projectName: mapping.autodoc_project_name || projectCode,
              index: completedCount,
              total: mappings.length,
            });
          }

          projectResults.push({
            projectCode,
            status: 'error',
            error: err.message,
            totalDocuments: 0,
            newDocuments: 0,
            durationMs: Date.now() - startMs,
          });

          // Re-throw para allSettled capturar como rejected
          throw err;
        }
      })
    );

    const results = await Promise.allSettled(tasks);

    for (const r of results) {
      if (r.status === 'fulfilled') {
        totalDocuments += r.value.totalDocuments;
        newDocuments += r.value.newDocuments;
      }
    }

    return { totalDocuments, newDocuments, projectResults };
  }

  async #syncOneProject({ customerId, mapping, statusMap, anyClassic }) {
    let projectDocs = 0;
    let projectNew = 0;

    // Crawl documentos do projeto com retry (timeout interno do AutodocHttpClient já faz soft abort e retorna parcial)
    const useClassicApi = mapping.use_classic_api === true;

    const crawlFn = () => this.#autodocClient.crawlProjectDocuments(
      customerId,
      mapping.autodoc_project_folder_id,
      statusMap,
      {
        useClassicApi,
        classicInstanceId: mapping.classic_instance_id || null,
        customerName: mapping.autodoc_customer_name || customerId,
      }
    );

    const rawDocs = await withRetry(
      () => crawlFn(),
      { retries: 2, baseDelay: 2000, label: `crawl ${mapping.portfolio_project_code}` }
    );

    projectDocs = rawDocs.length;

    // Buscar datas existentes para preservar autodoc_created_at de docs ja sincronizados
    const docIds = rawDocs.map(d => String(d.id));
    let existingDatesMap = new Map();
    try {
      existingDatesMap = await this.#repository.findExistingDatesByDocIds(docIds);
    } catch (err) {
      console.warn(`[SyncCustomerDocuments] Erro ao buscar datas existentes:`, err.message);
    }

    // Batch: buscar todos os document_codes de uma vez para classificação
    const codes = rawDocs.map(d => d.code).filter(Boolean);
    let existingByCode = new Map();
    if (codes.length > 0) {
      try {
        existingByCode = await this.#repository.findByDocumentCodes(codes);
      } catch (err) {
        console.warn(`[SyncCustomerDocuments] Erro ao buscar codes em batch, fallback individual:`, err.message);
      }
    }

    // Para cada documento, classificar e criar entidade
    const entities = [];
    for (const rawDoc of rawDocs) {
      let classificationResult = { classification: 'novo_arquivo' };
      if (rawDoc.code) {
        const existing = existingByCode.get(rawDoc.code) || [];
        classificationResult = DocumentClassifier.classify(rawDoc, existing);
      }

      // Preservar data existente: rawDoc.createdAt (API) > existente no DB > fallback now
      const existingDate = existingDatesMap.get(String(rawDoc.id));
      const resolvedDate = rawDoc.createdAt || existingDate || new Date().toISOString();

      const doc = AutodocDocument.create({
        autodocDocId: rawDoc.id,
        autodocCustomerId: customerId,
        projectCode: mapping.portfolio_project_code,
        documentName: rawDoc.name,
        documentCode: rawDoc.code,
        revision: rawDoc.revision,
        phaseName: rawDoc.phaseName,
        disciplineName: rawDoc.disciplineName,
        formatFolder: rawDoc.formatFolder,
        fileUrl: rawDoc.fileUrl,
        rawSize: rawDoc.rawSize,
        status: rawDoc.status,
        autodocStatusName: rawDoc.statusName,
        author: rawDoc.author,
        autodocCreatedAt: resolvedDate,
      });

      doc.classify(classificationResult.classification);
      if (classificationResult.previousRevision) {
        doc.setPreviousRevision(classificationResult.previousRevision);
      }
      if (classificationResult.previousPhase) {
        doc.setPreviousPhase(classificationResult.previousPhase);
      }

      entities.push(doc);
    }

    // Bulk upsert
    if (entities.length > 0) {
      await this.#repository.upsertDocuments(entities);
      projectNew = entities.filter(e => e.classification === 'novo_arquivo').length;
    }

    console.log(`[SyncCustomerDocuments] Projeto ${mapping.portfolio_project_code}: ${rawDocs.length} docs`);

    // Rate limit entre projetos
    await new Promise(resolve => setTimeout(resolve, 300));

    return { totalDocuments: projectDocs, newDocuments: projectNew };
  }
}

// --- Utilitários inline (sem dependências externas) ---

/**
 * Limita concorrência de promises (substituto leve de p-limit).
 */
function pLimit(concurrency) {
  const queue = [];
  let active = 0;

  function next() {
    if (queue.length === 0 || active >= concurrency) return;
    active++;
    const { fn, resolve, reject } = queue.shift();
    fn().then(resolve, reject).finally(() => {
      active--;
      next();
    });
  }

  return function (fn) {
    return new Promise((resolve, reject) => {
      queue.push({ fn, resolve, reject });
      next();
    });
  };
}

/**
 * Retry com backoff exponencial.
 */
async function withRetry(fn, { retries = 2, baseDelay = 1000, label = '' } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.warn(`[retry] ${label} tentativa ${attempt + 1}/${retries + 1} falhou: ${err.message}. Retry em ${delay}ms`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

export { SyncCustomerDocuments };
