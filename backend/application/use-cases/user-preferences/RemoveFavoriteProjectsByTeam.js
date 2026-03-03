class RemoveFavoriteProjectsByTeam {
  #repository;

  constructor(repository) {
    this.#repository = repository;
  }

  async execute({ userId, teamId }) {
    if (!userId) throw new Error('Usuário não autenticado');
    if (!teamId) throw new Error('ID do time é obrigatório');
    return this.#repository.removeFavoriteProjectsByTeam(userId, parseInt(teamId, 10));
  }
}

export { RemoveFavoriteProjectsByTeam };
