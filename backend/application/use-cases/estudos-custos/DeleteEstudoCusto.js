/**
 * Use Case: DeleteEstudoCusto
 *
 * Deleta uma solicitacao e seus comentarios associados.
 */

class DeleteEstudoCusto {
  #repository;

  constructor(repository) {
    this.#repository = repository;
  }

  async execute({ id }) {
    const estudo = await this.#repository.findById(id);

    if (!estudo) {
      throw new Error('Solicitacao nao encontrada');
    }

    await this.#repository.deleteComentariosByEstudoCustoId(id);
    await this.#repository.delete(id);

    return { id, deleted: true };
  }
}

export { DeleteEstudoCusto };
