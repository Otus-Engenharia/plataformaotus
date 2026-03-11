/**
 * Interface: CustomerSuccessRepository
 *
 * Define o contrato para persistência do domínio de Customer Success.
 * A implementação concreta fica na camada de infraestrutura.
 */

class CustomerSuccessRepository {
  /**
   * Busca todas as classificações de clientes
   * @returns {Promise<Array<ClassificacaoCliente>>}
   */
  async findAllClassificacoes() {
    throw new Error('Método findAllClassificacoes deve ser implementado');
  }

  /**
   * Busca classificação por company_id
   * @param {number} companyId - ID da company
   * @returns {Promise<ClassificacaoCliente|null>}
   */
  async findClassificacaoByCompanyId(companyId) {
    throw new Error('Método findClassificacaoByCompanyId deve ser implementado');
  }

  /**
   * Busca todas as companies do tipo client
   * @returns {Promise<Array<{id: number, name: string}>>}
   */
  async findAllCompaniesClient() {
    throw new Error('Método findAllCompaniesClient deve ser implementado');
  }

  /**
   * Retorna mapa de project_code → { companyId, companyName } via Supabase projects
   * @returns {Promise<Map<string, {companyId: number, companyName: string}>>}
   */
  async findProjectCompanyMap() {
    throw new Error('Método findProjectCompanyMap deve ser implementado');
  }

  /**
   * Salva uma nova classificação
   * @param {ClassificacaoCliente} classificacao - Entidade ClassificacaoCliente
   * @returns {Promise<ClassificacaoCliente>}
   */
  async saveClassificacao(classificacao) {
    throw new Error('Método saveClassificacao deve ser implementado');
  }

  /**
   * Atualiza uma classificação existente
   * @param {ClassificacaoCliente} classificacao - Entidade ClassificacaoCliente
   * @returns {Promise<ClassificacaoCliente>}
   */
  async updateClassificacao(classificacao) {
    throw new Error('Método updateClassificacao deve ser implementado');
  }

  /**
   * Faz upsert em lote de classificações, conflitando por cliente
   * @param {Array<ClassificacaoCliente>} classificacoes - Entidades a sincronizar
   * @returns {Promise<number>} - Quantidade de registros afetados
   */
  async upsertClassificacoes(classificacoes) {
    throw new Error('Método upsertClassificacoes deve ser implementado');
  }

  /**
   * Busca snapshots com filtros opcionais
   * @param {Object} filters
   * @param {string} [filters.snapshotDate] - Data exata no formato YYYY-MM-DD
   * @param {number} [filters.month] - Mês (1-12)
   * @param {number} [filters.year] - Ano
   * @param {string} [filters.cliente] - Nome do cliente
   * @param {string} [filters.statusProjeto] - ATIVO/INATIVO/ENCERRADO
   * @returns {Promise<Array<PortfolioSnapshot>>}
   */
  async findSnapshots(filters) {
    throw new Error('Método findSnapshots deve ser implementado');
  }

  /**
   * Salva múltiplos snapshots em lote
   * @param {Array<PortfolioSnapshot>} snapshots - Entidades a salvar
   * @returns {Promise<number>} - Quantidade de registros inseridos
   */
  async saveSnapshots(snapshots) {
    throw new Error('Método saveSnapshots deve ser implementado');
  }

  /**
   * Remove todos os snapshots de uma data específica
   * @param {string} snapshotDate - Data no formato YYYY-MM-DD
   * @returns {Promise<void>}
   */
  async deleteSnapshotsByDate(snapshotDate) {
    throw new Error('Método deleteSnapshotsByDate deve ser implementado');
  }

  /**
   * Retorna estatísticas agregadas dos snapshots de um mês/ano
   * @param {Object} params
   * @param {number} params.month - Mês (1-12)
   * @param {number} params.year - Ano
   * @returns {Promise<{clientesAtivos: number, churns: number, projetosAtivos: number, projetosInativos: number, projetosEncerrados: number}>}
   */
  async getSnapshotStats(filters) {
    throw new Error('Método getSnapshotStats deve ser implementado');
  }
}

export { CustomerSuccessRepository };
