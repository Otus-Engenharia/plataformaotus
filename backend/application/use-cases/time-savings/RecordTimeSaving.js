/**
 * Use Case: RecordTimeSaving
 * Registra um evento de economia de tempo quando uma automação é utilizada.
 *
 * Busca a estimativa atual do catálogo e grava como snapshot no evento,
 * garantindo integridade para auditoria (valores passados não mudam).
 */

import { TimeSavingsEvent } from '../../../domain/time-savings/entities/TimeSavingsEvent.js';

class RecordTimeSaving {
  #repository;

  constructor(repository) {
    this.#repository = repository;
  }

  /**
   * @param {Object} params
   * @param {string} params.catalogId - ID da automação no catálogo
   * @param {string} params.userEmail - Email do usuário
   * @param {string} params.userName - Nome do usuário
   * @param {string} [params.resourceType] - Tipo do recurso (ex: 'project')
   * @param {string} [params.resourceId] - ID do recurso
   * @param {string} [params.resourceName] - Nome legível do recurso
   * @param {Object} [params.details] - Metadados extras
   * @returns {Promise<TimeSavingsEvent|null>}
   */
  async execute({ catalogId, userEmail, userName, resourceType, resourceId, resourceName, details }) {
    // Busca a estimativa atual do catálogo
    const catalog = await this.#repository.findCatalogById(catalogId);

    if (!catalog) {
      console.warn(`[TimeSavings] Catalog não encontrado: "${catalogId}". Verifique tabela time_savings_catalog.`);
      return null;
    }
    if (!catalog.is_active) {
      console.warn(`[TimeSavings] Catalog inativo: "${catalogId}". Evento não registrado.`);
      return null;
    }

    // Cria o evento com snapshot dos minutos atuais
    const event = TimeSavingsEvent.create({
      catalogId,
      userEmail,
      userName,
      minutesSaved: catalog.default_minutes,
      resourceType,
      resourceId,
      resourceName,
      details,
    });

    return await this.#repository.saveEvent(event);
  }
}

export { RecordTimeSaving };
