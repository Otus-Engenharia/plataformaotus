/**
 * Use Case: Buscar Relato por ID
 */

class GetRelato {
  #relatoRepository;

  constructor(relatoRepository) {
    this.#relatoRepository = relatoRepository;
  }

  async execute(id) {
    const relato = await this.#relatoRepository.findById(id);
    if (!relato) return null;

    const [tipos, prioridades] = await Promise.all([
      this.#relatoRepository.findAllTipos(),
      this.#relatoRepository.findAllPrioridades(),
    ]);

    const tipoMeta = tipos.find(t => t.slug === relato.tipo.value);
    const prioridadeMeta = prioridades.find(p => p.slug === relato.prioridade.value);
    const authorData = await this.#relatoRepository.getUserById(relato.authorId);

    return relato.toResponse(tipoMeta, prioridadeMeta, authorData);
  }
}

export { GetRelato };
