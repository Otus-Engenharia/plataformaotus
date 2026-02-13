/**
 * Use Case: CreateEstudoCusto
 *
 * Cria uma nova solicitacao de estudo de custos.
 */

import { EstudoCusto } from '../../../domain/estudos-custos/entities/EstudoCusto.js';

class CreateEstudoCusto {
  #repository;

  constructor(repository) {
    this.#repository = repository;
  }

  async execute({
    projeto,
    nomeTime,
    statusFase,
    construflowId,
    linkConstruflow,
    dataPrevistaApresentacao,
    descricao,
    authorId,
  }) {
    const estudoCusto = EstudoCusto.create({
      projeto,
      nomeTime,
      statusFase,
      construflowId,
      linkConstruflow,
      dataPrevistaApresentacao,
      descricao,
      authorId,
    });

    const saved = await this.#repository.save(estudoCusto);

    await this.#repository.saveComentario({
      estudoCustoId: saved.id,
      authorId,
      texto: 'Solicitacao criada',
      tipo: 'status_change',
      metadata: { to: 'pendente' },
    });

    const authorData = await this.#repository.getUserById(authorId);

    return saved.toResponse(authorData);
  }
}

export { CreateEstudoCusto };
