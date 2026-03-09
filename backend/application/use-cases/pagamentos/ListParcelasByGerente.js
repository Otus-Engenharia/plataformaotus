class ListParcelasByGerente {
  #repository;

  constructor(repository) {
    this.#repository = repository;
  }

  async execute({ email }) {
    const parcelas = await this.#repository.findParcelasByGerente(email);

    const projectMap = {};
    const now = new Date();

    for (const p of parcelas) {
      const code = p.projectCode;
      if (!projectMap[code]) {
        projectMap[code] = {
          project_code: code,
          company_name: p.companyId || '',
          gerente_email: email,
          total_parcelas: 0,
          valor_total: 0,
          parcelas_recebidas: 0,
          parcelas_sem_vinculacao: 0,
          proximo_pagamento: null,
        };
      }
      const proj = projectMap[code];
      proj.total_parcelas++;
      proj.valor_total += Number(p.valor) || 0;
      if (p.statusFinanceiro.value === 'recebido') proj.parcelas_recebidas++;
      if (!p.isVinculado && !p.isRecebido && !p.parcelaSemCronograma) proj.parcelas_sem_vinculacao++;

      if (p.statusFinanceiro.value !== 'recebido') {
        const dateStr = p.dataPagamentoCalculada || p.dataPagamentoManual;
        if (dateStr) {
          const d = new Date(dateStr);
          if (d >= now && (!proj.proximo_pagamento || d < new Date(proj.proximo_pagamento))) {
            proj.proximo_pagamento = dateStr;
          }
        }
      }
    }

    // Enrich with tipo_pagamento + project data
    const projectCodes = Object.keys(projectMap);
    if (projectCodes.length > 0) {
      const [tipoPagamentoMap, projectDataMap] = await Promise.all([
        this.#repository.getTipoPagamentoByProjectCodes(projectCodes),
        this.#repository.getProjectDataByProjectCodes(projectCodes),
      ]);
      for (const code of projectCodes) {
        projectMap[code].tipo_pagamento = tipoPagamentoMap[code] || 'spot';
        const pd = projectDataMap[code];
        if (pd) {
          projectMap[code].project_name = pd.project_name || '';
          projectMap[code].status = pd.status || '';
          if (!projectMap[code].company_name && pd.company_name) {
            projectMap[code].company_name = pd.company_name;
          }
        }
      }
    }

    return Object.values(projectMap).sort((a, b) => a.project_code.localeCompare(b.project_code));
  }
}

export { ListParcelasByGerente };
