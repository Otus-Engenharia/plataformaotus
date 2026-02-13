/**
 * Interface: EstudoCustoRepository
 *
 * Define o contrato para persistencia de Estudos de Custos.
 * A implementacao concreta fica na camada de infraestrutura.
 */

class EstudoCustoRepository {
  async findAll(options = {}) {
    throw new Error('Metodo findAll deve ser implementado');
  }

  async findById(id) {
    throw new Error('Metodo findById deve ser implementado');
  }

  async findByAuthor(authorId) {
    throw new Error('Metodo findByAuthor deve ser implementado');
  }

  async findByStatus(status) {
    throw new Error('Metodo findByStatus deve ser implementado');
  }

  async save(estudoCusto) {
    throw new Error('Metodo save deve ser implementado');
  }

  async update(estudoCusto) {
    throw new Error('Metodo update deve ser implementado');
  }

  async delete(id) {
    throw new Error('Metodo delete deve ser implementado');
  }

  async getStats() {
    throw new Error('Metodo getStats deve ser implementado');
  }

  // --- Comentarios ---

  async findComentarios(estudoCustoId) {
    throw new Error('Metodo findComentarios deve ser implementado');
  }

  async saveComentario({ estudoCustoId, authorId, texto, tipo, metadata }) {
    throw new Error('Metodo saveComentario deve ser implementado');
  }

  async deleteComentario(comentarioId) {
    throw new Error('Metodo deleteComentario deve ser implementado');
  }

  async deleteComentariosByEstudoCustoId(estudoCustoId) {
    throw new Error('Metodo deleteComentariosByEstudoCustoId deve ser implementado');
  }

  // --- Usuarios ---

  async getUserById(userId) {
    throw new Error('Metodo getUserById deve ser implementado');
  }

  async getUsersByIds(userIds) {
    throw new Error('Metodo getUsersByIds deve ser implementado');
  }
}

export { EstudoCustoRepository };
