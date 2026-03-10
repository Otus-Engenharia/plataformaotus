const ACTIVE_STATUSES = ['planejamento', 'fase 01', 'fase 02', 'fase 03', 'fase 04'];

class GetDashboardKpis {
  #repository;

  constructor(repository) {
    this.#repository = repository;
  }

  async execute() {
    const [countsByStatus, sumsByStatus, projectCodesWithParcelas, spotProjects, allParcelas] = await Promise.all([
      this.#repository.countParcelasByStatusFinanceiro(),
      this.#repository.sumValorByStatusFinanceiro(),
      this.#repository.getProjectCodesWithParcelas(),
      this.#repository.getAllSpotProjects(),
      this.#repository.findAllParcelas(),
    ]);

    const parcelasWithCodesSet = new Set(projectCodesWithParcelas);

    // Active spot projects without any parcelas
    const projetosAtivosSemParcelas = spotProjects.filter(
      p => ACTIVE_STATUSES.includes(p.status) && !parcelasWithCodesSet.has(p.project_code)
    ).length;

    // Parcelas sem vinculacao: não vinculadas ao Smartsheet, não recebidas, não isentas
    const parcelasSemVinculacao = allParcelas.filter(p =>
      !p.isVinculado && !p.isRecebido && !p.parcelaSemCronograma
    ).length;

    // Valor pendente (all except faturado)
    const valorPendente = Object.entries(sumsByStatus)
      .filter(([status]) => status !== 'faturado')
      .reduce((sum, [, val]) => sum + val, 0);

    const valorFaturado = sumsByStatus['faturado'] || 0;

    // Proximos 30 dias
    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const proximos30Dias = allParcelas.filter(p => {
      if (p.statusFinanceiro.value === 'faturado') return false;
      const dateStr = p.dataPagamentoCalculada || p.dataPagamentoManual;
      if (!dateStr) return false;
      const d = new Date(dateStr);
      return d >= now && d <= in30Days;
    }).length;

    const totalParcelas = Object.values(countsByStatus).reduce((s, c) => s + c, 0);

    return {
      projetos_ativos_sem_parcelas: projetosAtivosSemParcelas,
      parcelas_sem_vinculacao: parcelasSemVinculacao,
      valor_pendente: valorPendente,
      valor_faturado: valorFaturado,
      proximos_30_dias: proximos30Dias,
      total_parcelas: totalParcelas,
      total_projetos_com_parcelas: projectCodesWithParcelas.length,
    };
  }
}

export { GetDashboardKpis };
