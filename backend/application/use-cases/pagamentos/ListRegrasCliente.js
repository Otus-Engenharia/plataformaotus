class ListRegrasCliente {
  #repository;

  constructor(repository) {
    this.#repository = repository;
  }

  async execute() {
    const regras = await this.#repository.findAllRegras();
    return regras.map(r => r.toResponse());
  }
}

export { ListRegrasCliente };
