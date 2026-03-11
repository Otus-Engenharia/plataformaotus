/**
 * Entidade: PercepcaoEquipe
 * Aggregate Root do domínio de Pesquisas CS
 *
 * Representa uma avaliação de percepção da equipe sobre um projeto em um mês.
 * Múltiplas respostas por projeto/mês (uma por analista).
 * UNIQUE = (projeto_codigo, mes_referencia, ano_referencia, respondente_email)
 */

import { Dimensao } from '../value-objects/Dimensao.js';
import { PeriodoReferencia } from '../value-objects/PeriodoReferencia.js';

class PercepcaoEquipe {
  #id;
  #periodo;
  #projetoCodigo;
  #respondenteEmail;
  #respondenteNome;
  #cronograma;
  #qualidade;
  #comunicacao;
  #custos;
  #parceria;
  #confianca;
  #oportunidadeRevenda;
  #comentarios;
  #createdAt;
  #updatedAt;

  constructor({
    id = null,
    mes,
    ano,
    projetoCodigo,
    respondenteEmail,
    respondenteNome = null,
    cronograma = null,
    qualidade,
    comunicacao,
    custos,
    parceria,
    confianca,
    oportunidadeRevenda = null,
    comentarios = null,
    createdAt = null,
    updatedAt = null,
  }) {
    if (!projetoCodigo || String(projetoCodigo).trim().length === 0) {
      throw new Error('O código do projeto é obrigatório');
    }
    if (!respondenteEmail || String(respondenteEmail).trim().length === 0) {
      throw new Error('O email do respondente é obrigatório');
    }

    this.#id = id;
    this.#periodo = new PeriodoReferencia(mes, ano);
    this.#projetoCodigo = String(projetoCodigo).trim();
    this.#respondenteEmail = String(respondenteEmail).trim().toLowerCase();
    this.#respondenteNome = respondenteNome?.trim() || null;

    // Dimensões — cronograma nullable, restante obrigatório
    this.#cronograma = Dimensao.nullable(cronograma);
    this.#qualidade = Dimensao.required(qualidade, 'qualidade');
    this.#comunicacao = Dimensao.required(comunicacao, 'comunicação');
    this.#custos = Dimensao.required(custos, 'custos');
    this.#parceria = Dimensao.required(parceria, 'parceria');
    this.#confianca = Dimensao.required(confianca, 'confiança');

    this.#oportunidadeRevenda = oportunidadeRevenda;
    this.#comentarios = comentarios?.trim() || null;
    this.#createdAt = createdAt ? new Date(createdAt) : new Date();
    this.#updatedAt = updatedAt ? new Date(updatedAt) : new Date();
  }

  // --- Getters ---
  get id() { return this.#id; }
  get periodo() { return this.#periodo; }
  get projetoCodigo() { return this.#projetoCodigo; }
  get respondenteEmail() { return this.#respondenteEmail; }
  get respondenteNome() { return this.#respondenteNome; }
  get cronograma() { return this.#cronograma; }
  get qualidade() { return this.#qualidade; }
  get comunicacao() { return this.#comunicacao; }
  get custos() { return this.#custos; }
  get parceria() { return this.#parceria; }
  get confianca() { return this.#confianca; }
  get oportunidadeRevenda() { return this.#oportunidadeRevenda; }
  get comentarios() { return this.#comentarios; }
  get createdAt() { return this.#createdAt; }
  get updatedAt() { return this.#updatedAt; }

  // --- Índices Calculados ---

  /**
   * IP (Índice de Operação) = avg(cronograma, qualidade, comunicação)
   * Cronograma pode ser null (projetos de compatibilização) — calcula com dimensões presentes
   */
  get ip() {
    const dims = [this.#qualidade.value, this.#comunicacao.value];
    if (!this.#cronograma.isNull) dims.push(this.#cronograma.value);
    return dims.reduce((sum, v) => sum + v, 0) / dims.length;
  }

  /**
   * IVE (Índice de Valor Estratégico) = avg(custos, parceria, confiança)
   */
  get ive() {
    const dims = [this.#custos.value, this.#parceria.value, this.#confianca.value];
    return dims.reduce((sum, v) => sum + v, 0) / dims.length;
  }

  /**
   * ISP (Índice de Saúde da Parceria) = avg(todas as 6 dimensões presentes)
   */
  get isp() {
    const dims = [
      this.#qualidade.value,
      this.#comunicacao.value,
      this.#custos.value,
      this.#parceria.value,
      this.#confianca.value,
    ];
    if (!this.#cronograma.isNull) dims.push(this.#cronograma.value);
    return dims.reduce((sum, v) => sum + v, 0) / dims.length;
  }

  // --- Persistência ---

  toPersistence() {
    return {
      id: this.#id,
      mes_referencia: this.#periodo.mes,
      ano_referencia: this.#periodo.ano,
      projeto_codigo: this.#projetoCodigo,
      respondente_email: this.#respondenteEmail,
      respondente_nome: this.#respondenteNome,
      cronograma: this.#cronograma.value,
      qualidade: this.#qualidade.value,
      comunicacao: this.#comunicacao.value,
      custos: this.#custos.value,
      parceria: this.#parceria.value,
      confianca: this.#confianca.value,
      oportunidade_revenda: this.#oportunidadeRevenda,
      comentarios: this.#comentarios,
      created_at: this.#createdAt.toISOString(),
      updated_at: this.#updatedAt.toISOString(),
    };
  }

  toResponse() {
    return {
      id: this.#id,
      mes_referencia: this.#periodo.mes,
      ano_referencia: this.#periodo.ano,
      periodo_label: this.#periodo.label,
      periodo_key: this.#periodo.key,
      projeto_codigo: this.#projetoCodigo,
      respondente_email: this.#respondenteEmail,
      respondente_nome: this.#respondenteNome,
      cronograma: this.#cronograma.value,
      qualidade: this.#qualidade.value,
      comunicacao: this.#comunicacao.value,
      custos: this.#custos.value,
      parceria: this.#parceria.value,
      confianca: this.#confianca.value,
      oportunidade_revenda: this.#oportunidadeRevenda,
      comentarios: this.#comentarios,
      // Índices calculados
      ip: Math.round(this.ip * 100) / 100,
      ive: Math.round(this.ive * 100) / 100,
      isp: Math.round(this.isp * 100) / 100,
      created_at: this.#createdAt.toISOString(),
      updated_at: this.#updatedAt.toISOString(),
    };
  }

  static fromPersistence(data) {
    return new PercepcaoEquipe({
      id: data.id,
      mes: data.mes_referencia,
      ano: data.ano_referencia,
      projetoCodigo: data.projeto_codigo,
      respondenteEmail: data.respondente_email,
      respondenteNome: data.respondente_nome,
      cronograma: data.cronograma,
      qualidade: data.qualidade,
      comunicacao: data.comunicacao,
      custos: data.custos,
      parceria: data.parceria,
      confianca: data.confianca,
      oportunidadeRevenda: data.oportunidade_revenda,
      comentarios: data.comentarios,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    });
  }

  static create(input) {
    return new PercepcaoEquipe(input);
  }
}

export { PercepcaoEquipe };
