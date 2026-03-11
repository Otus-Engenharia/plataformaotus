/**
 * Value Object: StatusCliente
 * Representa o status do cliente no Customer Success: ATIVO ou CHURN
 *
 * Regras de negócio:
 * - CHURN: todos os projetos estão ENCERRADOS e ao menos 1 tem data_termino > 30 dias atrás
 * - ATIVO: ao menos 1 projeto está ATIVO ou INATIVO
 */

import { StatusProjeto } from './StatusProjeto.js';

const VALID_STATUS_CLIENTE = Object.freeze({
  ATIVO: 'ATIVO',
  CHURN: 'CHURN',
});

const DIAS_PARA_CHURN = 30;

class StatusCliente {
  #value;

  constructor(value) {
    if (!StatusCliente.isValid(value)) {
      throw new Error(
        `StatusCliente inválido: "${value}". Valores permitidos: ${Object.values(VALID_STATUS_CLIENTE).join(', ')}`
      );
    }

    this.#value = value;
    Object.freeze(this);
  }

  get value() {
    return this.#value;
  }

  get isAtivo() {
    return this.#value === VALID_STATUS_CLIENTE.ATIVO;
  }

  get isChurn() {
    return this.#value === VALID_STATUS_CLIENTE.CHURN;
  }

  equals(other) {
    if (!(other instanceof StatusCliente)) {
      return false;
    }
    return this.#value === other.value;
  }

  toString() {
    return this.#value;
  }

  toJSON() {
    return this.#value;
  }

  static isValid(value) {
    return Object.values(VALID_STATUS_CLIENTE).includes(value);
  }

  /**
   * Computa o status do cliente com base em seus projetos.
   *
   * @param {Array<{statusProjeto: StatusProjeto|string, dataTermino: Date|string|null}>} projetos
   * @returns {StatusCliente}
   */
  static compute(projetos) {
    if (!projetos || projetos.length === 0) {
      return new StatusCliente(VALID_STATUS_CLIENTE.ATIVO);
    }

    const temProjetoAtivo = projetos.some((p) => {
      const status = p.statusProjeto instanceof StatusProjeto
        ? p.statusProjeto
        : StatusProjeto.fromPortfolioStatus(p.statusProjeto);
      return status.isAtivo || status.isInativo;
    });

    if (temProjetoAtivo) {
      return new StatusCliente(VALID_STATUS_CLIENTE.ATIVO);
    }

    const todosEncerrados = projetos.every((p) => {
      const status = p.statusProjeto instanceof StatusProjeto
        ? p.statusProjeto
        : StatusProjeto.fromPortfolioStatus(p.statusProjeto);
      return status.isEncerrado;
    });

    if (!todosEncerrados) {
      return new StatusCliente(VALID_STATUS_CLIENTE.ATIVO);
    }

    const agora = new Date();
    const limiteChurn = new Date(agora.getTime() - DIAS_PARA_CHURN * 24 * 60 * 60 * 1000);

    const temEncerramentoAntigo = projetos.some((p) => {
      if (!p.dataTermino) return false;
      const dataTermino = new Date(p.dataTermino);
      return dataTermino < limiteChurn;
    });

    if (temEncerramentoAntigo) {
      return new StatusCliente(VALID_STATUS_CLIENTE.CHURN);
    }

    return new StatusCliente(VALID_STATUS_CLIENTE.ATIVO);
  }

  static get VALID_VALUES() {
    return Object.values(VALID_STATUS_CLIENTE);
  }

  static get STATUS() {
    return VALID_STATUS_CLIENTE;
  }
}

export { StatusCliente, VALID_STATUS_CLIENTE as StatusClienteEnum };
