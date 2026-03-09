class VincularParcela {
  #repository;
  #notificationService;

  constructor(repository, notificationService) {
    this.#repository = repository;
    this.#notificationService = notificationService;
  }

  async execute({ id, rowId, taskName, dataTermino }) {
    const parcela = await this.#repository.findParcelaById(id);
    if (!parcela) throw new Error('Parcela nao encontrada');

    parcela.vincularTarefa(rowId, taskName, dataTermino);

    // Recalculate payment date if company has a rule
    if (parcela.companyId) {
      const regra = await this.#repository.findRegraByCompanyId(parcela.companyId);
      if (regra) {
        parcela.calcularDataPagamento(regra);
      }
    }

    const updated = await this.#repository.updateParcela(parcela);

    if (this.#notificationService) {
      const financeiroEmails = await this.#notificationService.getFinanceiroEmails();
      if (financeiroEmails.length > 0) {
        this.#notificationService.notifyMultiple(
          financeiroEmails,
          'parcela_vinculada',
          'Parcela vinculada ao cronograma',
          `Parcela ${parcela.parcelaNumero} do projeto ${parcela.projectCode} foi vinculada a "${taskName}".`,
          'parcela',
          updated.id,
          `/pagamentos?project=${parcela.projectCode}`
        ).catch(err => console.error('Erro ao notificar financeiro:', err));
      }
    }

    return updated.toResponse();
  }
}

export { VincularParcela };
