import { StatusProjetos } from '../value-objects/StatusProjetos.js';
import { StatusFinanceiro } from '../value-objects/StatusFinanceiro.js';
import { OrigemParcela } from '../value-objects/OrigemParcela.js';

class Parcela {
  #id;
  #projectId;
  #projectCode;
  #companyId;
  #parcelaNumero;
  #descricao;
  #valor;
  #origem;
  #fase;
  #statusProjetos;
  #statusFinanceiro;
  #smartsheetRowId;
  #smartsheetTaskName;
  #smartsheetDataTermino;
  #lastSmartsheetDataTermino;
  #dataPagamentoCalculada;
  #dataPagamentoManual;
  #parcelaSemCronograma;
  #comentarioFinanceiro;
  #comentarioProjetos;
  #gerenteEmail;
  #alertaCronograma;
  #tipoServico;
  #dilatacaoDias;
  #statusSolicitacao;
  #createdBy;
  #createdAt;
  #updatedAt;

  constructor({
    id = null,
    projectId = null,
    projectCode,
    companyId = null,
    parcelaNumero,
    descricao = null,
    valor = null,
    origem = 'Contrato',
    fase = null,
    statusProjetos = 'nao_vinculado',
    statusFinanceiro = 'pendente',
    smartsheetRowId = null,
    smartsheetTaskName = null,
    smartsheetDataTermino = null,
    lastSmartsheetDataTermino = null,
    dataPagamentoCalculada = null,
    dataPagamentoManual = null,
    parcelaSemCronograma = false,
    comentarioFinanceiro = null,
    comentarioProjetos = null,
    gerenteEmail = null,
    alertaCronograma = null,
    tipoServico = 'coordenacao',
    dilatacaoDias = 0,
    statusSolicitacao = null,
    createdBy = null,
    createdAt = null,
    updatedAt = null,
  }) {
    if (!projectCode) throw new Error('O codigo do projeto e obrigatorio');

    this.#id = id;
    this.#projectId = projectId || null;
    this.#projectCode = projectCode;
    this.#companyId = companyId || null;
    this.#parcelaNumero = parcelaNumero != null ? Number(parcelaNumero) : null;
    this.#descricao = descricao?.trim() || null;
    this.#valor = valor != null ? Number(valor) : null;
    this.#origem = origem instanceof OrigemParcela ? origem : new OrigemParcela(origem);
    this.#fase = fase?.trim() || null;
    this.#statusProjetos = statusProjetos instanceof StatusProjetos ? statusProjetos : new StatusProjetos(statusProjetos);
    this.#statusFinanceiro = statusFinanceiro instanceof StatusFinanceiro ? statusFinanceiro : new StatusFinanceiro(statusFinanceiro);
    this.#smartsheetRowId = smartsheetRowId || null;
    this.#smartsheetTaskName = smartsheetTaskName || null;
    this.#smartsheetDataTermino = smartsheetDataTermino || null;
    this.#lastSmartsheetDataTermino = lastSmartsheetDataTermino || null;
    this.#dataPagamentoCalculada = dataPagamentoCalculada || null;
    this.#dataPagamentoManual = dataPagamentoManual || null;
    this.#parcelaSemCronograma = !!parcelaSemCronograma;
    this.#comentarioFinanceiro = comentarioFinanceiro || null;
    this.#comentarioProjetos = comentarioProjetos || null;
    this.#gerenteEmail = gerenteEmail || null;
    this.#alertaCronograma = alertaCronograma || null;
    this.#tipoServico = tipoServico || 'coordenacao';
    this.#dilatacaoDias = dilatacaoDias != null ? Number(dilatacaoDias) : 0;
    this.#statusSolicitacao = statusSolicitacao || null;
    this.#createdBy = createdBy || null;
    this.#createdAt = createdAt ? new Date(createdAt) : new Date();
    this.#updatedAt = updatedAt ? new Date(updatedAt) : new Date();
  }

