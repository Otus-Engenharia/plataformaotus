/**
 * Use Case: ImportHistoricalSnapshots
 *
 * Importa snapshots históricos a partir de linhas de CSV já parseadas.
 * Cada linha deve conter os campos de um PortfolioSnapshot.
 */

import { PortfolioSnapshot } from '../../../domain/customer-success/entities/PortfolioSnapshot.js';

class ImportHistoricalSnapshots {
  #repository;

  constructor(repository) {
    this.#repository = repository;
  }

  /**
   * @param {Object} input
   * @param {Array<Object>} input.rows - Linhas do CSV com campos do snapshot
   * @returns {Promise<{imported: number}>}
   */
  async execute({ rows }) {
    const snapshots = rows.map(row => PortfolioSnapshot.create({
      snapshotDate: row.snapshot_date,
      companyId: row.company_id || null,
      cliente: row.cliente,
      projetoCodigo: row.projeto_codigo,
      projetoNome: row.projeto_nome,
      status: row.status,
      statusProjeto: row.status_projeto,
      statusCliente: row.status_cliente,
      classificacao: row.classificacao || null,
      dataVenda: row.data_venda || null,
      dataTermino: row.data_termino || null,
      valorContrato: row.valor_contrato != null ? Number(row.valor_contrato) : null,
      lider: row.lider,
      time: row.time,
    }));

    const count = await this.#repository.saveSnapshots(snapshots);

    return { imported: count };
  }
}

export { ImportHistoricalSnapshots };
