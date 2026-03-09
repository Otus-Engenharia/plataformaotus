import { getSupabaseClient } from '../../supabase.js';

class NotificationService {
  #supabase;

  constructor() {
    this.#supabase = getSupabaseClient();
  }

  async notify(userEmail, type, title, message, entityType, entityId, linkUrl) {
    const { error } = await this.#supabase
      .from('notificacoes')
      .insert({
        user_email: userEmail,
        type,
        title,
        message,
        entity_type: entityType,
        entity_id: entityId,
        link_url: linkUrl,
        read: false,
        created_at: new Date().toISOString(),
      });

    if (error) {
      console.error('Erro ao criar notificacao:', error);
    }
  }

  async notifyMultiple(emails, type, title, message, entityType, entityId, linkUrl) {
    if (!emails || emails.length === 0) return;

    const rows = emails.map(email => ({
      user_email: email,
      type,
      title,
      message,
      entity_type: entityType,
      entity_id: entityId,
      link_url: linkUrl,
      read: false,
      created_at: new Date().toISOString(),
    }));

    const { error } = await this.#supabase
      .from('notificacoes')
      .insert(rows);

    if (error) {
      console.error('Erro ao criar notificacoes em batch:', error);
    }
  }

  async getFinanceiroEmails() {
    const { data, error } = await this.#supabase
      .from('users_otus')
      .select('email')
      .eq('setor_name', 'Administrativo & Financeiro');

    if (error) {
      console.error('Erro ao buscar emails financeiro:', error);
      return [];
    }
    return (data || []).map(u => u.email);
  }
}

export { NotificationService };
