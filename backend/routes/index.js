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

/**
 * Configura todas as rotas DDD na aplicação
 * @param {Express} app - Instância do Express
 * @param {Object} middleware - Middlewares da aplicação
 * @param {Function} middleware.requireAuth - Middleware de autenticação
 * @param {Function} middleware.isPrivileged - Função para verificar privilégios
 * @param {Function} middleware.logAction - Função para registrar ações
 */
export function setupDDDRoutes(app, { requireAuth, isPrivileged, canManageDemandas, canManageEstudosCustos, canAccessFormularioPassagem, logAction, withBqCache }) {
  // Rotas de Feedbacks (DDD)
  const feedbackRoutes = createFeedbackRoutes(requireAuth, isPrivileged, logAction);
  app.use('/api/feedbacks', feedbackRoutes);

  // Rotas de Demandas (DDD)
  const demandaRoutes = createDemandaRoutes(requireAuth, isPrivileged, logAction, canManageDemandas);
  app.use('/api/demandas', demandaRoutes);

  // Rotas de Estudos de Custos (DDD)
  const estudoCustoRoutes = createEstudoCustoRoutes(requireAuth, isPrivileged, logAction, canManageEstudosCustos);
  app.use('/api/estudos-custos', estudoCustoRoutes);

  // Rotas de Projetos (DDD) - Formulário de Passagem
  const projetoRoutes = createProjetoRoutes(requireAuth, canAccessFormularioPassagem, logAction);
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
  const baselineRequestRoutes = createBaselineRequestRoutes(requireAuth, isPrivileged, logAction);
  app.use('/api/baseline-requests', baselineRequestRoutes);

  // Rotas de ToDo's (DDD)
  const todoRoutes = createTodoRoutes(requireAuth, logAction);
  app.use('/api/todos', todoRoutes);

  // Rotas de Preferências do Usuário (DDD)
  const userPreferencesRoutes = createUserPreferencesRoutes(requireAuth, logAction);
  app.use('/api/user-preferences', userPreferencesRoutes);

  console.log('Rotas DDD configuradas: /api/feedbacks, /api/demandas, /api/estudos-custos, /api/projetos, /api/agenda/tasks, /api/curva-s-progresso, /api/baselines, /api/relatos, /api/baseline-requests, /api/todos, /api/user-preferences');
}
