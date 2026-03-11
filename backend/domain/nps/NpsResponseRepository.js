/**
 * Interface: NpsResponseRepository
 *
 * Define o contrato para persistência de respostas NPS.
 */

class NpsResponseRepository {
  async findAll(options = {}) {
    throw new Error('Método findAll deve ser implementado');
  }

  async findById(id) {
    throw new Error('Método findById deve ser implementado');
  }

  async findByProject(projectCode) {
    throw new Error('Método findByProject deve ser implementado');
  }

  async save(entity) {
    throw new Error('Método save deve ser implementado');
  }

  async saveBatch(entities) {
    throw new Error('Método saveBatch deve ser implementado');
  }

  async getStats(options = {}) {
    throw new Error('Método getStats deve ser implementado');
  }
}

export { NpsResponseRepository };
