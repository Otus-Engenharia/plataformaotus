class EnrichParcelasWithSmartsheet {
  #repository;

  constructor(repository) {
    this.#repository = repository;
  }

  async execute({ projectCode, smartsheetId, projectName, bigqueryClient }) {
    if (!projectCode) throw new Error('projectCode e obrigatorio');

    const parcelas = await this.#repository.findParcelasByProject(projectCode);
    if (!parcelas || parcelas.length === 0) return [];

    // If no BigQuery params, return simple responses
    if ((!smartsheetId && !projectName) || !bigqueryClient?.queryCronograma) {
      return parcelas.map(p => p.toResponse());
    }

    // Fetch tasks from BigQuery
    let tasks = [];
    try {
      tasks = await bigqueryClient.queryCronograma(smartsheetId || null, projectName || null);
    } catch (bqErr) {
      console.error('Erro ao buscar cronograma para enriquecimento de parcelas:', bqErr);
      return parcelas.map(p => p.toResponse());
    }

    const tasksByRowId = new Map();
    tasks.forEach(t => {
      if (t.rowId) tasksByRowId.set(String(t.rowId), t);
    });

    // Load regra for recalculation
    let regra = null;
    const firstWithCompany = parcelas.find(p => p.companyId);
    if (firstWithCompany) {
      regra = await this.#repository.findRegraByCompanyId(firstWithCompany.companyId);
    }

    const enrichedResults = [];
    const changeLogEntries = [];
    const parcelaUpdates = [];

    for (const parcela of parcelas) {
      const response = parcela.toResponse();

      // Phase 5: Compute data_limite_solicitacao from regra
      if (regra && parcela.smartsheetDataTermino) {
        const dataTermino = new Date(parcela.smartsheetDataTermino);
        const totalDias = regra.totalDias || 0;
        if (totalDias > 0) {
          const dataLimite = new Date(dataTermino);
          dataLimite.setDate(dataLimite.getDate() - totalDias);
          response.data_limite_solicitacao = dataLimite.toISOString().split('T')[0];
        }
      }

      if (parcela.smartsheetRowId) {
        const task = tasksByRowId.get(String(parcela.smartsheetRowId));

        if (task) {
          const rawDataTermino = task.DataDeTermino || null;
          const currentDataTermino = rawDataTermino && typeof rawDataTermino === 'object' && rawDataTermino.value != null
            ? String(rawDataTermino.value) : (rawDataTermino ? String(rawDataTermino) : null);
          response.smartsheet_status = task.Status || null;
          response.smartsheet_data_termino = currentDataTermino;

          const mudou = parcela.detectarMudancaCronograma(currentDataTermino);

          if (mudou) {
            changeLogEntries.push({
              parcela_id: parcela.id,
              project_code: projectCode,
              action: 'smartsheet_change',
              field_changed: 'data_termino',
              old_value: (() => {
                const v = parcela.lastSmartsheetDataTermino;
                if (!v) return null;
                return typeof v === 'object' && v.value != null ? String(v.value) : String(v);
              })(),
              new_value: currentDataTermino,
              edited_by_email: 'sistema',
              edited_by_name: 'Smartsheet Sync',
            });

            parcela.marcarAlertaCronograma('data_alterada');

            if (regra) {
              parcela.calcularDataPagamento(regra);
              response.data_pagamento_calculada = parcela.dataPagamentoCalculada;
              response.data_pagamento_efetiva = parcela.dataPagamentoEfetiva;
            }

            parcelaUpdates.push(parcela);
          }
        } else {
          // Tarefa deletada do cronograma
          response.smartsheet_status = null;
          response.smartsheet_data_termino = null;

          // Só marcar alerta se ainda não tem (evitar re-notificar)
          if (parcela.alertaCronograma !== 'tarefa_deletada') {
            changeLogEntries.push({
              parcela_id: parcela.id,
              project_code: projectCode,
              action: 'tarefa_deletada',
              field_changed: 'smartsheet_task_name',
              old_value: parcela.smartsheetTaskName || null,
              new_value: null,
              edited_by_email: 'sistema',
              edited_by_name: 'Smartsheet Sync',
            });

            parcela.marcarAlertaCronograma('tarefa_deletada');
            parcelaUpdates.push(parcela);
          }
        }
      }

      enrichedResults.push(response);
    }

    // Save changes in background
    if (changeLogEntries.length > 0) {
      this.#repository.saveChangeLogBatch(changeLogEntries)
        .catch(err => console.error('Erro ao salvar change log parcelas:', err));

    }

    for (const parcela of parcelaUpdates) {
      this.#repository.updateParcela(parcela)
        .catch(err => console.error('Erro ao atualizar parcela (enriched):', err));
    }

    return enrichedResults;
  }
}

export { EnrichParcelasWithSmartsheet };
