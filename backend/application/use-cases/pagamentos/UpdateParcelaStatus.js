class UpdateParcelaStatus {
  #repository;

  constructor(repository) {
    this.#repository = repository;
  }

  async execute({ id, field, value, editedByEmail, editedByName }) {
    const parcela = await this.#repository.findParcelaById(id);
    if (!parcela) throw new Error('Parcela nao encontrada');

    let oldValue;

    if (field === 'projetos') {
      oldValue = parcela.statusProjetos.value;
      parcela.atualizarStatusProjetos(value);
    } else if (field === 'financeiro') {
      oldValue = parcela.statusFinanceiro.value;
      parcela.atualizarStatusFinanceiro(value);
    } else {
      throw new Error(`Campo de status invalido: "${field}". Use "projetos" ou "financeiro".`);
    }

    const updated = await this.#repository.updateParcela(parcela);

    // Log the change
    const fieldName = field === 'projetos' ? 'status_projetos' : 'status_financeiro';
    await this.#repository.saveChangeLog({
      parcela_id: parcela.id,
      project_code: parcela.projectCode,
      action: 'status_change',
      field_changed: fieldName,
      old_value: oldValue,
      new_value: value,
      edited_by_email: editedByEmail || 'sistema',
      edited_by_name: editedByName || editedByEmail || 'Sistema',
    });

    return updated.toResponse();
  }
}

export { UpdateParcelaStatus };
