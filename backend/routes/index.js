/**
 * Index de rotas da aplicação
 *
 * Centraliza a configuração das rotas usando a arquitetura DDD.
 */

import { createRoutes as createFeedbackRoutes } from './feedbacks.js';
import { createRoutes as createDemandaRoutes } from './demandas.js';

/**
 * Configura todas as rotas DDD na aplicação
 * @param {Express} app - Instância do Express
 * @param {Object} middleware - Middlewares da aplicação
 * @param {Function} middleware.requireAuth - Middleware de autenticação
 * @param {Function} middleware.isPrivileged - Função para verificar privilégios
 * @param {Function} middleware.logAction - Função para registrar ações
 */
export function setupDDDRoutes(app, { requireAuth, isPrivileged, canManageDemandas, logAction }) {
  // Rotas de Feedbacks (DDD)
  const feedbackRoutes = createFeedbackRoutes(requireAuth, isPrivileged, logAction);
  app.use('/api/feedbacks', feedbackRoutes);

  // Rotas de Demandas (DDD)
  const demandaRoutes = createDemandaRoutes(requireAuth, isPrivileged, logAction, canManageDemandas);
  app.use('/api/demandas', demandaRoutes);

  console.log('Rotas DDD configuradas: /api/feedbacks, /api/demandas');
}
