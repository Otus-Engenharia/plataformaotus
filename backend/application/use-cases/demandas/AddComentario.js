/**
 * Use Case: AddComentario
 *
 * Adiciona um comentário a uma demanda. Qualquer usuário autenticado pode comentar.
 */

class AddComentario {
  #demandaRepository;

  constructor(demandaRepository) {
    this.#demandaRepository = demandaRepository;
  }

  async execute({ demandaId, authorId, texto }) {
    if (!texto || texto.trim().length === 0) {
      throw new Error('O texto do comentário é obrigatório');
    }

    // Verifica se a demanda existe
    const demanda = await this.#demandaRepository.findById(demandaId);

    if (!demanda) {
      throw new Error('Demanda não encontrada');
    }

    const comentario = await this.#demandaRepository.saveComentario({
      demandaId,
      authorId,
      texto: texto.trim(),
      tipo: 'comentario',
    });

    // Enriquece com dados do autor
    const authorData = await this.#demandaRepository.getUserById(authorId);

    return {
      ...comentario,
      author_name: authorData?.name || null,
      author_email: authorData?.email || null,
    };
  }
}

export { AddComentario };
