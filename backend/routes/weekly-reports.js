/**
 * Rotas de Relatórios Semanais (DDD)
 *
 * Implementa as rotas usando a arquitetura DDD com use cases.
 */

import express from 'express';
import { SupabaseWeeklyReportRepository } from '../infrastructure/repositories/SupabaseWeeklyReportRepository.js';
import {
  CheckProjectReadiness,
  GenerateWeeklyReport,
  ListWeeklyReports,
  GetWeeklyReportStats,
  GetReportStatus,
} from '../application/use-cases/weekly-reports/index.js';

const router = express.Router();

let reportRepository = null;

function getRepository() {
  if (!reportRepository) {
    reportRepository = new SupabaseWeeklyReportRepository();
  }
  return reportRepository;
}

/**
 * @param {Function} requireAuth
 * @param {Function} isPrivileged
 * @param {Function} logAction
 * @param {Object} bigqueryClient - Módulo bigquery.js com as funções de consulta
 * @param {Object} reportGenerator - Serviço de geração de relatórios
 */
function createRoutes(requireAuth, isPrivileged, logAction, bigqueryClient, reportGenerator) {
  const repository = getRepository();

  /**
   * GET /api/weekly-reports/readiness/:projectCode
   * Verifica prontidão de dados para gerar relatório
   */
  router.get('/readiness/:projectCode', requireAuth, async (req, res) => {
    try {
      const { projectCode } = req.params;

      // Busca dados do projeto no portfolio (BigQuery)
      const portfolio = await bigqueryClient.queryPortfolio();
      const project = portfolio.find(p =>
        p.project_code_norm === projectCode || p.project_code === projectCode
      );

      if (!project) {
        return res.status(404).json({
          success: false,
          error: 'Projeto não encontrado no portfolio',
        });
      }

      const checkReadiness = new CheckProjectReadiness(bigqueryClient);
      const result = await checkReadiness.execute({
        construflowId: project.construflow_id,
        smartsheetId: project.smartsheet_id,
        driveFolderId: project.pasta_emails_id || project.drive_folder_id,
        clientEmails: project.client_emails ? project.client_emails.split(',').map(e => e.trim()) : [],
        teamEmails: project.team_emails ? project.team_emails.split(',').map(e => e.trim()) : [],
      });

      res.json({
        success: true,
        data: {
          ...result,
          project: {
            code: projectCode,
            name: project.nome_comercial || project.project_name,
            construflow_id: project.construflow_id,
            smartsheet_id: project.smartsheet_id,
            relatorio_semanal_status: project.relatorio_semanal_status,
          },
        },
      });
    } catch (error) {
      console.error('[WeeklyReports] Erro ao verificar prontidão:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao verificar prontidão',
      });
    }
  });

  /**
   * POST /api/weekly-reports/generate
   * Inicia geração de relatório semanal
   */
  router.post('/generate', requireAuth, async (req, res) => {
    try {
      const { projectCode, options = {} } = req.body;

      if (!projectCode) {
        return res.status(400).json({
          success: false,
          error: 'Código do projeto é obrigatório',
        });
      }

      // Busca dados do projeto
      const portfolio = await bigqueryClient.queryPortfolio();
      const project = portfolio.find(p =>
        p.project_code_norm === projectCode || p.project_code === projectCode
      );

      if (!project) {
        return res.status(404).json({
          success: false,
          error: 'Projeto não encontrado',
        });
      }

      const generateReport = new GenerateWeeklyReport(repository, bigqueryClient, reportGenerator);
      const result = await generateReport.execute({
        projectCode,
        projectName: project.nome_comercial || project.project_name,
        construflowId: project.construflow_id,
        smartsheetId: project.smartsheet_id,
        generatedBy: req.user.email || req.user.id,
        userId: req.user.id,
        options: {
          scheduleDays: options.scheduleDays || 15,
          hideDashboard: options.hideDashboard || false,
          clientDisciplines: project.construflow_disciplinasclientes
            ? project.construflow_disciplinasclientes.split(/[,;]/).map(d => d.trim()).filter(Boolean)
            : [],
          driveFolderId: project.pasta_emails_id || project.drive_folder_id,
          clientEmails: project.client_emails ? project.client_emails.split(',').map(e => e.trim()) : [],
          teamEmails: project.team_emails ? project.team_emails.split(',').map(e => e.trim()) : [],
          ganttUrl: project.gantt_email_url,
          disciplinaUrl: project.disciplina_email_url,
        },
      });

      if (logAction) {
        await logAction(req, 'create', 'weekly_report', result.id, 'Relatório semanal gerado', {
          projectCode,
          weekKey: result.week_key,
        });
      }

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('[WeeklyReports] Erro ao gerar relatório:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao gerar relatório',
      });
    }
  });

  /**
   * GET /api/weekly-reports/status/:reportId
   * Retorna status de um relatório em geração (para polling)
   */
  router.get('/status/:reportId', requireAuth, async (req, res) => {
    try {
      const { reportId } = req.params;
      const getStatus = new GetReportStatus(repository);
      const result = await getStatus.execute(reportId);

      if (!result) {
        return res.status(404).json({
          success: false,
          error: 'Relatório não encontrado',
        });
      }

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('[WeeklyReports] Erro ao buscar status:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao buscar status',
      });
    }
  });

  /**
   * GET /api/weekly-reports/history/:projectCode
   * Lista relatórios anteriores de um projeto
   */
  router.get('/history/:projectCode', requireAuth, async (req, res) => {
    try {
      const { projectCode } = req.params;
      const limit = parseInt(req.query.limit) || 10;

      const listReports = new ListWeeklyReports(repository);
      const reports = await listReports.execute({ projectCode, limit });

      res.json({
        success: true,
        data: reports,
      });
    } catch (error) {
      console.error('[WeeklyReports] Erro ao listar histórico:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao listar histórico',
      });
    }
  });

  /**
   * GET /api/weekly-reports/stats
   * Retorna KPIs de cobertura de relatórios (para dashboard)
   */
  router.get('/stats', requireAuth, async (req, res) => {
    try {
      const weeks = parseInt(req.query.weeks) || 12;
      const leaderName = req.query.leader || null;

      const getStats = new GetWeeklyReportStats(repository, bigqueryClient);
      const stats = await getStats.execute({ weeks, leaderName });

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error('[WeeklyReports] Erro ao buscar estatísticas:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao buscar estatísticas',
      });
    }
  });

  return router;
}

export { createRoutes };
export default router;
