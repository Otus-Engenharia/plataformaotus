/**
 * Use Case: UpdateCatalogEstimate
 * Permite admin atualizar estimativa de minutos e ativar/desativar automações.
 */

class UpdateCatalogEstimate {
  #repository;

  constructor(repository) {
    this.#repository = repository;
  }

  /**
   * @param {Object} params
   * @param {string} params.id - ID da automação no catálogo
   * @param {number} [params.defaultMinutes] - Nova estimativa em minutos
   * @param {boolean} [params.isActive] - Ativar/desativar
   * @returns {Promise<Object>}
   */
  async execute({ id, defaultMinutes, isActive }) {
    const catalog = await this.#repository.findCatalogById(id);
    if (!catalog) {
      throw new Error(`Automação não encontrada: ${id}`);
    }

    const updates = {};
    if (defaultMinutes !== undefined) {
      if (defaultMinutes <= 0) {
        throw new Error('A estimativa de minutos deve ser maior que zero');
      }
      updates.default_minutes = defaultMinutes;
    }
    if (isActive !== undefined) {
      updates.is_active = isActive;
    }

    if (Object.keys(updates).length === 0) {
      return catalog;
    }

    return await this.#repository.updateCatalog(id, updates);
  }
}

export { UpdateCatalogEstimate };
