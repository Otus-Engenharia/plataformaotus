/**
 * Use Case: Atualizar Relato
 */

class UpdateRelato {
  #relatoRepository;

  constructor(relatoRepository) {
    this.#relatoRepository = relatoRepository;
  }

  async execute({ id, titulo, descricao, tipo, prioridade, isResolved, resolvedById }) {
    const relato = await this.#relatoRepository.findById(id);
    if (!relato) {
      throw new Error('Relato não encontrado');
    }

    // Buscar lookups uma vez para validação e resposta
    const [allTipos, allPrioridades] = await Promise.all([
      this.#relatoRepository.findAllTipos(),
      this.#relatoRepository.findAllPrioridades(),
    ]);

    if (titulo !== undefined || descricao !== undefined) {
      relato.updateContent(titulo, descricao);
    }

    if (tipo !== undefined) {
      if (!allTipos.find(t => t.slug === tipo)) {
        throw new Error(`Tipo inválido: "${tipo}"`);
      }
      relato.changeTipo(tipo);
    }

    if (prioridade !== undefined) {
      if (!allPrioridades.find(p => p.slug === prioridade)) {
        throw new Error(`Prioridade inválida: "${prioridade}"`);
      }
      relato.changePrioridade(prioridade);
    }

    if (isResolved === true) {
      relato.resolve(resolvedById);
    } else if (isResolved === false) {
      relato.reopen();
    }

    const updated = await this.#relatoRepository.update(relato);
    const authorData = await this.#relatoRepository.getUserById(updated.authorId);

    return updated.toResponse(
      allTipos.find(t => t.slug === updated.tipo.value),
      allPrioridades.find(p => p.slug === updated.prioridade.value),
      authorData
    );
  }
}

export { UpdateRelato };
