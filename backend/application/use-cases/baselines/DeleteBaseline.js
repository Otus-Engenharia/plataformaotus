/**
 * Use Case: DeleteBaseline
 * Remove uma baseline e seus snapshots de tarefas.
 */

class DeleteBaseline {
  #baselineRepository;

  constructor(baselineRepository) {
    this.#baselineRepository = baselineRepository;
  }

  async execute({ id }) {
    if (!id) {
      throw new Error('ID da baseline é obrigatório');
    }

    const baseline = await this.#baselineRepository.findById(id);
    if (!baseline) {
      throw new Error(`Baseline ${id} não encontrada`);
    }

    // Delete removes both Supabase metadata and BigQuery snapshots
    await this.#baselineRepository.delete(id);

    return { deleted: true, id, name: baseline.name };
  }
}

export { DeleteBaseline };
