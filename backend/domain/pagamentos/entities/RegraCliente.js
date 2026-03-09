class RegraCliente {
  #id;
  #companyId;
  #companyName;
  #precisaMedicao;
  #diasSolicitarMedicao;
  #diasAprovacaoMedicao;
  #diasAntecedenciaFaturamento;
  #observacaoFinanceiro;
  #createdBy;
  #createdAt;
  #updatedAt;

  constructor({
    id = null,
    companyId,
    companyName,
    precisaMedicao = false,
    diasSolicitarMedicao = 0,
    diasAprovacaoMedicao = 0,
    diasAntecedenciaFaturamento = 0,
    observacaoFinanceiro = null,
    createdBy = null,
    createdAt = null,
    updatedAt = null,
  }) {
    if (!companyId) throw new Error('O ID do cliente e obrigatorio');
    if (!companyName) throw new Error('O nome do cliente e obrigatorio');

    this.#id = id;
    this.#companyId = companyId;
    this.#companyName = companyName.trim();
    this.#precisaMedicao = !!precisaMedicao;
    this.#diasSolicitarMedicao = Math.max(0, Number(diasSolicitarMedicao) || 0);
    this.#diasAprovacaoMedicao = Math.max(0, Number(diasAprovacaoMedicao) || 0);
    this.#diasAntecedenciaFaturamento = Math.max(0, Number(diasAntecedenciaFaturamento) || 0);
    this.#observacaoFinanceiro = observacaoFinanceiro || null;
    this.#createdBy = createdBy || null;
    this.#createdAt = createdAt ? new Date(createdAt) : new Date();
    this.#updatedAt = updatedAt ? new Date(updatedAt) : new Date();
  }

  get id() { return this.#id; }
  get companyId() { return this.#companyId; }
  get companyName() { return this.#companyName; }
  get precisaMedicao() { return this.#precisaMedicao; }
  get diasSolicitarMedicao() { return this.#diasSolicitarMedicao; }
  get diasAprovacaoMedicao() { return this.#diasAprovacaoMedicao; }
  get diasAntecedenciaFaturamento() { return this.#diasAntecedenciaFaturamento; }
  get observacaoFinanceiro() { return this.#observacaoFinanceiro; }
  get createdBy() { return this.#createdBy; }
  get createdAt() { return this.#createdAt; }
  get updatedAt() { return this.#updatedAt; }

  get totalDias() {
    return this.#diasSolicitarMedicao + this.#diasAprovacaoMedicao + this.#diasAntecedenciaFaturamento;
  }

  calcularDataPagamento(dataEntrega) {
    if (!dataEntrega) return null;
    const base = new Date(dataEntrega);
    if (isNaN(base.getTime())) return null;

    const totalOffset = this.totalDias;
    if (totalOffset === 0) return dataEntrega;

    const result = new Date(base);
    result.setDate(result.getDate() - totalOffset);
    return result.toISOString().split('T')[0];
  }

  updateFields({ precisaMedicao, diasSolicitarMedicao, diasAprovacaoMedicao, diasAntecedenciaFaturamento, observacaoFinanceiro }) {
    if (precisaMedicao !== undefined) this.#precisaMedicao = !!precisaMedicao;
    if (diasSolicitarMedicao !== undefined) this.#diasSolicitarMedicao = Math.max(0, Number(diasSolicitarMedicao) || 0);
    if (diasAprovacaoMedicao !== undefined) this.#diasAprovacaoMedicao = Math.max(0, Number(diasAprovacaoMedicao) || 0);
    if (diasAntecedenciaFaturamento !== undefined) this.#diasAntecedenciaFaturamento = Math.max(0, Number(diasAntecedenciaFaturamento) || 0);
    if (observacaoFinanceiro !== undefined) this.#observacaoFinanceiro = observacaoFinanceiro || null;
    this.#updatedAt = new Date();
  }

  toPersistence() {
    return {
      id: this.#id,
      company_id: this.#companyId,
      company_name: this.#companyName,
      precisa_medicao: this.#precisaMedicao,
      dias_solicitar_medicao: this.#diasSolicitarMedicao,
      dias_aprovacao_medicao: this.#diasAprovacaoMedicao,
      dias_antecedencia_faturamento: this.#diasAntecedenciaFaturamento,
      observacao_financeiro: this.#observacaoFinanceiro,
      created_by: this.#createdBy,
      created_at: this.#createdAt.toISOString(),
      updated_at: this.#updatedAt.toISOString(),
    };
  }

  toResponse() {
    return {
      ...this.toPersistence(),
      total_dias: this.totalDias,
    };
  }

  static fromPersistence(data) {
    return new RegraCliente({
      id: data.id,
      companyId: data.company_id,
      companyName: data.company_name,
      precisaMedicao: data.precisa_medicao,
      diasSolicitarMedicao: data.dias_solicitar_medicao,
      diasAprovacaoMedicao: data.dias_aprovacao_medicao,
      diasAntecedenciaFaturamento: data.dias_antecedencia_faturamento,
      observacaoFinanceiro: data.observacao_financeiro,
      createdBy: data.created_by,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    });
  }

  static create({ companyId, companyName, precisaMedicao, diasSolicitarMedicao, diasAprovacaoMedicao, diasAntecedenciaFaturamento, observacaoFinanceiro, createdBy }) {
    return new RegraCliente({
      companyId,
      companyName,
      precisaMedicao,
      diasSolicitarMedicao,
      diasAprovacaoMedicao,
      diasAntecedenciaFaturamento,
      observacaoFinanceiro,
      createdBy,
    });
  }
}

export { RegraCliente };
