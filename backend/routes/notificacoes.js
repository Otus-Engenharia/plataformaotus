import express from 'express';
import { getSupabaseClient } from '../supabase.js';

const router = express.Router();
const TABLE = 'notificacoes';

function createRoutes(requireAuth) {
  const supabase = () => getSupabaseClient();

  // GET / - List user's notifications
  router.get('/', requireAuth, async (req, res) => {
    try {
      const { data, error } = await supabase()
        .from(TABLE)
        .select('*')
        .eq('user_email', req.user.email)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      res.json({ success: true, data: data || [] });
    } catch (error) {
      console.error('Erro ao buscar notificacoes:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET /unread-count - Count unread
  router.get('/unread-count', requireAuth, async (req, res) => {
    try {
      const { count, error } = await supabase()
        .from(TABLE)
        .select('*', { count: 'exact', head: true })
        .eq('user_email', req.user.email)
        .eq('read', false);

      if (error) throw error;
      res.json({ success: true, data: { count: count || 0 } });
    } catch (error) {
      console.error('Erro ao contar notificacoes:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // PUT /:id/read - Mark as read
  router.put('/:id/read', requireAuth, async (req, res) => {
    try {
      const { error } = await supabase()
        .from(TABLE)
        .update({ read: true })
        .eq('id', req.params.id)
        .eq('user_email', req.user.email);

      if (error) throw error;
      res.json({ success: true });
    } catch (error) {
      console.error('Erro ao marcar notificacao como lida:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // PUT /read-all - Mark all as read
  router.put('/read-all', requireAuth, async (req, res) => {
    try {
      const { error } = await supabase()
        .from(TABLE)
        .update({ read: true })
        .eq('user_email', req.user.email)
        .eq('read', false);

      if (error) throw error;
      res.json({ success: true });
    } catch (error) {
      console.error('Erro ao marcar todas notificacoes como lidas:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}

export { createRoutes };
export default router;
