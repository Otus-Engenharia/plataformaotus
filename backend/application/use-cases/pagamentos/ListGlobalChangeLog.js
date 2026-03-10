class ListGlobalChangeLog {
  #repository;

  constructor(repository) {
    this.#repository = repository;
  }

  async execute({ since, excludeEmail, limit = 100, offset = 0 }) {
    const result = await this.#repository.findChangeLogGlobal({ since, excludeEmail, limit, offset });

    // Enrich entries with project_name
    const codes = [...new Set(
      result.entries.map(e => e.parcelas_pagamento?.project_code || e.project_code).filter(Boolean)
    )];
    const projectData = codes.length > 0
      ? await this.#repository.getProjectDataByProjectCodes(codes)
      : {};
    for (const entry of result.entries) {
      const code = entry.parcelas_pagamento?.project_code || entry.project_code;
      entry.project_name = projectData[code]?.project_name || '';
    }

    return result;
  }
}

export { ListGlobalChangeLog };
