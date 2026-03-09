/**
 * Use Case: SyncCustomerDocuments
 * Sincroniza documentos de um customer Autodoc especifico.
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

  async execute({ customerId, mappings }) {
    let totalDocuments = 0;
    let newDocuments = 0;

    // Buscar status map da conta
    let statusMap = new Map();
    try {
      const statuses = await this.#autodocClient.getStatuses(customerId);
      for (const s of (statuses || [])) {
        statusMap.set(String(s.id), s.name);
      }
    } catch (err) {
      console.warn(`[SyncCustomerDocuments] Erro ao buscar status do customer ${customerId}:`, err.message);
    }

    for (const mapping of mappings) {
      try {
        // Crawl documentos do projeto
        const rawDocs = await this.#autodocClient.crawlProjectDocuments(
          customerId,
          mapping.autodoc_project_folder_id,
          statusMap
        );

        totalDocuments += rawDocs.length;

        // Para cada documento, classificar e criar entidade
        const entities = [];
        for (const rawDoc of rawDocs) {
          // Buscar existentes com mesmo code para classificacao
          let classificationResult = { classification: 'novo_arquivo' };
          if (rawDoc.code) {
            const existing = await this.#repository.findByDocumentCode(rawDoc.code);
            classificationResult = DocumentClassifier.classify(rawDoc, existing);
          }

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
            autodocCreatedAt: rawDoc.createdAt || new Date().toISOString(),
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
          newDocuments += entities.length;
        }

        console.log(`[SyncCustomerDocuments] Projeto ${mapping.portfolio_project_code}: ${rawDocs.length} docs`);
      } catch (err) {
        console.error(`[SyncCustomerDocuments] Erro no projeto ${mapping.portfolio_project_code}:`, err.message);
      }

      // Rate limit entre projetos
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return { totalDocuments, newDocuments };
  }
}

export { SyncCustomerDocuments };
