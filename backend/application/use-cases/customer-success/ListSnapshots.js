/**
 * Use Case: ListSnapshots
 *
 * Lista snapshots do portfólio com filtros opcionais.
 */

class ListSnapshots {
  #repository;

  constructor(repository) {
    this.#repository = repository;
  }

  async execute(filters = {}) {
    const snapshots = await this.#repository.findSnapshots(filters);
    return snapshots.map(s => s.toResponse());
  }
}

export { ListSnapshots };
