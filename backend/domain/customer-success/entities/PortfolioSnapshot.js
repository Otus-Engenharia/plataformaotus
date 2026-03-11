/**
 * Entidade: PortfolioSnapshot
 * Representa um registro histórico do portfólio de um cliente em uma data específica.
 *
 * Captura o estado de um projeto em um momento no tempo para análise de churn e retenção.
 */

import { Classificacao } from '../value-objects/Classificacao.js';
import { StatusCliente } from '../value-objects/StatusCliente.js';
import { StatusProjeto } from '../value-objects/StatusProjeto.js';

class PortfolioSnapshot {
  #id;
  #snapshotDate;
  #companyId;
  #cliente;
  #projectCode;
  #projectName;
  #status;
  #statusProjeto;
  #statusCliente;
  #classificacao;
  #dataVenda;
  #dataTermino;
  #valorContrato;
  #lider;
  #time;
  #createdAt;

  constructor({
    id = null,
    snapshotDate,
    companyId = null,
    cliente,
    projectCode = null,
    projectName = null,
    status = null,
    statusProjeto,
    statusCliente,
    classificacao = null,
    dataVenda = null,
    dataTermino = null,
    valorContrato = null,
    lider = null,
    time = null,
    createdAt = null,
  }) {
    if (!snapshotDate) {
      throw new Error('A data do snapshot é obrigatória');
    }

    if (!cliente || String(cliente).trim().length === 0) {
      throw new Error('O cliente é obrigatório');
    }

    this.#id = id;
    this.#snapshotDate = snapshotDate instanceof Date ? snapshotDate : new Date(snapshotDate);
    this.#companyId = companyId || null;
    this.#cliente = String(cliente).trim();
    this.#projectCode = projectCode || null;
    this.#projectName = projectName || null;
    this.#status = status || null;
    this.#statusProjeto = statusProjeto
      ? (statusProjeto instanceof StatusProjeto ? statusProjeto : new StatusProjeto(statusProjeto))
      : null;
    this.#statusCliente = statusCliente
      ? (statusCliente instanceof StatusCliente ? statusCliente : new StatusCliente(statusCliente))
      : null;
    this.#classificacao = classificacao
      ? (classificacao instanceof Classificacao ? classificacao : new Classificacao(classificacao))
      : null;
    this.#dataVenda = dataVenda ? new Date(dataVenda) : null;
    this.#dataTermino = dataTermino ? new Date(dataTermino) : null;
    this.#valorContrato = valorContrato != null ? Number(valorContrato) : null;
    this.#lider = lider || null;
    this.#time = time || null;
    this.#createdAt = createdAt ? new Date(createdAt) : new Date();
  }

  get id() { return this.#id; }
  get snapshotDate() { return this.#snapshotDate; }
  get companyId() { return this.#companyId; }
  get cliente() { return this.#cliente; }
  get projectCode() { return this.#projectCode; }
  get projectName() { return this.#projectName; }
  get status() { return this.#status; }
  get statusProjeto() { return this.#statusProjeto; }
  get statusCliente() { return this.#statusCliente; }
  get classificacao() { return this.#classificacao; }
  get dataVenda() { return this.#dataVenda; }
  get dataTermino() { return this.#dataTermino; }
  get valorContrato() { return this.#valorContrato; }
  get lider() { return this.#lider; }
  get time() { return this.#time; }
  get createdAt() { return this.#createdAt; }

  get isChurn() { return this.#statusCliente?.value === 'CHURN'; }
  get isAtivo() { return this.#statusProjeto?.value === 'ATIVO'; }
  get isEncerrado() { return this.#statusProjeto?.value === 'ENCERRADO'; }
  get isInativo() { return this.#statusProjeto?.value === 'INATIVO'; }

  toPersistence() {
    return {
      id: this.#id,
      snapshot_date: this.#snapshotDate.toISOString().split('T')[0],
      company_id: this.#companyId,
      cliente: this.#cliente,
      project_code: this.#projectCode,
      project_name: this.#projectName,
      status: this.#status,
      status_projeto: this.#statusProjeto?.value ?? null,
      status_cliente: this.#statusCliente?.value ?? null,
      classificacao: this.#classificacao?.value ?? null,
      data_venda: this.#dataVenda ? this.#dataVenda.toISOString().split('T')[0] : null,
      data_termino: this.#dataTermino ? this.#dataTermino.toISOString().split('T')[0] : null,
      valor_contrato: this.#valorContrato,
      lider: this.#lider,
      time: this.#time,
      created_at: this.#createdAt.toISOString(),
    };
  }

  toResponse() {
    return {
      id: this.#id,
      snapshot_date: this.#snapshotDate.toISOString().split('T')[0],
      company_id: this.#companyId,
      cliente: this.#cliente,
      project_code: this.#projectCode,
      project_name: this.#projectName,
      status: this.#status,
      status_projeto: this.#statusProjeto?.value ?? null,
      status_cliente: this.#statusCliente?.value ?? null,
      classificacao: this.#classificacao?.value ?? null,
      classificacao_label: this.#classificacao?.label ?? null,
      data_venda: this.#dataVenda ? this.#dataVenda.toISOString().split('T')[0] : null,
      data_termino: this.#dataTermino ? this.#dataTermino.toISOString().split('T')[0] : null,
      valor_contrato: this.#valorContrato,
      lider: this.#lider,
      time: this.#time,
      created_at: this.#createdAt.toISOString(),
      // Campos calculados
      is_churn: this.isChurn,
      is_ativo: this.isAtivo,
      is_encerrado: this.isEncerrado,
      is_inativo: this.isInativo,
    };
  }

  static fromPersistence(data) {
    return new PortfolioSnapshot({
      id: data.id,
      snapshotDate: data.snapshot_date,
      companyId: data.company_id || null,
      cliente: data.cliente,
      projectCode: data.project_code,
      projectName: data.project_name,
      status: data.status,
      statusProjeto: data.status_projeto,
      statusCliente: data.status_cliente,
      classificacao: data.classificacao || null,
      dataVenda: data.data_venda,
      dataTermino: data.data_termino,
      valorContrato: data.valor_contrato,
      lider: data.lider,
      time: data.time,
      createdAt: data.created_at,
    });
  }

  static create({
    snapshotDate,
    companyId,
    cliente,
    projectCode,
    projectName,
    status,
    statusProjeto,
    statusCliente,
    classificacao,
    dataVenda,
    dataTermino,
    valorContrato,
    lider,
    time,
  }) {
    return new PortfolioSnapshot({
      snapshotDate,
      companyId,
      cliente,
      projectCode,
      projectName,
      status,
      statusProjeto,
      statusCliente,
      classificacao,
      dataVenda,
      dataTermino,
      valorContrato,
      lider,
      time,
    });
  }
}

export { PortfolioSnapshot };
