/**
 * Index de rotas da aplicação
 *
 * Centraliza a configuração das rotas usando a arquitetura DDD.
 */

import { createRoutes as createFeedbackRoutes } from './feedbacks.js';
import { createRoutes as createDemandaRoutes } from './demandas.js';
import { createRoutes as createEstudoCustoRoutes } from './estudos-custos.js';
import { createRoutes as createProjetoRoutes } from './projetos.js';
import { createRoutes as createAgendaRoutes } from './agenda.js';
import { createRoutes as createCurvaSProgressoRoutes } from './curva-s-progresso.js';
import { createRoutes as createBaselineRoutes } from './baselines.js';
import { createRoutes as createRelatoRoutes } from './relatos.js';
import { createRoutes as createBaselineRequestRoutes } from './baseline-requests.js';
import { createRoutes as createTodoRoutes } from './todos.js';
import { createRoutes as createUserPreferencesRoutes } from './user-preferences.js';
import { createRoutes as createOracleRoutes } from './oracle.js';
import { createRoutes as createWeeklyReportRoutes } from './weekly-reports.js';
import { createRoutes as createTimeSavingsRoutes } from './time-savings.js';
import { createRoutes as createIfcChangeLogRoutes } from './ifc-changelog.js';
import { createRoutes as createAutodocEntregasRoutes } from './autodoc-entregas.js';
import { createRoutes as createContactRequestRoutes } from './contact-requests.js';
import { createRoutes as createNomenclaturaRoutes } from './nomenclatura.js';
import { createRoutes as createMarcosProjetoRoutes } from './marcos-projeto.js';
import { createRoutes as createPagamentoRoutes } from './pagamentos.js';
import { createRoutes as createNotificacaoRoutes } from './notificacoes.js';
import { createRoutes as createPesquisasCSRoutes } from './pesquisas-cs.js';
import { createRoutes as createCustomerSuccessRoutes } from './customer-success.js';
import { createRoutes as createNpsRoutes } from './nps.js';
import { createClientRoutes, createAdminClientPortalRoutes } from './client-portal.js';
import requireClientAuth from '../middleware/requireClientAuth.js';

/**
 * Configura todas as rotas DDD na aplicação
 * @param {Express} app - Instância do Express
 * @param {Object} middleware - Middlewares da aplicação
 * @param {Function} middleware.requireAuth - Middleware de autenticação
 * @param {Function} middleware.isPrivileged - Função para verificar privilégios
 * @param {Function} middleware.logAction - Função para registrar ações
 */
