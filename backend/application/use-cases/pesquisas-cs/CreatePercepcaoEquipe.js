/**
 * Use Case: CreatePercepcaoEquipe
 * Cria uma nova percepção de equipe para um projeto/período.
 */

import { PercepcaoEquipe } from '../../../domain/pesquisas-cs/entities/PercepcaoEquipe.js';

class CreatePercepcaoEquipe {
  #repository;

  constructor(repository) {
    this.#repository = repository;
  }

  async execute({ projectCode, mes, ano, respondenteEmail, respondenteNome, cronograma, qualidade, comunicacao, custos, parceria, confianca, oportunidadeRevenda, comentarios }) {
    const percepcao = PercepcaoEquipe.create({
      projectCode,
      mes,
      ano,
      respondenteEmail,
      respondenteNome,
      cronograma,
      qualidade,
      comunicacao,
      custos,
      parceria,
      confianca,
      oportunidadeRevenda,
      comentarios,
    });

    const saved = await this.#repository.save(percepcao);
    return saved.toResponse();
  }
}

export { CreatePercepcaoEquipe };
