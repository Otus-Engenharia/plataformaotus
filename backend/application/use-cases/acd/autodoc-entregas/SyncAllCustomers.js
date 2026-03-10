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

  async execute({ batchId } = {}) {
    // Limpar runs órfãos (running > 30 min) antes de iniciar
    try {
      const timedOut = await this.#repository.timeoutStaleRuns(30);
      if (timedOut > 0) {
        console.log(`[SyncAllCustomers] ${timedOut} sync runs órfãos marcados como timeout`);
      }
    } catch (err) {
      console.warn(`[SyncAllCustomers] Erro ao limpar runs órfãos:`, err.message);
    }

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

    const CUSTOMER_TIMEOUT = 300_000; // 5 min por customer
    const results = [];

    for (const [customerId, customerMappings] of byCustomer) {
      const syncRun = await this.#repository.createSyncRun(customerId, batchId);
      const customerName = customerMappings[0]?.autodoc_customer_name || customerId;

      try {
        const syncUseCase = new SyncCustomerDocuments(this.#repository, this.#autodocClient);
        const result = await Promise.race([
          syncUseCase.execute({ customerId, mappings: customerMappings }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Customer sync timeout (${CUSTOMER_TIMEOUT / 1000}s) para ${customerName}`)), CUSTOMER_TIMEOUT)
          ),
        ]);

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
        const isTimeout = err.message.includes('timeout');
        await this.#repository.completeSyncRun(syncRun.id, {
          error: err.message,
          status: isTimeout ? 'timeout' : 'error',
        });

        console.warn(`[SyncAllCustomers] Customer ${customerName} ${isTimeout ? 'timeout' : 'erro'}:`, err.message);

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
