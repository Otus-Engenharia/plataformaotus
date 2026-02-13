/**
 * Interface: ProjetoRepository
 * Contrato abstrato para persistência do domínio de Projetos
 */

class ProjetoRepository {
  /**
   * Salva um novo projeto em todas as tabelas relacionadas
   * @param {Project} project - Entidade Project
   * @returns {Promise<Object>} Dados do projeto criado
   */
  async saveProject(project) {
    throw new Error('Método saveProject deve ser implementado');
  }

  /**
   * Busca empresas do tipo 'client' para dropdown
   * @returns {Promise<Array>} Lista de clientes
   */
  async findClients() {
    throw new Error('Método findClients deve ser implementado');
  }

  /**
   * Busca contatos de uma empresa específica
   * @param {string} companyId - ID da empresa
   * @returns {Promise<Array>} Lista de contatos
   */
  async findContactsByCompany(companyId) {
    throw new Error('Método findContactsByCompany deve ser implementado');
  }

  /**
   * Busca serviços disponíveis para dropdown
   * @returns {Promise<Array>} Lista de serviços
   */
  async findServices() {
    throw new Error('Método findServices deve ser implementado');
  }

  /**
   * Busca o ID da disciplina "Cliente" em standard_disciplines
   * @returns {Promise<string|null>} ID da disciplina
   */
  async findClienteDisciplineId() {
    throw new Error('Método findClienteDisciplineId deve ser implementado');
  }

  /**
   * Cria uma nova empresa do tipo client
   * @param {Object} clientData - Dados do cliente
   * @returns {Promise<Object>} Empresa criada
   */
  async saveClient(clientData) {
    throw new Error('Método saveClient deve ser implementado');
  }

  /**
   * Cria um novo contato vinculado a uma empresa
   * @param {Object} contactData - Dados do contato
   * @returns {Promise<Object>} Contato criado
   */
  async saveContact(contactData) {
    throw new Error('Método saveContact deve ser implementado');
  }
}

export { ProjetoRepository };
