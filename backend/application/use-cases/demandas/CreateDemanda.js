/**
 * Use Case: CreateDemanda
 *
 * Cria uma nova demanda de serviço.
 */

import { Demanda } from '../../../domain/demandas/entities/Demanda.js';

class CreateDemanda {
  #demandaRepository;

  constructor(demandaRepository) {
    this.#demandaRepository = demandaRepository;
  }

  async execute({
    categoria,
    tipoServico,
    tipoServicoOutro,
    coordenadorProjeto,
    clienteProjeto,
    acessoCronograma,
    linkCronograma,
    acessoDrive,
    linkDrive,
    descricao,
    authorId,
  }) {
    const demanda = Demanda.create({
      categoria,
      tipoServico,
      tipoServicoOutro,
      coordenadorProjeto,
      clienteProjeto,
      acessoCronograma,
      linkCronograma,
      acessoDrive,
      linkDrive,
      descricao,
      authorId,
    });

    const savedDemanda = await this.#demandaRepository.save(demanda);

    // Cria comentário automático de criação
    await this.#demandaRepository.saveComentario({
      demandaId: savedDemanda.id,
      authorId,
      texto: 'Demanda criada',
      tipo: 'status_change',
      metadata: { to: 'pendente' },
    });

    const authorData = await this.#demandaRepository.getUserById(authorId);

    return savedDemanda.toResponse(authorData);
  }
}

export { CreateDemanda };