  // Getters
  get id() { return this.#id; }
  get projectId() { return this.#projectId; }
  get projectCode() { return this.#projectCode; }
  get companyId() { return this.#companyId; }
  get parcelaNumero() { return this.#parcelaNumero; }
  get descricao() { return this.#descricao; }
  get valor() { return this.#valor; }
  get origem() { return this.#origem; }
  get fase() { return this.#fase; }
  get statusProjetos() { return this.#statusProjetos; }
  get statusFinanceiro() { return this.#statusFinanceiro; }
  get smartsheetRowId() { return this.#smartsheetRowId; }
  get smartsheetTaskName() { return this.#smartsheetTaskName; }
  get smartsheetDataTermino() { return this.#smartsheetDataTermino; }
  get lastSmartsheetDataTermino() { return this.#lastSmartsheetDataTermino; }
  get dataPagamentoCalculada() { return this.#dataPagamentoCalculada; }
  get dataPagamentoManual() { return this.#dataPagamentoManual; }
  get parcelaSemCronograma() { return this.#parcelaSemCronograma; }
  get comentarioFinanceiro() { return this.#comentarioFinanceiro; }
  get comentarioProjetos() { return this.#comentarioProjetos; }
  get gerenteEmail() { return this.#gerenteEmail; }
  get alertaCronograma() { return this.#alertaCronograma; }
  get tipoServico() { return this.#tipoServico; }
  get dilatacaoDias() { return this.#dilatacaoDias; }
  get statusSolicitacao() { return this.#statusSolicitacao; }
  get createdBy() { return this.#createdBy; }
  get createdAt() { return this.#createdAt; }
  get updatedAt() { return this.#updatedAt; }

  get isVinculado() { return !!this.#smartsheetRowId; }
  get isFaturado() { return this.#statusFinanceiro.isClosed; }
  // Backward compat alias
  get isRecebido() { return this.isFaturado; }

  get dataPagamentoEfetiva() {
    return this.#dataPagamentoManual || this.#dataPagamentoCalculada || null;
  }

  // --- Comportamentos ---

  vincularTarefa(rowId, taskName, dataTermino = null) {
    if (!rowId) throw new Error('O rowId da tarefa e obrigatorio');
    if (!taskName) throw new Error('O nome da tarefa e obrigatorio');

    this.#smartsheetRowId = String(rowId);
    this.#smartsheetTaskName = taskName;
    this.#smartsheetDataTermino = dataTermino || null;
    this.#lastSmartsheetDataTermino = dataTermino || null;
    this.#statusProjetos = new StatusProjetos('vinculado');
    this.#updatedAt = new Date();
  }

  desvincularTarefa() {
    this.#smartsheetRowId = null;
    this.#smartsheetTaskName = null;
    this.#smartsheetDataTermino = null;
    this.#lastSmartsheetDataTermino = null;
    this.#statusProjetos = new StatusProjetos('nao_vinculado');
    this.#updatedAt = new Date();
  }

  atualizarStatusProjetos(newStatus) {
    const statusVO = newStatus instanceof StatusProjetos ? newStatus : new StatusProjetos(newStatus);
    this.#statusProjetos = statusVO;
    this.#updatedAt = new Date();
  }

  atualizarStatusFinanceiro(newStatus) {
    const statusVO = newStatus instanceof StatusFinanceiro ? newStatus : new StatusFinanceiro(newStatus);
    this.#statusFinanceiro = statusVO;
    this.#updatedAt = new Date();
  }

  detectarMudancaCronograma(currentDataTermino) {
    const lastStr = this.#lastSmartsheetDataTermino ? String(this.#lastSmartsheetDataTermino) : null;
    const currentStr = currentDataTermino ? String(currentDataTermino) : null;
    const mudou = lastStr !== currentStr;

    if (mudou) {
      this.#smartsheetDataTermino = currentDataTermino || null;
      this.#lastSmartsheetDataTermino = currentDataTermino || null;
      this.#updatedAt = new Date();
    }

    return mudou;
  }

  marcarAlertaCronograma(tipo) {
    this.#alertaCronograma = tipo || 'data_alterada';
    this.#updatedAt = new Date();
  }

  limparAlertaCronograma() {
    this.#alertaCronograma = null;
    this.#updatedAt = new Date();
  }

  marcarSolicitado() {
    this.#statusSolicitacao = 'solicitado';
    this.#updatedAt = new Date();
  }

  calcularDataPagamento(regra) {
    if (!regra || this.#parcelaSemCronograma) {
      this.#dataPagamentoCalculada = null;
      return;
    }

    const dataBase = this.#smartsheetDataTermino || null;
    if (!dataBase) {
      this.#dataPagamentoCalculada = null;
      return;
    }

    const dataPagamento = regra.calcularDataPagamento(dataBase);
    if (dataPagamento && this.#dilatacaoDias > 0) {
      const d = new Date(dataPagamento);
      d.setDate(d.getDate() + this.#dilatacaoDias);
      this.#dataPagamentoCalculada = d.toISOString().split('T')[0];
    } else {
      this.#dataPagamentoCalculada = dataPagamento;
    }
    this.#updatedAt = new Date();
  }

  updateFields({ descricao, valor, origem, fase, comentarioFinanceiro, comentarioProjetos, dataPagamentoManual, parcelaSemCronograma, gerenteEmail, tipoServico, dilatacaoDias }) {
    if (descricao !== undefined) this.#descricao = descricao?.trim() || null;
    if (valor !== undefined) this.#valor = valor != null ? Number(valor) : null;
    if (origem !== undefined) this.#origem = new OrigemParcela(origem);
    if (fase !== undefined) this.#fase = fase?.trim() || null;
    if (comentarioFinanceiro !== undefined) this.#comentarioFinanceiro = comentarioFinanceiro || null;
    if (comentarioProjetos !== undefined) this.#comentarioProjetos = comentarioProjetos || null;
    if (dataPagamentoManual !== undefined) this.#dataPagamentoManual = dataPagamentoManual || null;
    if (parcelaSemCronograma !== undefined) this.#parcelaSemCronograma = !!parcelaSemCronograma;
    if (gerenteEmail !== undefined) this.#gerenteEmail = gerenteEmail || null;
    if (tipoServico !== undefined) this.#tipoServico = tipoServico || 'coordenacao';
    if (dilatacaoDias !== undefined) this.#dilatacaoDias = dilatacaoDias != null ? Number(dilatacaoDias) : 0;
    this.#updatedAt = new Date();
  }

  toPersistence() {
    return {
      id: this.#id,
      project_id: this.#projectId,
      project_code: this.#projectCode,
      company_id: this.#companyId,
      parcela_numero: this.#parcelaNumero,
      descricao: this.#descricao,
      valor: this.#valor,
      origem: this.#origem.value,
      fase: this.#fase,
      status_projetos: this.#statusProjetos.value,
      status_financeiro: this.#statusFinanceiro.value,
      smartsheet_row_id: this.#smartsheetRowId,
      smartsheet_task_name: this.#smartsheetTaskName,
      smartsheet_data_termino: this.#smartsheetDataTermino,
      last_smartsheet_data_termino: this.#lastSmartsheetDataTermino,
      data_pagamento_calculada: this.#dataPagamentoCalculada,
      data_pagamento_manual: this.#dataPagamentoManual,
      parcela_sem_cronograma: this.#parcelaSemCronograma,
      comentario_financeiro: this.#comentarioFinanceiro,
      comentario_projetos: this.#comentarioProjetos,
      gerente_email: this.#gerenteEmail,
      alerta_cronograma: this.#alertaCronograma,
      tipo_servico: this.#tipoServico,
      dilatacao_dias: this.#dilatacaoDias,
      status_solicitacao: this.#statusSolicitacao,
      created_by: this.#createdBy,
      created_at: this.#createdAt.toISOString(),
      updated_at: this.#updatedAt.toISOString(),
    };
  }

  toResponse() {
    return {
      ...this.toPersistence(),
      status_projetos_label: this.#statusProjetos.label,
      status_projetos_color: this.#statusProjetos.color,
      status_financeiro_label: this.#statusFinanceiro.label,
      status_financeiro_color: this.#statusFinanceiro.color,
      origem_label: this.#origem.label,
      is_vinculado: this.isVinculado,
      is_faturado: this.isFaturado,
      is_recebido: this.isFaturado,
      data_pagamento_efetiva: this.dataPagamentoEfetiva,
    };
  }

  static fromPersistence(data) {
    // Backward compat: if old `status` column exists and new columns don't
    let statusProjetos = data.status_projetos;
    let statusFinanceiro = data.status_financeiro;
    if (!statusProjetos && !statusFinanceiro && data.status) {
      const old = data.status;
      if (old === 'aguardando_vinculacao' || old === 'nao_finalizado') {
        statusProjetos = 'nao_vinculado';
        statusFinanceiro = 'pendente';
      } else if (old === 'vinculado') {
        statusProjetos = 'vinculado';
        statusFinanceiro = 'pendente';
      } else if (old === 'recebido') {
        statusProjetos = 'vinculado';
        statusFinanceiro = 'faturado';
      } else {
        statusProjetos = 'nao_vinculado';
        statusFinanceiro = 'pendente';
      }
    }

    return new Parcela({
      id: data.id,
      projectId: data.project_id,
      projectCode: data.project_code,
      companyId: data.company_id,
      parcelaNumero: data.parcela_numero,
      descricao: data.descricao,
      valor: data.valor,
      origem: data.origem,
      fase: data.fase,
      statusProjetos: statusProjetos || 'nao_vinculado',
      statusFinanceiro: statusFinanceiro || 'pendente',
      smartsheetRowId: data.smartsheet_row_id,
      smartsheetTaskName: data.smartsheet_task_name,
      smartsheetDataTermino: data.smartsheet_data_termino,
      lastSmartsheetDataTermino: data.last_smartsheet_data_termino,
      dataPagamentoCalculada: data.data_pagamento_calculada,
      dataPagamentoManual: data.data_pagamento_manual,
      parcelaSemCronograma: data.parcela_sem_cronograma,
      comentarioFinanceiro: data.comentario_financeiro,
      comentarioProjetos: data.comentario_projetos,
      gerenteEmail: data.gerente_email,
      alertaCronograma: data.alerta_cronograma,
      tipoServico: data.tipo_servico,
      dilatacaoDias: data.dilatacao_dias,
      statusSolicitacao: data.status_solicitacao,
      createdBy: data.created_by,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    });
  }

  static create({ projectCode, projectId, companyId, parcelaNumero, descricao, valor, origem, fase, gerenteEmail, tipoServico, createdBy }) {
    return new Parcela({
      projectCode,
      projectId,
      companyId,
      parcelaNumero,
      descricao,
      valor,
      origem,
      fase,
      statusProjetos: 'nao_vinculado',
      statusFinanceiro: 'pendente',
      gerenteEmail,
      tipoServico,
      createdBy,
    });
  }
}

export { Parcela };
