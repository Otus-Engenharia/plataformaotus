import { getSupabaseServiceClient } from '../../supabase.js';

export class SupabaseClientPortalRepository {
  #getClient;

  constructor() {
    this.#getClient = getSupabaseServiceClient;
  }

  async getClientProjectCodes(contactId) {
    const supabase = this.#getClient();
    const { data, error } = await supabase
      .from('project_client_contacts')
      .select('project_code')
      .eq('contact_id', contactId)
      .eq('is_active', true);

    if (error) throw new Error(`Erro ao buscar projetos do cliente: ${error.message}`);
    return (data || []).map(d => d.project_code);
  }

  async getClientProjects(contactId) {
    const supabase = this.#getClient();

    // First get the project codes assigned to this contact
    const { data: assignments, error: assignError } = await supabase
      .from('project_client_contacts')
      .select('project_code, role, notes')
      .eq('contact_id', contactId)
      .eq('is_active', true);

    if (assignError) throw new Error(`Erro ao buscar projetos: ${assignError.message}`);
    if (!assignments || assignments.length === 0) return [];

    const projectCodes = assignments.map(a => a.project_code);

    // Then get project details from the projects table
    const { data: projects, error: projError } = await supabase
      .from('projects')
      .select('project_code, nome, empresa_cliente, status')
      .in('project_code', projectCodes);

    if (projError) throw new Error(`Erro ao buscar detalhes dos projetos: ${projError.message}`);

    // Merge assignment data with project data
    return (projects || []).map(p => {
      const assignment = assignments.find(a => a.project_code === p.project_code);
      return {
        projectCode: p.project_code,
        nome: p.nome,
        empresaCliente: p.empresa_cliente,
        status: p.status,
        role: assignment?.role || null,
      };
    });
  }

  async getContactById(contactId) {
    const supabase = this.#getClient();
    const { data, error } = await supabase
      .from('contacts')
      .select('id, name, email, phone, position, company_id, has_portal_access, supabase_auth_id, companies(id, name)')
      .eq('id', contactId)
      .single();

    if (error) throw new Error(`Erro ao buscar contato: ${error.message}`);
    return data;
  }

  async getContactByEmail(email) {
    const supabase = this.#getClient();
    const { data, error } = await supabase
      .from('contacts')
      .select('id, name, email, phone, position, company_id, has_portal_access, supabase_auth_id, companies(id, name)')
      .eq('email', email)
      .single();

    if (error && error.code !== 'PGRST116') throw new Error(`Erro ao buscar contato: ${error.message}`);
    return data || null;
  }

  async enablePortalAccess(contactId, supabaseAuthId) {
    const supabase = this.#getClient();
    const { error } = await supabase
      .from('contacts')
      .update({
        has_portal_access: true,
        supabase_auth_id: supabaseAuthId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', contactId);

    if (error) throw new Error(`Erro ao ativar portal: ${error.message}`);
  }

  async disablePortalAccess(contactId) {
    const supabase = this.#getClient();
    const { error } = await supabase
      .from('contacts')
      .update({
        has_portal_access: false,
        supabase_auth_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', contactId);

    if (error) throw new Error(`Erro ao desativar portal: ${error.message}`);
  }

  async logAuditAction({ contactId, action, projectCode = null, ipAddress = null, userAgent = null, metadata = null }) {
    const supabase = this.#getClient();
    const { error } = await supabase
      .from('client_portal_audit_log')
      .insert({
        contact_id: contactId,
        action,
        project_code: projectCode,
        ip_address: ipAddress,
        user_agent: userAgent,
        metadata,
      });

    if (error) console.error('Erro ao registrar audit log:', error);
  }
}

// Singleton
let instance = null;
export function getClientPortalRepository() {
  if (!instance) instance = new SupabaseClientPortalRepository();
  return instance;
}
