/**
 * Rotas do Oráculo (Chat IA via N8N)
 *
 * Gerencia sessões de chat e faz proxy para o webhook do N8N.
 * Histórico de mensagens é armazenado pelo próprio N8N no Supabase
 * (tabelas n8n_chat_sessions e n8n_chat_histories).
 */

import express from 'express';
import { getSupabaseClient } from '../supabase.js';

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;
const N8N_WEBHOOK_TOKEN = process.env.N8N_WEBHOOK_TOKEN;
const N8N_WEBHOOK_HEADER = process.env.N8N_WEBHOOK_HEADER || 'key';

/**
 * Extrai o userId efetivo: query param > body > req.user
 */
function getEffectiveUserId(req) {
  return req.query?.userId || req.body?.userId || req.user?.id;
}

function createRoutes(requireAuth) {
  const router = express.Router();

  /**
   * GET /api/oracle/sessions?userId=
   * Lista sessões de chat do usuário
   */
  router.get('/sessions', requireAuth, async (req, res) => {
    try {
      const userId = getEffectiveUserId(req);
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Usuário não autenticado' });
      }

      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('n8n_chat_sessions')
        .select('id, chat_name, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      res.json({ success: true, data: data || [] });
    } catch (error) {
      console.error('Erro ao listar sessões do Oráculo:', error);
      res.status(500).json({ success: false, error: 'Erro ao listar sessões' });
    }
  });

  /**
   * POST /api/oracle/sessions
   * Cria uma nova sessão de chat
   */
  router.post('/sessions', requireAuth, async (req, res) => {
    try {
      const userId = getEffectiveUserId(req);
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Usuário não autenticado' });
      }

      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('n8n_chat_sessions')
        .insert({ user_id: userId })
        .select('id, chat_name, created_at')
        .single();

      if (error) throw error;

      res.status(201).json({ success: true, data });
    } catch (error) {
      console.error('Erro ao criar sessão do Oráculo:', error);
      res.status(500).json({ success: false, error: 'Erro ao criar sessão' });
    }
  });

  /**
   * DELETE /api/oracle/sessions/:sessionId
   * Exclui uma sessão de chat e suas mensagens
   */
  router.delete('/sessions/:sessionId', requireAuth, async (req, res) => {
    try {
      const userId = getEffectiveUserId(req);
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Usuário não autenticado' });
      }

      const { sessionId } = req.params;
      const supabase = getSupabaseClient();

      // Verifica que a sessão pertence ao usuário
      const { data: session, error: sessionError } = await supabase
        .from('n8n_chat_sessions')
        .select('id')
        .eq('id', sessionId)
        .eq('user_id', userId)
        .single();

      if (sessionError || !session) {
        return res.status(404).json({ success: false, error: 'Sessão não encontrada' });
      }

      // Remove mensagens da sessão
      await supabase
        .from('n8n_chat_histories')
        .delete()
        .eq('session_id', sessionId);

      // Remove a sessão
      const { error: deleteError } = await supabase
        .from('n8n_chat_sessions')
        .delete()
        .eq('id', sessionId);

      if (deleteError) throw deleteError;

      res.json({ success: true, message: 'Sessão removida' });
    } catch (error) {
      console.error('Erro ao excluir sessão do Oráculo:', error);
      res.status(500).json({ success: false, error: 'Erro ao excluir sessão' });
    }
  });

  /**
   * GET /api/oracle/sessions/:sessionId/messages?userId=
   * Lista mensagens de uma sessão (verifica ownership)
   */
  router.get('/sessions/:sessionId/messages', requireAuth, async (req, res) => {
    try {
      const userId = getEffectiveUserId(req);
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Usuário não autenticado' });
      }

      const { sessionId } = req.params;
      const supabase = getSupabaseClient();

      // Verifica que a sessão pertence ao usuário
      const { data: session, error: sessionError } = await supabase
        .from('n8n_chat_sessions')
        .select('id')
        .eq('id', sessionId)
        .eq('user_id', userId)
        .single();

      if (sessionError || !session) {
        return res.status(404).json({ success: false, error: 'Sessão não encontrada' });
      }

      // Busca mensagens
      const { data, error } = await supabase
        .from('n8n_chat_histories')
        .select('id, message, created_at')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Transforma o formato n8n para formato simples do frontend
      const messages = (data || []).map(row => ({
        id: row.id,
        type: row.message?.type === 'human' ? 'user' : 'bot',
        text: row.message?.content || '',
        timestamp: row.created_at,
      }));

      res.json({ success: true, data: messages });
    } catch (error) {
      console.error('Erro ao buscar mensagens do Oráculo:', error);
      res.status(500).json({ success: false, error: 'Erro ao buscar mensagens' });
    }
  });

  /**
   * POST /api/oracle/message
   * Envia mensagem para o N8N e retorna resposta
   */
  router.post('/message', requireAuth, async (req, res) => {
    try {
      const userId = getEffectiveUserId(req);
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Usuário não autenticado' });
      }

      const { session_id, text } = req.body;

      if (!session_id || !text?.trim()) {
        return res.status(400).json({ success: false, error: 'session_id e text são obrigatórios' });
      }

      // Verifica que a sessão pertence ao usuário
      const supabase = getSupabaseClient();
      const { data: session, error: sessionError } = await supabase
        .from('n8n_chat_sessions')
        .select('id')
        .eq('id', session_id)
        .eq('user_id', userId)
        .single();

      if (sessionError || !session) {
        return res.status(404).json({ success: false, error: 'Sessão não encontrada' });
      }

      if (!N8N_WEBHOOK_URL) {
        return res.status(503).json({ success: false, error: 'Serviço do Oráculo não configurado' });
      }

      // Chama o webhook do N8N (mesmo formato do FlutterFlow)
      const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(N8N_WEBHOOK_TOKEN ? { [N8N_WEBHOOK_HEADER]: N8N_WEBHOOK_TOKEN } : {}),
        },
        body: JSON.stringify({ role: 'user', session_id, text }),
      });

      if (!n8nResponse.ok) {
        console.error('Erro na resposta do N8N:', n8nResponse.status, await n8nResponse.text());
        return res.status(502).json({ success: false, error: 'Erro ao processar mensagem' });
      }

      const result = await n8nResponse.json();

      res.json({
        success: true,
        data: {
          output: result.output || '',
        },
      });
    } catch (error) {
      console.error('Erro ao enviar mensagem ao Oráculo:', error);
      res.status(500).json({ success: false, error: 'Erro ao processar mensagem' });
    }
  });

  return router;
}

export { createRoutes };
