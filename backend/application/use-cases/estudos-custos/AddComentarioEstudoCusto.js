/**
 * Use Case: AddComentarioEstudoCusto
 *
 * Adiciona um comentario a uma solicitacao. Qualquer usuario autenticado pode comentar.
 */

class AddComentarioEstudoCusto {
  #repository;

  constructor(repository) {
    this.#repository = repository;
  }

  async execute({ estudoCustoId, authorId, texto }) {
    if (!texto || texto.trim().length === 0) {
      throw new Error('O texto do comentario e obrigatorio');
    }

    const estudo = await this.#repository.findById(estudoCustoId);

    if (!estudo) {
      throw new Error('Solicitacao nao encontrada');
    }

    const comentario = await this.#repository.saveComentario({
      estudoCustoId,
      authorId,
      texto: texto.trim(),
      tipo: 'comentario',
    });

    const authorData = await this.#repository.getUserById(authorId);

    return {
      ...comentario,
      author_name: authorData?.name || null,
      author_email: authorData?.email || null,
    };
  }
}

export { AddComentarioEstudoCusto };
