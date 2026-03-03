class AddFavoriteProjectsBatch {
  #repository;

  constructor(repository) {
    this.#repository = repository;
  }

  async execute({ userId, projectIds }) {
    if (!userId) throw new Error('Usuário não autenticado');
    if (!Array.isArray(projectIds) || projectIds.length === 0) {
      throw new Error('Lista de projetos é obrigatória');
    }
    const ids = projectIds.map(id => parseInt(id, 10));
    return this.#repository.addFavoriteProjectsBatch(userId, ids);
  }
}

export { AddFavoriteProjectsBatch };
