import { getSupabaseServiceClient } from '../../supabase.js';

const ACTIVE_STATUSES = ['planejamento', 'fase 01', 'fase 02', 'fase 03', 'fase 04'];

function isPortalVisible(portalClienteStatus, projectStatus) {
  if (portalClienteStatus === 'ativo') return true;
  if (portalClienteStatus === 'desativado') return false;
  // null → default based on project status
  return ACTIVE_STATUSES.includes((projectStatus || '').toLowerCase());
}

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
    const projectCodes = (data || []).map(d => d.project_code);
    if (projectCodes.length === 0) return [];

    // Fetch portal status and project status to filter
    const { data: projects } = await supabase
      .from('projects')
      .select('project_code, status')
      .in('project_code', projectCodes);

    const { data: features } = await supabase
      .from('project_features')
      .select('portal_cliente_status, projects!inner(project_code)')
      .in('projects.project_code', projectCodes);

    const featureMap = new Map((features || []).map(f => [f.projects?.project_code, f.portal_cliente_status]));

    return (projects || [])
      .filter(p => isPortalVisible(featureMap.get(p.project_code), p.status))
      .map(p => p.project_code);
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
      .select('project_code, name, status, company_id, companies(name)')
      .in('project_code', projectCodes);

    if (projError) throw new Error(`Erro ao buscar detalhes dos projetos: ${projError.message}`);

    // Fetch cover image URLs and portal status from project_features
    const { data: features } = await supabase
      .from('project_features')
      .select('capa_email_url, portal_cliente_status, projects!inner(project_code)')
      .in('projects.project_code', projectCodes);

    const featureMap = new Map((features || []).map(f => [f.projects?.project_code, {
      capaUrl: f.capa_email_url,
      portalStatus: f.portal_cliente_status,
    }]));

    // Merge assignment data with project data, filtering by portal visibility
    return (projects || [])
      .filter(p => isPortalVisible(featureMap.get(p.project_code)?.portalStatus, p.status))
      .map(p => {
        const assignment = assignments.find(a => a.project_code === p.project_code);
        return {
          projectCode: p.project_code,
          nome: p.name,
          empresaCliente: p.companies?.name || null,
          status: p.status,
          role: assignment?.role || null,
          capaUrl: featureMap.get(p.project_code)?.capaUrl || null,
        };
      });
  }

  async getCompanyProjectCodes(companyId) {
    const supabase = this.#getClient();
    const { data, error } = await supabase
      .from('projects')
      .select('project_code, status')
      .eq('company_id', companyId);

    if (error) throw new Error(`Erro ao buscar projetos da empresa: ${error.message}`);
    const projects = data || [];
    if (projects.length === 0) return [];

    const projectCodes = projects.map(p => p.project_code);

    const { data: features } = await supabase
      .from('project_features')
      .select('portal_cliente_status, projects!inner(project_code)')
      .in('projects.project_code', projectCodes);

    const featureMap = new Map((features || []).map(f => [f.projects?.project_code, f.portal_cliente_status]));

    return projects
      .filter(p => isPortalVisible(featureMap.get(p.project_code), p.status))
      .map(p => p.project_code);
  }

  async getCompanyProjects(companyId) {
    const supabase = this.#getClient();

    const { data: projects, error: projError } = await supabase
      .from('projects')
      .select('project_code, name, status, company_id, companies(name)')
      .eq('company_id', companyId);

    if (projError) throw new Error(`Erro ao buscar detalhes dos projetos: ${projError.message}`);
    if (!projects || projects.length === 0) return [];

    const projectCodes = projects.map(p => p.project_code);

    const { data: features } = await supabase
      .from('project_features')
      .select('capa_email_url, portal_cliente_status, projects!inner(project_code)')
      .in('projects.project_code', projectCodes);

    const featureMap = new Map((features || []).map(f => [f.projects?.project_code, {
      capaUrl: f.capa_email_url,
      portalStatus: f.portal_cliente_status,
    }]));

    return projects
      .filter(p => isPortalVisible(featureMap.get(p.project_code)?.portalStatus, p.status))
      .map(p => ({
        projectCode: p.project_code,
        nome: p.name,
        empresaCliente: p.companies?.name || null,
        status: p.status,
        role: null,
        capaUrl: featureMap.get(p.project_code)?.capaUrl || null,
      }));
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
