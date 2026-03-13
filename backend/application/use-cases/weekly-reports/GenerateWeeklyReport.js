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

import { WeeklyReport } from '../../../domain/weekly-reports/entities/WeeklyReport.js';
import { PipelineStepEnum } from '../../../domain/weekly-reports/value-objects/PipelineStep.js';
import { SupabaseRelatoRepository } from '../../../infrastructure/repositories/SupabaseRelatoRepository.js';
import { fetchDriveImageAsBase64 } from '../../../services/weekly-report-generator.js';

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
  async execute({ projectCode, projectName, construflowId, smartsheetId, generatedBy, userId, options = {}, force = false }) {
    // Calcula semana ISO atual
    const now = new Date();
    const { weekNumber, weekYear } = GenerateWeeklyReport.#getISOWeek(now);

    // Previne duplicatas: se já existe report para este projeto/semana, retorna o existente
    // Com force=true, marca o existente como substituído e prossegue com nova geração
    const alreadyExists = await this.#reportRepository.existsForProjectWeek(
      projectCode, weekYear, weekNumber
    );
    if (alreadyExists) {
      const existing = await this.#reportRepository.findByWeek(weekYear, weekNumber);
      const match = existing.find(r => r.projectCode === projectCode);
      if (match) {
        if (!force) return match.toResponse();
        match.markReplaced();
        await this.#reportRepository.update(match);
      }
    }

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
      weekText: saved.weekText,
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
    const warnings = [];

    const {
      construflowId,
      smartsheetId,
      projectCode,
      projectName,
      userId,
      weekText = '',
      scheduleDays = 15,
      hideDashboard = false,
      clientDisciplines = [],
      driveFolderId,
      clientEmails = [],
      teamEmails = [],
      leaderEmail = null,
      otusTeamEmails = [],
      ganttUrl,
      disciplinaUrl,
      capaEmailUrl,
      relatosDias = 7,
    } = config;

    const startTime = Date.now();

    // Step 1: Buscar dados
    await this.#updateStep(reportId, PipelineStepEnum.FETCHING_DATA);
    await this.#addLog(reportId, 'Iniciando geração do relatório...');
    await this.#addLog(reportId, `Projeto: ${projectName} (${projectCode})`);
    await this.#addLog(reportId, 'Consultando BigQuery (issues e tarefas)...');
    const rawData = await this.#bigqueryClient.queryWeeklyReportData(construflowId, smartsheetId, {
      scheduleDays,
      projectCode,
    });
    await this.#addLog(reportId, `Dados recebidos: ${rawData?.tasks?.length ?? 0} tarefas, ${rawData?.issues?.length ?? 0} issues`);
    if (rawData.usedSnapshotFallback) {
      const snapshotMsg = `Dados do cronograma são do snapshot de ${rawData.snapshotDate || 'data desconhecida'} — Smartsheet pode estar desatualizado`;
      await this.#addLog(reportId, `AVISO: ${snapshotMsg}`);
      warnings.push(snapshotMsg);
    }

    // Step 2: Processar dados
    await this.#updateStep(reportId, PipelineStepEnum.PROCESSING);
    await this.#addLog(reportId, 'Processando dados e aplicando filtros...');
    const processedData = this.#reportGenerator.processData(rawData, {
      clientDisciplines,
      scheduleDays,
    });
    const issueCount = processedData.summary?.totalActiveIssues || processedData.construflow?.totalActive || 0;
    const taskCount = processedData.summary?.totalTasks || 0;
    const s = processedData.summary || {};
    await this.#addLog(reportId, `Processado: ${taskCount} tarefas (${s.totalCompleted || 0} concluídas, ${s.totalDelayed || 0} atrasadas, ${(s.scheduleClient || 0) + (s.scheduleTeam || 0)} cronograma), ${issueCount} issues ativas`);

    // Step 2b: Buscar relatos da semana (não bloqueante)
    let weekRelatos = [];
    let tiposMap = {};
    let prioridadesMap = {};
    try {
      await this.#addLog(reportId, 'Buscando relatos da semana...');
      const relatoRepo = new SupabaseRelatoRepository();
      const [allRelatos, tipos, prioridades] = await Promise.all([
        relatoRepo.findByProjectCode(projectCode),
        relatoRepo.findAllTipos(),
        relatoRepo.findAllPrioridades(),
      ]);

      const sinceDate = new Date(Date.now() - relatosDias * 86400000);
      weekRelatos = allRelatos.filter(r => new Date(r.createdAt) >= sinceDate);
      tiposMap = Object.fromEntries(tipos.map(t => [t.slug, { label: t.label, color: t.color }]));
      prioridadesMap = Object.fromEntries(prioridades.map(p => [p.slug, { label: p.label, color: p.color }]));
      await this.#addLog(reportId, `${weekRelatos.length} relatos encontrados nos últimos ${relatosDias} dias`);
    } catch (err) {
      console.warn('[WeeklyReport] Erro ao buscar relatos (não bloqueante):', err.message);
      await this.#addLog(reportId, 'Aviso: não foi possível buscar relatos');
    }

    // Step 2c: Buscar imagem da capa (não bloqueante)
    let projectImageBase64 = null;
    if (capaEmailUrl) {
      try {
        await this.#addLog(reportId, 'Buscando imagem da capa do Google Drive...');
        projectImageBase64 = await fetchDriveImageAsBase64(capaEmailUrl);
        await this.#addLog(reportId, projectImageBase64 ? 'Imagem da capa carregada' : 'Não foi possível carregar imagem da capa');
      } catch (err) {
        console.warn('[WeeklyReport] Erro ao buscar imagem da capa:', err.message);
        await this.#addLog(reportId, 'Aviso: erro ao buscar imagem da capa');
      }
    }

    // Step 3: Gerar HTML
    await this.#updateStep(reportId, PipelineStepEnum.GENERATING_HTML);
    await this.#addLog(reportId, 'Gerando HTML (versão cliente + equipe)...');
    const { clientHtml, teamHtml } = this.#reportGenerator.generateHtml(processedData, {
      projectName,
      hideDashboard,
      ganttUrl,
      disciplinaUrl,
      projectImageBase64,
      relatos: weekRelatos,
      tiposMap,
      prioridadesMap,
    });
    await this.#addLog(reportId, 'Relatórios HTML gerados com sucesso');

    // Step 4: Upload Drive
    let clientDriveUrl = null;
    let teamDriveUrl = null;
    if (driveFolderId) {
      await this.#updateStep(reportId, PipelineStepEnum.UPLOADING_DRIVE);
      await this.#addLog(reportId, 'Enviando relatórios para Google Drive...');
      const driveResults = await this.#reportGenerator.uploadToDrive(clientHtml, teamHtml, {
        projectName,
        driveFolderId,
      });
      clientDriveUrl = driveResults.clientUrl;
      teamDriveUrl = driveResults.teamUrl;
      await this.#addLog(reportId, 'Upload no Drive concluído');
    } else {
      await this.#addLog(reportId, 'Sem pasta do Drive configurada — pulando upload');
    }

    // Step 5: Criar rascunhos Gmail
    let clientDraftUrl = null;
    let teamDraftUrl = null;
    if (clientEmails.length === 0) {
      const msg = 'Sem emails de cliente cadastrados — rascunho do cliente não será criado. Cadastre contatos na aba Equipe do projeto.';
      await this.#addLog(reportId, msg);
      warnings.push(msg);
    }
    if (teamEmails.length === 0) {
      const msg = 'Sem emails de projetistas cadastrados — rascunho da equipe não será criado.';
      await this.#addLog(reportId, msg);
      warnings.push(msg);
    }
    if (clientEmails.length > 0 || teamEmails.length > 0) {
      await this.#updateStep(reportId, PipelineStepEnum.CREATING_DRAFTS);
      await this.#addLog(reportId, 'Criando rascunhos no Gmail...');
      const draftResults = await this.#reportGenerator.createGmailDrafts(clientHtml, teamHtml, {
        projectName,
        clientEmails,
        teamEmails,
        leaderEmail,
        otusTeamEmails,
        userId,
        weekText,
      });
      clientDraftUrl = draftResults.clientDraftUrl;
      teamDraftUrl = draftResults.teamDraftUrl;
      await this.#addLog(reportId, `Rascunhos criados (${clientEmails.length} cliente, ${teamEmails.length} equipe)`);
    } else {
      await this.#addLog(reportId, 'Sem emails configurados — pulando rascunhos');
    }

    // Finalizar
    const durationMs = Date.now() - startTime;
    const durationSec = Math.round(durationMs / 1000);
    await this.#addLog(reportId, `Relatório concluído em ${durationSec}s`);

    const report = await this.#reportRepository.findById(reportId);
    report.complete({
      clientReportDriveUrl: clientDriveUrl,
      teamReportDriveUrl: teamDriveUrl,
      clientDraftUrl,
      teamDraftUrl,
      metadata: {
        issueCount,
        taskCount,
        clientDisciplines,
        scheduleDays,
        duration: durationMs,
        warnings,
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

  async #addLog(reportId, message) {
    try {
      const report = await this.#reportRepository.findById(reportId);
      if (report) {
        report.addLog(message);
        await this.#reportRepository.update(report);
      }
    } catch (err) {
      console.error('[WeeklyReport] Erro ao adicionar log:', err.message);
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
