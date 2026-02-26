class AddFavoriteProject {
  #repository;

  constructor(repository) {
    this.#repository = repository;
  }

  async execute({ userId, projectId }) {
    if (!userId) throw new Error('Usuário não autenticado');
    if (!projectId) throw new Error('ID do projeto é obrigatório');
    return this.#repository.addFavoriteProject(userId, parseInt(projectId, 10));
  }
}

export { AddFavoriteProject };
