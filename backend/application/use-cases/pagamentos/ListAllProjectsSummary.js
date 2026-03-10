class ListAllProjectsSummary {
  #repository;

  constructor(repository) {
    this.#repository = repository;
  }

  async execute() {
    const [spotProjects, parcelas, regras] = await Promise.all([
      this.#repository.getAllProjectsWithTipoPagamento(),
      this.#repository.findAllParcelas(),
      this.#repository.findAllRegras(),
    ]);

    // Build set of company_ids/names that have regras
    const companiesComRegra = new Set();
    for (const r of regras) {
      if (r.companyId) companiesComRegra.add(String(r.companyId));
      if (r.companyName) companiesComRegra.add(r.companyName);
    }

    // Build project map starting from ALL spot projects
    const projectMap = {};
    const now = new Date();

    for (const sp of spotProjects) {
      projectMap[sp.project_code] = {
        project_code: sp.project_code,
        project_name: sp.project_name || '',
        status: sp.status || '',
        company_name: sp.company_name || '',
        gerente_email: sp.gerente_email || '',
        gerente_name: sp.gerente_name || '',
        tipo_pagamento: sp.tipo_pagamento || 'spot',
        total_parcelas: 0,
        valor_total: 0,
        parcelas_faturadas: 0,
        parcelas_sem_vinculacao: 0,
        proximo_pagamento: null,
        has_regra_cliente: companiesComRegra.has(sp.company_name || ''),
      };
    }

    // Merge parcela data
    for (const p of parcelas) {
      const code = p.projectCode;
      if (!projectMap[code]) {
        // Parcela for a non-spot project — still include it
        projectMap[code] = {
          project_code: code,
          project_name: '',
          status: '',
          company_name: p.companyId || '',
          gerente_email: p.gerenteEmail || '',
          gerente_name: '',
          tipo_pagamento: 'spot',
          total_parcelas: 0,
          valor_total: 0,
          parcelas_faturadas: 0,
          parcelas_sem_vinculacao: 0,
          proximo_pagamento: null,
          has_regra_cliente: companiesComRegra.has(p.companyId || ''),
        };
      }
      const proj = projectMap[code];
      proj.total_parcelas++;
      proj.valor_total += Number(p.valor) || 0;
      if (p.statusFinanceiro.value === 'faturado') proj.parcelas_faturadas++;
      if (!p.isVinculado && !p.isRecebido && !p.parcelaSemCronograma) proj.parcelas_sem_vinculacao++;

      if (p.gerenteEmail && !proj.gerente_email) proj.gerente_email = p.gerenteEmail;

      if (p.statusFinanceiro.value !== 'faturado') {
        const dateStr = p.dataPagamentoCalculada || p.dataPagamentoManual;
        if (dateStr) {
          const d = new Date(dateStr);
          if (d >= now && (!proj.proximo_pagamento || d < new Date(proj.proximo_pagamento))) {
            proj.proximo_pagamento = dateStr;
          }
        }
      }
    }

    return Object.values(projectMap).sort((a, b) => a.project_code.localeCompare(b.project_code));
  }
}

export { ListAllProjectsSummary };
