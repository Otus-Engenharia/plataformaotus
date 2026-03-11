/**
 * Job: Geração automática de snapshots de Customer Success
 *
 * Exporta a função `runCSSnapshot` para ser chamada pelo cron em server.js.
 */

import { SupabaseCustomerSuccessRepository } from '../infrastructure/repositories/SupabaseCustomerSuccessRepository.js';
import { GenerateSnapshot } from '../application/use-cases/customer-success/index.js';
import { queryPortfolio } from '../bigquery.js';

export async function runCSSnapshot() {
  const repository = new SupabaseCustomerSuccessRepository();
  const useCase = new GenerateSnapshot(repository, { queryPortfolio });
  const result = await useCase.execute({});
  return result;
}
