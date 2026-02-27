/**
 * Use Case: GenerateWeeklyReport
 *
 * Orquestra a geração completa de um relatório semanal:
 * 1. Cria registro no banco (in_progress)
 * 2. Busca dados do BigQuery
 * 3. Processa dados (filtros, agrupamentos)
 * 4. Gera HTML dos relatórios (cliente + time)
 * 5. Faz upload no Google Drive
 * 6. Cria rascunhos no Gmail
 * 7. Atualiza registro como completed
 *
 * Cada etapa atualiza o current_step para feedback em tempo real.
 */

import { WeeklyReport } from '../../domain/weekly-reports/entities/WeeklyReport.js';
import { PipelineStepEnum } from '../../domain/weekly-reports/value-objects/PipelineStep.js';

class GenerateWeeklyReport {
  #reportRepository;
  #bigqueryClient;
  #reportGenerator;

  constructor(reportRepository, bigqueryClient, reportGenerator) {
    this.#reportRepository = reportRepository;
    this.#bigqueryClient = bigqueryClient;
    this.#reportGenerator = reportGenerator;
  }

  /**
   * @param {Object} params
   * @param {string} params.projectCode - Código do projeto
   * @param {string} params.projectName - Nome do projeto
   * @param {string} params.construflowId - ID do Construflow
   * @param {string} params.smartsheetId - ID do Smartsheet
   * @param {string} params.generatedBy - Email do usuário que disparou
   * @param {string} params.userId - ID do usuário (para Gmail OAuth)
   * @param {Object} params.options - Opções de geração
   * @param {number} params.options.scheduleDays - Dias para cronograma (default: 15)
   * @param {boolean} params.options.hideDashboard - Ocultar botão dashboard
   * @param {string[]} params.options.clientDisciplines - Disciplinas do cliente
   * @param {string} params.options.driveFolderId - Pasta no Drive
   * @param {string[]} params.options.clientEmails - Emails do cliente
   * @param {string[]} params.options.teamEmails - Emails da equipe
   * @param {string} params.options.ganttUrl - URL do cronograma
   * @param {string} params.options.disciplinaUrl - URL relatório disciplinas
   * @returns {Promise<Object>} relatório gerado
   */
  async execute({ projectCode, projectName, construflowId, smartsheetId, generatedBy, userId, options = {} }) {
    // Calcula semana ISO atual
    const now = new Date();
    const { weekNumber, weekYear } = GenerateWeeklyReport.#getISOWeek(now);

    // Cria registro no banco
    const report = WeeklyReport.create({
      projectCode,
      projectName,
      weekNumber,
      weekYear,
      generatedBy,
    });

    const saved = await this.#reportRepository.save(report);
    const reportId = saved.id;

    // Executa pipeline em background (não bloqueia a resposta)
    this.#executePipeline(reportId, {
      construflowId,
      smartsheetId,
      projectCode,
      projectName,
      userId,
      ...options,
    }).catch(async (err) => {
      console.error(`[WeeklyReport] Pipeline falhou para ${projectCode}:`, err);
      try {
        const failedReport = await this.#reportRepository.findById(reportId);
        if (failedReport && failedReport.isInProgress) {
          failedReport.fail(err.message);
          await this.#reportRepository.update(failedReport);
        }
      } catch (updateErr) {
        console.error('[WeeklyReport] Erro ao atualizar status de falha:', updateErr);
      }
    });

    // Retorna imediatamente com o ID para polling
    return saved.toResponse();
  }

  async #executePipeline(reportId, config) {
    const {
      construflowId,
      smartsheetId,
      projectCode,
      projectName,
      userId,
      scheduleDays = 15,
      hideDashboard = false,
      clientDisciplines = [],
      driveFolderId,
      clientEmails = [],
      teamEmails = [],
      ganttUrl,
      disciplinaUrl,
    } = config;

    // Step 1: Buscar dados
    await this.#updateStep(reportId, PipelineStepEnum.FETCHING_DATA);
    const rawData = await this.#bigqueryClient.queryWeeklyReportData(construflowId, smartsheetId, {
      scheduleDays,
    });

    // Step 2: Processar dados
    await this.#updateStep(reportId, PipelineStepEnum.PROCESSING);
    const processedData = this.#reportGenerator.processData(rawData, {
      clientDisciplines,
      scheduleDays,
    });

    // Step 3: Gerar HTML
    await this.#updateStep(reportId, PipelineStepEnum.GENERATING_HTML);
    const { clientHtml, teamHtml } = this.#reportGenerator.generateHtml(processedData, {
      projectName,
      hideDashboard,
      ganttUrl,
      disciplinaUrl,
    });

    // Step 4: Upload Drive
    let clientDriveUrl = null;
    let teamDriveUrl = null;
    if (driveFolderId) {
      await this.#updateStep(reportId, PipelineStepEnum.UPLOADING_DRIVE);
      const driveResults = await this.#reportGenerator.uploadToDrive(clientHtml, teamHtml, {
        projectName,
        driveFolderId,
      });
      clientDriveUrl = driveResults.clientUrl;
      teamDriveUrl = driveResults.teamUrl;
    }

    // Step 5: Criar rascunhos Gmail
    let clientDraftUrl = null;
    let teamDraftUrl = null;
    if (clientEmails.length > 0 || teamEmails.length > 0) {
      await this.#updateStep(reportId, PipelineStepEnum.CREATING_DRAFTS);
      const draftResults = await this.#reportGenerator.createGmailDrafts(clientHtml, teamHtml, {
        projectName,
        clientEmails,
        teamEmails,
        userId,
      });
      clientDraftUrl = draftResults.clientDraftUrl;
      teamDraftUrl = draftResults.teamDraftUrl;
    }

    // Finalizar
    const report = await this.#reportRepository.findById(reportId);
    report.complete({
      clientReportDriveUrl: clientDriveUrl,
      teamReportDriveUrl: teamDriveUrl,
      clientDraftUrl,
      teamDraftUrl,
      metadata: {
        issueCount: processedData.issueCount || 0,
        taskCount: processedData.taskCount || 0,
        clientDisciplines,
        scheduleDays,
        duration: Date.now() - new Date(report.createdAt).getTime(),
      },
    });
    await this.#reportRepository.update(report);
  }

  async #updateStep(reportId, step) {
    const report = await this.#reportRepository.findById(reportId);
    if (report && report.isInProgress) {
      report.advanceToStep(step);
      await this.#reportRepository.update(report);
    }
  }

  static #getISOWeek(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNumber = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return { weekNumber, weekYear: d.getUTCFullYear() };
  }
}

export { GenerateWeeklyReport };
