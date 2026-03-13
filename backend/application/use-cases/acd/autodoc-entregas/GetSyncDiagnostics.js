/**
 * Use Case: GetSyncDiagnostics
 * Retorna diagnostico completo do sync Autodoc: mappings, falhas, gaps.
 */

class GetSyncDiagnostics {
  #repository;

  constructor(repository) {
    this.#repository = repository;
  }

  async execute() {
    return this.#repository.getDiagnostics();
  }
}

export { GetSyncDiagnostics };
