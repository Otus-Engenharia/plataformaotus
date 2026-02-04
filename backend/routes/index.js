/**
 * Index de rotas da aplicação
 *
 * Centraliza a configuração das rotas usando a arquitetura DDD.
 */

import { createRoutes as createFeedbackRoutes } from './feedbacks.js';

/**
 * Configura todas as rotas DDD na aplicação
 * @param {Express} app - Instância do Express
 * @param {Object} middleware - Middlewares da aplicação
 * @param {Function} middleware.requireAuth - Middleware de autenticação
 * @param {Function} middleware.isPrivileged - Função para verificar privilégios
 * @param {Function} middleware.logAction - Função para registrar ações
 */
export function setupDDDRoutes(app, { requireAuth, isPrivileged, logAction }) {
  // Rotas de Feedbacks (DDD)
  const feedbackRoutes = createFeedbackRoutes(requireAuth, isPrivileged, logAction);
  app.use('/api/feedbacks', feedbackRoutes);

  console.log('✅ Rotas DDD configuradas: /api/feedbacks');
}
