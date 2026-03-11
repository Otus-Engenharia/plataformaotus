/**
 * Use Case: GenerateSnapshot
 *
 * Gera um snapshot do portfólio para uma data específica.
 * Operação idempotente: remove snapshots existentes da data antes de inserir.
 *
 * O bigqueryClient é injetado como dependência — não é importado diretamente.
 * Usa o mapa project→company do Supabase para resolver company_id e classificação via FK.
 */

import { PortfolioSnapshot } from '../../../domain/customer-success/entities/PortfolioSnapshot.js';
import { StatusCliente } from '../../../domain/customer-success/value-objects/StatusCliente.js';
import { StatusProjeto } from '../../../domain/customer-success/value-objects/StatusProjeto.js';

class GenerateSnapshot {
  #repository;
  #bigqueryClient;

  constructor(repository, bigqueryClient) {
    this.#repository = repository;
    this.#bigqueryClient = bigqueryClient;
  }

  async execute({ snapshotDate } = {}) {
    const targetDate = snapshotDate
      ? new Date(snapshotDate)
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const dateStr = targetDate.toISOString().split('T')[0];

    await this.#repository.deleteSnapshotsByDate(dateStr);

    const [portfolioRows, classificacoes, projectCompanyMap] = await Promise.all([
      this.#bigqueryClient.queryPortfolio(null),
      this.#repository.findAllClassificacoes(),
      this.#repository.findProjectCompanyMap(),
    ]);

    // Mapa de companyId → classificacao (via FK)
    const classificacaoMap = new Map(classificacoes.map(c => [c.companyId, c.classificacao]));

    const projectsByCliente = new Map();

    for (const row of portfolioRows) {
      // Resolver company via project_code
      const companyInfo = projectCompanyMap.get(row.project_code);
      const cliente = companyInfo?.companyName || row.client;
      const companyId = companyInfo?.companyId || null;

      const statusProjeto = StatusProjeto.fromPortfolioStatus(row.status);
      const dataTermino = row.data_termino_cronograma
        ? new Date(row.data_termino_cronograma)
        : null;

      if (!projectsByCliente.has(cliente)) {
        projectsByCliente.set(cliente, []);
      }

      projectsByCliente.get(cliente).push({
        row,
        statusProjeto,
        dataTermino,
        companyId,
      });
    }

    const snapshots = [];

    for (const [cliente, projects] of projectsByCliente) {
      const statusCliente = StatusCliente.compute(
        projects.map(p => ({ statusProjeto: p.statusProjeto, dataTermino: p.dataTermino }))
      );

      for (const { row, statusProjeto, dataTermino, companyId } of projects) {
        // Buscar classificação via companyId (FK)
        const classificacao = companyId ? (classificacaoMap.get(companyId) ?? null) : null;

        const dataVenda = row.data_venda ? new Date(row.data_venda) : null;
        const valorContrato = row.valor_total_contrato_mais_aditivos != null
          ? Number(row.valor_total_contrato_mais_aditivos)
          : null;

        snapshots.push(PortfolioSnapshot.create({
          snapshotDate: dateStr,
          companyId,
          cliente,
          projetoCodigo: row.project_code,
          projetoNome: row.project_name,
          status: row.status,
          statusProjeto,
          statusCliente,
          classificacao,
          dataVenda,
          dataTermino,
          valorContrato,
          lider: row.lider,
          time: row.nome_time,
        }));
      }
    }

    const count = await this.#repository.saveSnapshots(snapshots);

    return { snapshotDate: dateStr, totalProjetos: count };
  }
}

export { GenerateSnapshot };
