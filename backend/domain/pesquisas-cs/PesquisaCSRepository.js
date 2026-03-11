/**
 * Interface: PesquisaCSRepository
 *
 * Define o contrato para persistência de Percepções CS.
 * A implementação concreta fica na camada de infraestrutura.
 */

class PesquisaCSRepository {
  /**
   * Salva uma nova percepção
   * @param {PercepcaoEquipe} percepcao
   * @returns {Promise<PercepcaoEquipe>}
   */
  async save(percepcao) {
    throw new Error('Método save deve ser implementado');
  }

  /**
   * Salva múltiplas percepções (upsert para import)
   * @param {Array<PercepcaoEquipe>} percepcoes
   * @returns {Promise<Array<PercepcaoEquipe>>}
   */
  async saveMany(percepcoes) {
    throw new Error('Método saveMany deve ser implementado');
  }

  /**
   * Busca percepções com filtros
   * @param {Object} filters
   * @param {number} filters.mes
   * @param {number} filters.ano
   * @param {string} filters.projetoCodigo
   * @param {string} filters.respondenteEmail
   * @returns {Promise<Array<PercepcaoEquipe>>}
   */
  async findAll(filters = {}) {
    throw new Error('Método findAll deve ser implementado');
  }

  /**
   * Busca por ID
   * @param {string} id - UUID
   * @returns {Promise<PercepcaoEquipe|null>}
   */
  async findById(id) {
    throw new Error('Método findById deve ser implementado');
  }

  /**
   * Busca projetos distintos que têm resposta num período
   * @param {number} mes
   * @param {number} ano
   * @returns {Promise<Array<string>>} - códigos de projeto
   */
  async findProjetosComResposta(mes, ano) {
    throw new Error('Método findProjetosComResposta deve ser implementado');
  }

  /**
   * Remove uma percepção por ID
   * @param {string} id - UUID
   * @returns {Promise<void>}
   */
  async delete(id) {
    throw new Error('Método delete deve ser implementado');
  }
}

export { PesquisaCSRepository };
