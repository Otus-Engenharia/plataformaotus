/**
 * Use Case: UpdateBaseline
 * Atualiza metadados de uma baseline (nome, descrição, ativo).
 */

class UpdateBaseline {
  #baselineRepository;

  constructor(baselineRepository) {
    this.#baselineRepository = baselineRepository;
  }

  async execute({ id, name, description, isActive }) {
    if (!id) {
      throw new Error('ID da baseline é obrigatório');
    }

    const baseline = await this.#baselineRepository.findById(id);
    if (!baseline) {
      throw new Error(`Baseline ${id} não encontrada`);
    }

    if (name !== undefined || description !== undefined) {
      baseline.updateMetadata(name, description);
    }

    if (isActive !== undefined) {
      isActive ? baseline.activate() : baseline.deactivate();
    }

    const updated = await this.#baselineRepository.update(baseline);
    return updated.toResponse();
  }
}

export { UpdateBaseline };
