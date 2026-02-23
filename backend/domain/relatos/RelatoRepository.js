/**
 * Interface: RelatoRepository
 *
 * Define o contrato para persistência de Relatos.
 * A implementação concreta fica na camada de infraestrutura.
 */

class RelatoRepository {
  // --- Relatos ---

  async findByProjectCode(projectCode, options = {}) {
    throw new Error('Método findByProjectCode deve ser implementado');
  }

  async findById(id) {
    throw new Error('Método findById deve ser implementado');
  }

  async save(relato) {
    throw new Error('Método save deve ser implementado');
  }

  async update(relato) {
    throw new Error('Método update deve ser implementado');
  }

  async delete(id) {
    throw new Error('Método delete deve ser implementado');
  }

  async getStatsByProject(projectCode) {
    throw new Error('Método getStatsByProject deve ser implementado');
  }

  // --- Tipos (admin-configurável) ---

  async findAllTipos() {
    throw new Error('Método findAllTipos deve ser implementado');
  }

  async saveTipo(tipo) {
    throw new Error('Método saveTipo deve ser implementado');
  }

  async updateTipo(id, data) {
    throw new Error('Método updateTipo deve ser implementado');
  }

  // --- Prioridades (admin-configurável) ---

  async findAllPrioridades() {
    throw new Error('Método findAllPrioridades deve ser implementado');
  }

  async savePrioridade(prioridade) {
    throw new Error('Método savePrioridade deve ser implementado');
  }

  async updatePrioridade(id, data) {
    throw new Error('Método updatePrioridade deve ser implementado');
  }

  // --- Users ---

  async getUserById(userId) {
    throw new Error('Método getUserById deve ser implementado');
  }

  async getUsersByIds(userIds) {
    throw new Error('Método getUsersByIds deve ser implementado');
  }
}

export { RelatoRepository };
