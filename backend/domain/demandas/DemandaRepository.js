/**
 * Interface: DemandaRepository
 *
 * Define o contrato para persistência de Demandas.
 * A implementação concreta fica na camada de infraestrutura.
 */

class DemandaRepository {
  async findAll(options = {}) {
    throw new Error('Método findAll deve ser implementado');
  }

  async findById(id) {
    throw new Error('Método findById deve ser implementado');
  }

  async findByAuthor(authorId) {
    throw new Error('Método findByAuthor deve ser implementado');
  }

  async findByStatus(status) {
    throw new Error('Método findByStatus deve ser implementado');
  }

  async save(demanda) {
    throw new Error('Método save deve ser implementado');
  }

  async update(demanda) {
    throw new Error('Método update deve ser implementado');
  }

  async delete(id) {
    throw new Error('Método delete deve ser implementado');
  }

  async getStats() {
    throw new Error('Método getStats deve ser implementado');
  }

  // --- Comentários ---

  async findComentarios(demandaId) {
    throw new Error('Método findComentarios deve ser implementado');
  }

  async saveComentario({ demandaId, authorId, texto, tipo, metadata }) {
    throw new Error('Método saveComentario deve ser implementado');
  }

  async deleteComentario(comentarioId) {
    throw new Error('Método deleteComentario deve ser implementado');
  }

  async deleteComentariosByDemandaId(demandaId) {
    throw new Error('Método deleteComentariosByDemandaId deve ser implementado');
  }

  // --- Usuários ---

  async getUserById(userId) {
    throw new Error('Método getUserById deve ser implementado');
  }

  async getUsersByIds(userIds) {
    throw new Error('Método getUsersByIds deve ser implementado');
  }
}

export { DemandaRepository };
