/**
 * Use Case: GetClienteStatusMap
 *
 * Retorna o status (ATIVO/CHURN) de cada cliente baseado nos projetos do portfolio.
 * Reutiliza a mesma lógica de StatusCliente.compute() usada na geração de snapshots.
 */

import { StatusCliente } from '../../../domain/customer-success/value-objects/StatusCliente.js';
import { StatusProjeto } from '../../../domain/customer-success/value-objects/StatusProjeto.js';

class GetClienteStatusMap {
  #repository;
  #bigqueryClient;

  constructor(repository, bigqueryClient) {
    this.#repository = repository;
    this.#bigqueryClient = bigqueryClient;
  }

  async execute() {
    const [portfolioRows, projectCompanyMap] = await Promise.all([
      this.#bigqueryClient.queryPortfolio(null),
      this.#repository.findProjectCompanyMap(),
    ]);

    const projectsByCompany = new Map();

    for (const row of portfolioRows) {
      const companyInfo = projectCompanyMap.get(row.project_code);
      if (!companyInfo) continue;

      const { companyId, companyName } = companyInfo;

      if (!projectsByCompany.has(companyId)) {
        projectsByCompany.set(companyId, { companyName, projects: [] });
      }

      const statusProjeto = StatusProjeto.fromPortfolioStatus(row.status);
      const dataTermino = row.data_termino_cronograma
        ? new Date(row.data_termino_cronograma)
        : null;

      projectsByCompany.get(companyId).projects.push({ statusProjeto, dataTermino });
    }

    const result = [];

    for (const [companyId, { companyName, projects }] of projectsByCompany) {
      const statusCliente = StatusCliente.compute(
        projects.map(p => ({ statusProjeto: p.statusProjeto, dataTermino: p.dataTermino }))
      );

      result.push({
        company_id: companyId,
        company_name: companyName,
        status_cliente: statusCliente.value,
      });
    }

    return result;
  }
}

export { GetClienteStatusMap };
