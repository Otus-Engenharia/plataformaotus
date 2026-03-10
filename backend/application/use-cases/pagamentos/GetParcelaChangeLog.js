class GetParcelaChangeLog {
  #repository;

  constructor(repository) {
    this.#repository = repository;
  }

  async execute({ projectCode, since, excludeEmail }) {
    if (!projectCode) throw new Error('projectCode e obrigatorio');
    return await this.#repository.findChangeLogByProject(projectCode, {
      since: since || null,
      excludeEmail: excludeEmail || null,
    });
  }
}

export { GetParcelaChangeLog };
