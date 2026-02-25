/**
 * Interface do repositório de preferências do usuário
 * Contrato abstrato para a camada de infraestrutura
 */
class UserPreferencesRepository {
  async getFavoriteProjects(userId) {
    throw new Error('Método não implementado');
  }

  async addFavoriteProject(userId, projectId) {
    throw new Error('Método não implementado');
  }

  async addFavoriteProjectsByTeam(userId, teamId) {
    throw new Error('Método não implementado');
  }

  async removeFavoriteProject(userId, projectId) {
    throw new Error('Método não implementado');
  }

  async getAllProjects() {
    throw new Error('Método não implementado');
  }

  async getTeams() {
    throw new Error('Método não implementado');
  }
}

export { UserPreferencesRepository };
