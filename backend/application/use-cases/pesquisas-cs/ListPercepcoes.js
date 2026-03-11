/**
 * Use Case: ListPercepcoes
 * Lista percepções com filtros opcionais.
 */

class ListPercepcoes {
  #repository;

  constructor(repository) {
    this.#repository = repository;
  }

  async execute({ mes, ano, projetoCodigo, respondenteEmail } = {}) {
    const percepcoes = await this.#repository.findAll({
      mes: mes ? Number(mes) : undefined,
      ano: ano ? Number(ano) : undefined,
      projetoCodigo,
      respondenteEmail,
    });

    return percepcoes.map(p => p.toResponse());
  }
}

export { ListPercepcoes };
