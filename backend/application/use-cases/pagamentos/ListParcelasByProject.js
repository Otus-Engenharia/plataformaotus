class ListParcelasByProject {
  #repository;

  constructor(repository) {
    this.#repository = repository;
  }

  async execute({ projectCode }) {
    if (!projectCode) throw new Error('projectCode e obrigatorio');
    const parcelas = await this.#repository.findParcelasByProject(projectCode);
    return parcelas.map(p => p.toResponse());
  }
}

export { ListParcelasByProject };
