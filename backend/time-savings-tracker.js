/**
 * Helper: trackTimeSaving
 *
 * Função fire-and-forget para registrar economia de tempo.
 * Segue o mesmo padrão de logAction() em server.js:
 * - Nunca lança exceção (catch + console.error)
 * - Verifica autenticação antes de registrar
 * - Busca estimativa do catálogo e grava como snapshot
 *
 * Uso:
 *   await trackTimeSaving(req, 'weekly_report_generation', {
 *     resourceType: 'project', resourceId: projectCode, resourceName: projectName
 *   });
 */

import { SupabaseTimeSavingsRepository } from './infrastructure/repositories/SupabaseTimeSavingsRepository.js';
import { RecordTimeSaving } from './application/use-cases/time-savings/RecordTimeSaving.js';

let repository = null;
let useCase = null;

function getUseCase() {
  if (!useCase) {
    repository = new SupabaseTimeSavingsRepository();
    useCase = new RecordTimeSaving(repository);
  }
  return useCase;
}

/**
 * Registra economia de tempo para uma automação.
 * Fire-and-forget: erros são logados mas nunca propagados.
 *
 * @param {Object} req - Express request (com req.user)
 * @param {string} catalogId - ID da automação no catálogo
 * @param {Object} [options]
 * @param {string} [options.resourceType] - Tipo do recurso
 * @param {string} [options.resourceId] - ID do recurso
 * @param {string} [options.resourceName] - Nome legível
 * @param {Object} [options.details] - Metadados extras
 */
export async function trackTimeSaving(req, catalogId, { resourceType, resourceId, resourceName, details } = {}) {
  if (!req.isAuthenticated?.() || !req.user) return;

  try {
    await getUseCase().execute({
      catalogId,
      userEmail: req.user.email,
      userName: req.user.name,
      resourceType,
      resourceId,
      resourceName,
      details,
    });
  } catch (error) {
    console.error('[TimeSavings] Erro ao registrar economia:', error.message);
  }
}
