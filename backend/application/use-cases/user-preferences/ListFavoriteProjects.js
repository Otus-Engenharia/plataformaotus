class ListFavoriteProjects {
  #repository;

  constructor(repository) {
    this.#repository = repository;
  }

  async execute({ userId }) {
    if (!userId) throw new Error('Usuário não autenticado');
    return this.#repository.getFavoriteProjects(userId);
  }
}

export { ListFavoriteProjects };
