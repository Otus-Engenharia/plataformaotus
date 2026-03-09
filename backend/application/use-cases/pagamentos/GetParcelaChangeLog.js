class GetParcelaChangeLog {
  #repository;

  constructor(repository) {
    this.#repository = repository;
  }

  async execute({ projectCode }) {
    if (!projectCode) throw new Error('projectCode e obrigatorio');
    return await this.#repository.findChangeLogByProject(projectCode);
  }
}

export { GetParcelaChangeLog };
