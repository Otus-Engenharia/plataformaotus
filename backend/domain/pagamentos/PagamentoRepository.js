class PagamentoRepository {
  // --- Parcelas ---

  async findAllParcelas(options = {}) {
    throw new Error('Metodo findAllParcelas deve ser implementado');
  }

  async findParcelaById(id) {
    throw new Error('Metodo findParcelaById deve ser implementado');
  }

  async findParcelasByProject(projectCode) {
    throw new Error('Metodo findParcelasByProject deve ser implementado');
  }

  async findParcelasVinculadas() {
    throw new Error('Metodo findParcelasVinculadas deve ser implementado');
  }

  async findUpcomingParcelas(options = {}) {
    throw new Error('Metodo findUpcomingParcelas deve ser implementado');
  }

  async saveParcela(parcela) {
    throw new Error('Metodo saveParcela deve ser implementado');
  }

  async updateParcela(parcela) {
    throw new Error('Metodo updateParcela deve ser implementado');
  }

  async deleteParcela(id) {
    throw new Error('Metodo deleteParcela deve ser implementado');
  }

  async countPendingParcelas(userEmail) {
    throw new Error('Metodo countPendingParcelas deve ser implementado');
  }

  // --- Regras Cliente ---

  async findAllRegras() {
    throw new Error('Metodo findAllRegras deve ser implementado');
  }

  async findRegraByCompanyId(companyId) {
    throw new Error('Metodo findRegraByCompanyId deve ser implementado');
  }

  async saveRegra(regra) {
    throw new Error('Metodo saveRegra deve ser implementado');
  }

  async updateRegra(regra) {
    throw new Error('Metodo updateRegra deve ser implementado');
  }

  // --- Change Log ---

  async saveChangeLog(entry) {
    throw new Error('Metodo saveChangeLog deve ser implementado');
  }

  async saveChangeLogBatch(entries) {
    throw new Error('Metodo saveChangeLogBatch deve ser implementado');
  }

  async findChangeLogByProject(projectCode) {
    throw new Error('Metodo findChangeLogByProject deve ser implementado');
  }

  // --- Dashboard / Summary ---

  async countParcelasByStatus() {
    throw new Error('Metodo countParcelasByStatus deve ser implementado');
  }

  async sumValorByStatus() {
    throw new Error('Metodo sumValorByStatus deve ser implementado');
  }

  async getProjectCodesWithParcelas() {
    throw new Error('Metodo getProjectCodesWithParcelas deve ser implementado');
  }

  async findParcelasByGerente(email) {
    throw new Error('Metodo findParcelasByGerente deve ser implementado');
  }

  async getActiveSpotProjectCodes() {
    throw new Error('Metodo getActiveSpotProjectCodes deve ser implementado');
  }

  async getAllSpotProjects() {
    throw new Error('Metodo getAllSpotProjects deve ser implementado');
  }
}

export { PagamentoRepository };
