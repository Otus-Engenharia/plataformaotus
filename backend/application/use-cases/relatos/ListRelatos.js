/**
 * Use Case: Listar Relatos por Projeto
 */

class ListRelatos {
  #relatoRepository;

  constructor(relatoRepository) {
    this.#relatoRepository = relatoRepository;
  }

  async execute({ projectCode, tipo = null, prioridade = null }) {
    const [relatos, tipos, prioridades] = await Promise.all([
      this.#relatoRepository.findByProjectCode(projectCode, { tipo, prioridade }),
      this.#relatoRepository.findAllTipos(),
      this.#relatoRepository.findAllPrioridades(),
    ]);

    const tiposMap = Object.fromEntries(tipos.map(t => [t.slug, t]));
    const prioridadesMap = Object.fromEntries(prioridades.map(p => [p.slug, p]));

    // Enriquecer com dados de autores
    const authorIds = [...new Set(relatos.map(r => r.authorId).filter(Boolean))];
    const usersMap = await this.#relatoRepository.getUsersByIds(authorIds);

    return relatos.map(relato => relato.toResponse(
      tiposMap[relato.tipo.value],
      prioridadesMap[relato.prioridade.value],
      usersMap.get(relato.authorId)
    ));
  }
}

export { ListRelatos };
