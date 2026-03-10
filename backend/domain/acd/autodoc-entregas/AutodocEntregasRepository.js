/**
 * Interface: AutodocEntregasRepository
 *
 * Contrato para persistencia de documentos e mapeamentos Autodoc.
 * A implementacao concreta fica na camada de infraestrutura.
 */

class AutodocEntregasRepository {
  // --- Documentos ---

  async findRecentDocuments(options = {}) {
    throw new Error('Metodo findRecentDocuments deve ser implementado');
  }

  async findByDocumentCode(documentCode) {
    throw new Error('Metodo findByDocumentCode deve ser implementado');
  }

  async upsertDocuments(documents) {
    throw new Error('Metodo upsertDocuments deve ser implementado');
  }

  async findExistingDatesByDocIds(docIds) {
    throw new Error('Metodo findExistingDatesByDocIds deve ser implementado');
  }

  // --- Mapeamentos ---

  async getProjectMappings(options = {}) {
    throw new Error('Metodo getProjectMappings deve ser implementado');
  }

  async upsertProjectMapping(mapping) {
    throw new Error('Metodo upsertProjectMapping deve ser implementado');
  }

  async deleteProjectMapping(id) {
    throw new Error('Metodo deleteProjectMapping deve ser implementado');
  }

  // --- Resumo ---

  async getSummary(options = {}) {
    throw new Error('Metodo getSummary deve ser implementado');
  }

  // --- Sync Runs ---

  async createSyncRun(customerId) {
    throw new Error('Metodo createSyncRun deve ser implementado');
  }

  async completeSyncRun(id, data) {
    throw new Error('Metodo completeSyncRun deve ser implementado');
  }
}

export { AutodocEntregasRepository };
