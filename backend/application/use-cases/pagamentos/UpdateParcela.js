class UpdateParcela {
  #repository;

  constructor(repository) {
    this.#repository = repository;
  }

  async execute({ id, descricao, valor, origem, fase, statusProjetos, statusFinanceiro, comentarioFinanceiro, comentarioProjetos, dataPagamentoManual, parcelaSemCronograma, gerenteEmail, tipoServico, dilatacaoDias }) {
    const parcela = await this.#repository.findParcelaById(id);
    if (!parcela) throw new Error('Parcela nao encontrada');

    if (statusProjetos !== undefined) {
      parcela.atualizarStatusProjetos(statusProjetos);
    }

    if (statusFinanceiro !== undefined) {
      parcela.atualizarStatusFinanceiro(statusFinanceiro);
    }

    parcela.updateFields({
      descricao,
      valor,
      origem,
      fase,
      comentarioFinanceiro,
      comentarioProjetos,
      dataPagamentoManual,
      parcelaSemCronograma,
      gerenteEmail,
      tipoServico,
      dilatacaoDias,
    });

    const updated = await this.#repository.updateParcela(parcela);
    return updated.toResponse();
  }
}

export { UpdateParcela };
