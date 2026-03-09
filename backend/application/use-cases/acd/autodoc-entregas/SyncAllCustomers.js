/**
 * Use Case: SyncAllCustomers
 * Sincroniza documentos de todos os customers Autodoc com mapeamentos ativos.
 * Segue padrao ScanAllFolders.js do IFC changelog.
 */

import { SyncCustomerDocuments } from './SyncCustomerDocuments.js';

class SyncAllCustomers {
  #repository;
  #autodocClient;

  constructor(repository, autodocClient) {
    this.#repository = repository;
    this.#autodocClient = autodocClient;
  }

  async execute() {
    const mappings = await this.#repository.getProjectMappings({ activeOnly: true });

    if (mappings.length === 0) {
      return { totalCustomers: 0, totalDocuments: 0, newDocuments: 0, results: [] };
    }

    // Agrupar mappings por customer
    const byCustomer = new Map();
    for (const mapping of mappings) {
      const key = mapping.autodoc_customer_id;
      if (!byCustomer.has(key)) byCustomer.set(key, []);
      byCustomer.get(key).push(mapping);
    }

    const results = [];

    for (const [customerId, customerMappings] of byCustomer) {
      const syncRun = await this.#repository.createSyncRun(customerId);

      try {
        const syncUseCase = new SyncCustomerDocuments(this.#repository, this.#autodocClient);
        const result = await syncUseCase.execute({ customerId, mappings: customerMappings });

        await this.#repository.completeSyncRun(syncRun.id, {
          projectsScanned: customerMappings.length,
          documentsFound: result.totalDocuments,
          newDocuments: result.newDocuments,
        });

        results.push({
          customerId,
          success: true,
          projectsScanned: customerMappings.length,
          ...result,
        });
      } catch (err) {
        await this.#repository.completeSyncRun(syncRun.id, {
          error: err.message,
          status: 'error',
        });

        results.push({
          customerId,
          success: false,
          error: err.message,
        });
      }

      // Rate limit: 1s entre customers
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return {
      totalCustomers: byCustomer.size,
      totalDocuments: results.reduce((sum, r) => sum + (r.totalDocuments || 0), 0),
      newDocuments: results.reduce((sum, r) => sum + (r.newDocuments || 0), 0),
      results,
    };
  }
}

export { SyncAllCustomers };