export function setupDDDRoutes(app, { requireAuth, isPrivileged, canManageDemandas, canManageEstudosCustos, canAccessFormularioPassagem, canManagePagamentos, logAction, withBqCache, bigqueryClient, reportGenerator, invalidatePortfolioCache }) {
  // Rotas de Feedbacks (DDD)
  const feedbackRoutes = createFeedbackRoutes(requireAuth, isPrivileged, logAction, withBqCache);
  app.use('/api/feedbacks', feedbackRoutes);

  // Rotas de Demandas (DDD)
  const demandaRoutes = createDemandaRoutes(requireAuth, isPrivileged, logAction, canManageDemandas);
  app.use('/api/demandas', demandaRoutes);

  // Rotas de Estudos de Custos (DDD)
  const estudoCustoRoutes = createEstudoCustoRoutes(requireAuth, isPrivileged, logAction, canManageEstudosCustos);
  app.use('/api/estudos-custos', estudoCustoRoutes);

  // Rotas de Projetos (DDD) - Formulário de Passagem
  const projetoRoutes = createProjetoRoutes(requireAuth, canAccessFormularioPassagem, logAction, invalidatePortfolioCache);
  app.use('/api/projetos', projetoRoutes);

  // Rotas de Agenda (DDD)
  const agendaRoutes = createAgendaRoutes(requireAuth, logAction);
  app.use('/api/agenda/tasks', agendaRoutes);

  // Rotas de Curva S Progresso (DDD)
  const curvaSProgressoRoutes = createCurvaSProgressoRoutes(requireAuth, isPrivileged, logAction, withBqCache);
  app.use('/api/curva-s-progresso', curvaSProgressoRoutes);

  // Rotas de Baselines (DDD)
  const baselineRoutes = createBaselineRoutes(requireAuth, isPrivileged, logAction);
  app.use('/api/baselines', baselineRoutes);

  // Rotas de Relatos (DDD) - Diário de Projeto
  const relatoRoutes = createRelatoRoutes(requireAuth, isPrivileged, logAction);
  app.use('/api/relatos', relatoRoutes);

  // Rotas de Solicitações de Baseline (DDD)
  const baselineRequestRoutes = createBaselineRequestRoutes(requireAuth, isPrivileged, logAction, withBqCache);
  app.use('/api/baseline-requests', baselineRequestRoutes);

  // Rotas de ToDo's (DDD)
  const todoRoutes = createTodoRoutes(requireAuth, logAction);
  app.use('/api/todos', todoRoutes);

  // Rotas de Preferências do Usuário (DDD)
  const userPreferencesRoutes = createUserPreferencesRoutes(requireAuth, logAction);
  app.use('/api/user-preferences', userPreferencesRoutes);

  // Rotas do Oráculo (Chat IA via N8N)
  const oracleRoutes = createOracleRoutes(requireAuth);
  app.use('/api/oracle', oracleRoutes);

  // Rotas de Relatórios Semanais (DDD)
  if (bigqueryClient) {
    const weeklyReportRoutes = createWeeklyReportRoutes(requireAuth, isPrivileged, logAction, bigqueryClient, reportGenerator);
    app.use('/api/weekly-reports', weeklyReportRoutes);
  }

  // Rotas de Economia de Horas (DDD)
  const timeSavingsRoutes = createTimeSavingsRoutes(requireAuth, isPrivileged, logAction);
  app.use('/api/time-savings', timeSavingsRoutes);

  // Rotas de IFC Change Log (DDD)
  const ifcChangeLogRoutes = createIfcChangeLogRoutes(requireAuth, isPrivileged, logAction);
  app.use('/api/ifc-changelog', ifcChangeLogRoutes);

  // Rotas de Autodoc Entregas (DDD)
  const autodocEntregasRoutes = createAutodocEntregasRoutes(requireAuth, isPrivileged, logAction);
  app.use('/api/autodoc-entregas', autodocEntregasRoutes);

  // Rotas de Solicitações de Alteração de Contato (DDD)
  const contactRequestRoutes = createContactRequestRoutes(requireAuth, isPrivileged, logAction, withBqCache);
  app.use('/api/contact-requests', contactRequestRoutes);

  // Rotas de Nomenclatura de Arquivos
  const nomenclaturaRoutes = createNomenclaturaRoutes(requireAuth, isPrivileged, logAction);
  app.use('/api/nomenclatura', nomenclaturaRoutes);

  // Rotas de Marcos do Projeto
  const marcosProjetoRoutes = createMarcosProjetoRoutes(requireAuth, isPrivileged, logAction, withBqCache, bigqueryClient);
  app.use('/api/marcos-projeto', marcosProjetoRoutes);

  // Rotas de Pagamentos (DDD)
  const pagamentoRoutes = createPagamentoRoutes(requireAuth, isPrivileged, canManagePagamentos, logAction, withBqCache, bigqueryClient);
  app.use('/api/pagamentos', pagamentoRoutes);

  // Rotas de Notificacoes
  const notificacaoRoutes = createNotificacaoRoutes(requireAuth);
  app.use('/api/notificacoes', notificacaoRoutes);

  // Rotas de Pesquisas CS (DDD) — Percepção de Equipe
  const pesquisasCSRoutes = createPesquisasCSRoutes(requireAuth, isPrivileged, logAction);
  app.use('/api/cs/percepcao-equipe', pesquisasCSRoutes);

  // Rotas de Customer Success (DDD) — Classificação + Snapshots
  const customerSuccessRoutes = createCustomerSuccessRoutes(requireAuth, isPrivileged, logAction);
  app.use('/api/cs/classificacoes', customerSuccessRoutes);

  // Rotas de NPS (DDD) — Feedbacks NPS do Cliente
  const npsRoutes = createNpsRoutes(requireAuth, isPrivileged, logAction);
  app.use('/api/nps', npsRoutes);

  // Rotas do Portal do Cliente (DDD)
  const clientRoutes = createClientRoutes(requireClientAuth);
  app.use('/api/client', clientRoutes);

  // Rotas Admin do Portal do Cliente (DDD)
  const adminClientPortalRoutes = createAdminClientPortalRoutes(requireAuth);
  app.use('/api/admin/client-portal', adminClientPortalRoutes);

  console.log('Rotas DDD configuradas: /api/feedbacks, /api/demandas, /api/estudos-custos, /api/projetos, /api/agenda/tasks, /api/curva-s-progresso, /api/baselines, /api/relatos, /api/baseline-requests, /api/todos, /api/user-preferences, /api/oracle, /api/weekly-reports, /api/time-savings, /api/ifc-changelog, /api/autodoc-entregas, /api/contact-requests, /api/nomenclatura, /api/marcos-projeto, /api/pagamentos, /api/cs/percepcao-equipe, /api/cs/classificacoes, /api/nps, /api/client, /api/admin/client-portal');
}
