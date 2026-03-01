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
import { fetchProjectClientContacts, fetchProjectDisciplines, fetchUserTeamName, fetchUserTeamId, fetchActiveProjectsByTeam, fetchReportEnabledByTeam } from '../supabase.js';
import { hasFullAccess } from '../auth-config.js';

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
   * GET /api/weekly-reports/prerequisites/:projectCode
   * Valida os 9 campos obrigatórios para ativar o relatório semanal
   */
  router.get('/prerequisites/:projectCode', requireAuth, async (req, res) => {
    try {
      const { projectCode } = req.params;

      const portfolio = await bigqueryClient.queryPortfolio();
      const project = portfolio.find(p =>
        p.project_code_norm === projectCode || p.project_code === projectCode
      );

      if (!project) {
        return res.status(404).json({ success: false, error: 'Projeto não encontrado' });
      }

      // 7 campos do portfolio (BigQuery)
      const portfolioFields = [
        { key: 'construflow_id', label: 'Construflow ID' },
        { key: 'smartsheet_id', label: 'Smartsheet ID' },
        { key: 'pasta_emails_id', label: 'Pasta Emails ID' },
        { key: 'capa_email_url', label: 'Capa Email URL' },
        { key: 'gantt_email_url', label: 'Gantt Email URL' },
        { key: 'disciplina_email_url', label: 'Disciplina Email URL' },
        { key: 'construflow_disciplinasclientes', label: 'Disciplinas Cliente' },
      ];

      const fields = portfolioFields.map(f => ({
        key: f.key,
        label: f.label,
        filled: !!(project[f.key] && String(project[f.key]).trim()),
        location: 'ferramentas',
      }));

      // 8. Emails do cliente (Supabase - contatos ativos com email)
      let clientEmailCount = 0;
      try {
        const clientData = await fetchProjectClientContacts(projectCode);
        const activeContacts = (clientData.allContacts || []).filter(c =>
          clientData.assignedIds.includes(c.id) && c.email && c.email.includes('@')
        );
        clientEmailCount = activeContacts.length;
      } catch (err) {
        console.warn('[Prerequisites] Erro ao buscar contatos do cliente:', err.message);
      }

      fields.push({
        key: 'emails_cliente',
        label: 'Emails do Cliente',
        filled: clientEmailCount > 0,
        count: clientEmailCount,
        location: 'equipe',
      });

      // 9. Emails dos projetistas (Supabase - disciplinas com email)
      let projetistaEmailCount = 0;
      try {
        if (project.construflow_id) {
          const disciplines = await fetchProjectDisciplines(project.construflow_id);
          const withEmail = disciplines.filter(d =>
            (d.email && d.email.includes('@')) || (d.contact?.email && d.contact.email.includes('@'))
          );
          projetistaEmailCount = withEmail.length;
        }
      } catch (err) {
        console.warn('[Prerequisites] Erro ao buscar disciplinas:', err.message);
      }

      fields.push({
        key: 'emails_projetistas',
        label: 'Emails dos Projetistas',
        filled: projetistaEmailCount > 0,
        count: projetistaEmailCount,
        location: 'equipe',
      });

      const missingFields = fields
        .filter(f => !f.filled)
        .map(f => ({ label: f.label, location: f.location }));

      res.json({
        success: true,
        data: {
          canActivate: missingFields.length === 0,
          fields,
          missingFields,
        },
      });
    } catch (error) {
      console.error('[WeeklyReports] Erro ao verificar pré-requisitos:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao verificar pré-requisitos',
      });
    }
  });

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

      // Resolver teamId e nomeTime baseado no time do usuário logado
      let teamId = null;
      let nomeTime = null;

      if (!hasFullAccess(req.user)) {
        teamId = await fetchUserTeamId(req.user?.email);
        if (!teamId) {
          return res.json({
            success: true,
            data: {
              summary: {
                currentPctEnabled: 0, currentPctSent: 0,
                totalAllActive: 0, totalReportEnabled: 0, totalReportsSent: 0,
                deltaPctEnabled: 0, deltaPctSent: 0,
                trendEnabled: 'stable', trendSent: 'stable',
              },
              weeks: [],
              missingCurrentWeek: [],
            },
          });
        }
        // nomeTime ainda necessário para snapshots e relatórios históricos
        const teamName = await fetchUserTeamName(req.user?.email);
        if (teamName) {
          nomeTime = await bigqueryClient.queryNomeTimeByTeamName(teamName);
        }
      }

      // Buscar projetos do Supabase (tempo real)
      const allActiveProjects = await fetchActiveProjectsByTeam(teamId);
      const reportEnabledProjects = await fetchReportEnabledByTeam(teamId);

      const getStats = new GetWeeklyReportStats(repository, bigqueryClient);
      const stats = await getStats.execute({
        weeks,
        nomeTime,
        allActiveProjects,
        reportEnabledProjects,
      });

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
