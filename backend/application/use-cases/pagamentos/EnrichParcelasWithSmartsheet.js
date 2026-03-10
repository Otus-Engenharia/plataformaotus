import { sendCronogramaChangeNotification } from '../../../discord.js';
import { getLeaderNameFromEmail } from '../../../auth-config.js';

function formatDateForDiscord(val) {
  if (!val) return null;
  if (typeof val === 'object' && val.value) return formatDateStr(val.value);
  if (val instanceof Date) return val.toLocaleDateString('pt-BR');
  const str = String(val);
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return formatDateStr(str);
  return str;
}

function formatDateStr(isoStr) {
  const [y, m, d] = isoStr.split('T')[0].split('-');
  return `${d}/${m}/${y}`;
}

class EnrichParcelasWithSmartsheet {
  #repository;
  #notificationService;

  constructor(repository, notificationService) {
    this.#repository = repository;
    this.#notificationService = notificationService;
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
    const discordNotifications = [];

    // Resolver líder a partir do email do gerente
    const gerenteEmail = parcelas.find(p => p.gerenteEmail)?.gerenteEmail;
    const lider = gerenteEmail ? getLeaderNameFromEmail(gerenteEmail) : null;

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
          const currentDataTermino = task.DataDeTermino || null;
          response.smartsheet_status = task.Status || null;
          response.smartsheet_data_termino = currentDataTermino;

          const mudou = parcela.detectarMudancaCronograma(currentDataTermino);

          if (mudou) {
            changeLogEntries.push({
              parcela_id: parcela.id,
              project_code: projectCode,
              action: 'smartsheet_change',
              field_changed: 'data_termino',
              old_value: parcela.lastSmartsheetDataTermino ? String(parcela.lastSmartsheetDataTermino) : null,
              new_value: currentDataTermino ? String(currentDataTermino) : null,
              edited_by_email: 'sistema',
              edited_by_name: 'Smartsheet Sync',
            });

            parcela.marcarAlertaCronograma('data_alterada');

            discordNotifications.push({
              projectCode,
              projectName,
              lider,
              parcelaNumero: parcela.parcelaNumero,
              descricao: parcela.descricao,
              changeType: 'cronograma_data_alterada',
              oldValue: formatDateForDiscord(parcela.lastSmartsheetDataTermino),
              newValue: formatDateForDiscord(currentDataTermino),
            });

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

            discordNotifications.push({
              projectCode,
              projectName,
              lider,
              parcelaNumero: parcela.parcelaNumero,
              descricao: parcela.descricao,
              changeType: 'cronograma_tarefa_deletada',
              oldValue: parcela.smartsheetTaskName || 'Tarefa removida',
            });
          }
        }
      }

      enrichedResults.push(response);
    }

    // Save changes in background
    if (changeLogEntries.length > 0) {
      this.#repository.saveChangeLogBatch(changeLogEntries)
        .catch(err => console.error('Erro ao salvar change log parcelas:', err));

      // Notify financeiro and leader about changes (in-app)
      if (this.#notificationService) {
        const financeiroEmails = await this.#notificationService.getFinanceiroEmails();
        const leaderEmails = [...new Set(parcelas.map(p => p.gerenteEmail).filter(Boolean))];
        const allEmails = [...new Set([...financeiroEmails, ...leaderEmails])];

        if (allEmails.length > 0) {
          this.#notificationService.notifyMultiple(
            allEmails,
            'cronograma_alterado',
            'Cronograma alterado',
            `Datas de parcelas do projeto ${projectCode} foram alteradas no Smartsheet.`,
            'parcela',
            null,
            `/pagamentos?project=${projectCode}`
          ).catch(err => console.error('Erro ao notificar mudanca cronograma:', err));
        }
      }
    }

    // Discord notifications
    for (const notif of discordNotifications) {
      sendCronogramaChangeNotification(notif)
        .catch(err => console.error('Erro ao enviar Discord cronograma:', err));
    }

    for (const parcela of parcelaUpdates) {
      this.#repository.updateParcela(parcela)
        .catch(err => console.error('Erro ao atualizar parcela (enriched):', err));
    }

    return enrichedResults;
  }
}

export { EnrichParcelasWithSmartsheet };
