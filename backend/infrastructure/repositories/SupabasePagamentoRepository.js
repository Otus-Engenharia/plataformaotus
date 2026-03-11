import { PagamentoRepository } from '../../domain/pagamentos/PagamentoRepository.js';
import { Parcela } from '../../domain/pagamentos/entities/Parcela.js';
import { RegraCliente } from '../../domain/pagamentos/entities/RegraCliente.js';
import { getSupabaseClient } from '../../supabase.js';

const PARCELAS_TABLE = 'parcelas_pagamento';
const REGRAS_TABLE = 'regras_pagamento_cliente';
const CHANGELOG_TABLE = 'parcela_change_log';

class SupabasePagamentoRepository extends PagamentoRepository {
  #supabase;

  constructor() {
    super();
    this.#supabase = getSupabaseClient();
  }

  // --- Parcelas ---

  async findAllParcelas(options = {}) {
    let query = this.#supabase
      .from(PARCELAS_TABLE)
      .select('*')
      .order('project_code', { ascending: true })
      .order('parcela_numero', { ascending: true });

    if (options.statusFinanceiro) {
      query = query.eq('status_financeiro', options.statusFinanceiro);
    }
    if (options.statusProjetos) {
      query = query.eq('status_projetos', options.statusProjetos);
    }
    // Backward compat: support old status filter
    if (options.status) {
      query = query.eq('status', options.status);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Erro ao buscar parcelas: ${error.message}`);
    return (data || []).map(row => Parcela.fromPersistence(row));
  }

  async findParcelaById(id) {
    const { data, error } = await this.#supabase
      .from(PARCELAS_TABLE)
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Erro ao buscar parcela: ${error.message}`);
    }
    return data ? Parcela.fromPersistence(data) : null;
  }

  async findParcelasByProject(projectCode) {
    const { data, error } = await this.#supabase
      .from(PARCELAS_TABLE)
      .select('*')
      .eq('project_code', projectCode)
      .order('parcela_numero', { ascending: true });

    if (error) throw new Error(`Erro ao buscar parcelas do projeto: ${error.message}`);
    return (data || []).map(row => Parcela.fromPersistence(row));
  }

  async findParcelasVinculadas() {
    const { data, error } = await this.#supabase
      .from(PARCELAS_TABLE)
      .select('*')
      .not('smartsheet_row_id', 'is', null)
      .neq('status_financeiro', 'faturado')
      .order('project_code', { ascending: true });

    if (error) throw new Error(`Erro ao buscar parcelas vinculadas: ${error.message}`);
    return (data || []).map(row => Parcela.fromPersistence(row));
  }

  async findUpcomingParcelas(options = {}) {
    let query = this.#supabase
      .from(PARCELAS_TABLE)
      .select('*')
      .neq('status_financeiro', 'faturado')
      .order('data_pagamento_calculada', { ascending: true, nullsFirst: false });

    if (options.leader) {
      query = query.eq('gerente_email', options.leader);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Erro ao buscar parcelas futuras: ${error.message}`);
    return (data || []).map(row => Parcela.fromPersistence(row));
  }

  async saveParcela(parcela) {
    const persistData = parcela.toPersistence();
    delete persistData.id;

    const { data, error } = await this.#supabase
      .from(PARCELAS_TABLE)
      .insert(persistData)
      .select()
      .single();

    if (error) throw new Error(`Erro ao criar parcela: ${error.message}`);
    return Parcela.fromPersistence(data);
  }

  async updateParcela(parcela) {
    const persistData = parcela.toPersistence();
    const { id, ...updateData } = persistData;
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await this.#supabase
      .from(PARCELAS_TABLE)
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`Erro ao atualizar parcela: ${error.message}`);
    return Parcela.fromPersistence(data);
  }

  async deleteParcela(id) {
    const { error } = await this.#supabase
      .from(PARCELAS_TABLE)
      .delete()
      .eq('id', id);

    if (error) throw new Error(`Erro ao remover parcela: ${error.message}`);
  }

  async countPendingParcelas(userEmail) {
    let query = this.#supabase
      .from(PARCELAS_TABLE)
      .select('*', { count: 'exact', head: true })
      .eq('status_financeiro', 'pendente');

    if (userEmail) {
      query = query.eq('gerente_email', userEmail);
    }

    const { count, error } = await query;
    if (error) throw new Error(`Erro ao contar parcelas pendentes: ${error.message}`);
    return count || 0;
  }

  // --- Regras Cliente ---

  async findAllRegras() {
    const { data, error } = await this.#supabase
      .from(REGRAS_TABLE)
      .select('*')
      .order('company_name', { ascending: true });

    if (error) throw new Error(`Erro ao buscar regras: ${error.message}`);
    return (data || []).map(row => RegraCliente.fromPersistence(row));
  }

  async findRegraByCompanyId(companyId) {
    const { data, error } = await this.#supabase
      .from(REGRAS_TABLE)
      .select('*')
      .eq('company_id', companyId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Erro ao buscar regra: ${error.message}`);
    }
    return data ? RegraCliente.fromPersistence(data) : null;
  }

  async saveRegra(regra) {
    const persistData = regra.toPersistence();
    delete persistData.id;

    const { data, error } = await this.#supabase
      .from(REGRAS_TABLE)
      .insert(persistData)
      .select()
      .single();

    if (error) throw new Error(`Erro ao criar regra: ${error.message}`);
    return RegraCliente.fromPersistence(data);
  }

  async updateRegra(regra) {
    const persistData = regra.toPersistence();
    const { id, ...updateData } = persistData;
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await this.#supabase
      .from(REGRAS_TABLE)
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`Erro ao atualizar regra: ${error.message}`);
    return RegraCliente.fromPersistence(data);
  }

  // --- Change Log ---

  async saveChangeLog(entry) {
    const { error } = await this.#supabase
      .from(CHANGELOG_TABLE)
      .insert(entry);

    if (error) throw new Error(`Erro ao salvar change log: ${error.message}`);
  }

  async saveChangeLogBatch(entries) {
    if (!entries || entries.length === 0) return;

    const { error } = await this.#supabase
      .from(CHANGELOG_TABLE)
      .insert(entries);

    if (error) throw new Error(`Erro ao salvar change log batch: ${error.message}`);
  }

  async findChangeLogByProject(projectCode, options = {}) {
    let query = this.#supabase
      .from(CHANGELOG_TABLE)
      .select('*')
      .eq('project_code', projectCode)
      .order('created_at', { ascending: false });

    if (options.since) {
      query = query.gt('created_at', options.since);
    }
    if (options.excludeEmail) {
      query = query.neq('edited_by_email', options.excludeEmail);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Erro ao buscar change log: ${error.message}`);
    return data || [];
  }

  async findChangeLogGlobal({ since, excludeEmail, limit = 100, offset = 0 }) {
    let query = this.#supabase
      .from(CHANGELOG_TABLE)
      .select('*, parcelas_pagamento:parcela_id(*)', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (since) query = query.gt('created_at', since);
    if (excludeEmail) query = query.neq('edited_by_email', excludeEmail);

    const { data, count, error } = await query.range(offset, offset + limit - 1);
    if (error) throw new Error(`Erro ao buscar change log global: ${error.message}`);

    return { entries: data || [], total: count || 0 };
  }

  async countChangeLogSince(since, excludeEmail) {
    let query = this.#supabase
      .from(CHANGELOG_TABLE)
      .select('id, parcela_id', { count: 'exact' })
      .gt('created_at', since);

    if (excludeEmail) {
      query = query.neq('edited_by_email', excludeEmail);
    }

    const { data, count, error } = await query;
    if (error) throw new Error(`Erro ao contar changelog: ${error.message}`);

    const parcelaIds = [...new Set((data || []).map(d => d.parcela_id).filter(Boolean))];
    return { count: count || 0, parcela_ids: parcelaIds };
  }

  // --- Dashboard / Summary ---

  async countParcelasByStatusFinanceiro() {
    const { data, error } = await this.#supabase
      .from(PARCELAS_TABLE)
      .select('status_financeiro');
    if (error) throw new Error(`Erro ao contar parcelas por status: ${error.message}`);
    const counts = {};
    (data || []).forEach(row => {
      counts[row.status_financeiro] = (counts[row.status_financeiro] || 0) + 1;
    });
    return counts;
  }

  async sumValorByStatusFinanceiro() {
    const { data, error } = await this.#supabase
      .from(PARCELAS_TABLE)
      .select('status_financeiro, valor');
    if (error) throw new Error(`Erro ao somar valores por status: ${error.message}`);
    const sums = {};
    (data || []).forEach(row => {
      const val = Number(row.valor) || 0;
      sums[row.status_financeiro] = (sums[row.status_financeiro] || 0) + val;
    });
    return sums;
  }

  async getProjectCodesWithParcelas() {
    const { data, error } = await this.#supabase
      .from(PARCELAS_TABLE)
      .select('project_code');
    if (error) throw new Error(`Erro ao buscar project codes: ${error.message}`);
    return [...new Set((data || []).map(r => r.project_code))];
  }

  async findParcelasByGerente(email) {
    const { data, error } = await this.#supabase
      .from(PARCELAS_TABLE)
      .select('*')
      .eq('gerente_email', email)
      .order('project_code', { ascending: true })
      .order('parcela_numero', { ascending: true });
    if (error) throw new Error(`Erro ao buscar parcelas por gerente: ${error.message}`);
    return (data || []).map(row => Parcela.fromPersistence(row));
  }

  async getAllProjectsWithTipoPagamento() {
    const { data: comercialInfos, error: ciErr } = await this.#supabase
      .from('project_comercial_infos')
      .select('project_id, tipo_pagamento');
    if (ciErr) throw new Error(`Erro ao buscar infos comerciais: ${ciErr.message}`);

    const tipoPagamentoMap = {};
    for (const info of (comercialInfos || [])) {
      tipoPagamentoMap[String(info.project_id)] = info.tipo_pagamento;
    }

    const projectIds = Object.keys(tipoPagamentoMap);
    if (projectIds.length === 0) return [];

    const { data: projects, error: projErr } = await this.#supabase
      .from('projects')
      .select('id, project_code, name, status, company_id, companies:company_id(name), users_otus:project_manager_id(name, email)')
      .in('id', projectIds);
    if (projErr) throw new Error(`Erro ao buscar projetos: ${projErr.message}`);

    return (projects || []).map(p => ({
      project_code: p.project_code,
      project_name: p.name,
      status: p.status,
      company_name: p.companies?.name || '',
      gerente_email: p.users_otus?.email || '',
      gerente_name: p.users_otus?.name || '',
      tipo_pagamento: tipoPagamentoMap[String(p.id)] || 'spot',
    }));
  }

  async getProjectDataByProjectCodes(projectCodes) {
    if (!projectCodes || projectCodes.length === 0) return {};

    const { data: projects, error } = await this.#supabase
      .from('projects')
      .select('project_code, name, status, companies:company_id(name)')
      .in('project_code', projectCodes);
    if (error) return {};

    const result = {};
    for (const p of (projects || [])) {
      result[p.project_code] = {
        project_name: p.name || '',
        status: p.status || '',
        company_name: p.companies?.name || '',
      };
    }
    return result;
  }

  async getTipoPagamentoByProjectCodes(projectCodes) {
    if (!projectCodes || projectCodes.length === 0) return {};

    const { data: projects, error: projErr } = await this.#supabase
      .from('projects')
      .select('id, project_code')
      .in('project_code', projectCodes);
    if (projErr) return {};

    const projectIds = (projects || []).map(p => p.id);
    if (projectIds.length === 0) return {};

    const codeById = {};
    for (const p of (projects || [])) {
      codeById[String(p.id)] = p.project_code;
    }

    const { data: comercialInfos, error: ciErr } = await this.#supabase
      .from('project_comercial_infos')
      .select('project_id, tipo_pagamento')
      .in('project_id', projectIds);
    if (ciErr) return {};

    const result = {};
    for (const info of (comercialInfos || [])) {
      const code = codeById[String(info.project_id)];
      if (code) result[code] = info.tipo_pagamento;
    }
    return result;
  }

  async clearAlertaCronograma(parcelaId) {
    const { data, error } = await this.#supabase
      .from(PARCELAS_TABLE)
      .update({ alerta_cronograma: null, updated_at: new Date().toISOString() })
      .eq('id', parcelaId)
      .select()
      .single();

    if (error) throw new Error(`Erro ao limpar alerta: ${error.message}`);
    return Parcela.fromPersistence(data);
  }

  async getActiveSpotProjectCodes() {
    const projects = await this.getAllSpotProjects();
    const ACTIVE_STATUSES = ['planejamento', 'fase 01', 'fase 02', 'fase 03', 'fase 04'];
    return projects
      .filter(p => ACTIVE_STATUSES.includes(p.status))
      .map(p => p.project_code);
  }

  async getAllSpotProjects() {
    const { data: spotInfos, error: spotErr } = await this.#supabase
      .from('project_comercial_infos')
      .select('project_id')
      .eq('tipo_pagamento', 'spot');
    if (spotErr) throw new Error(`Erro ao buscar projetos spot: ${spotErr.message}`);

    const spotProjectIds = (spotInfos || []).map(r => r.project_id);
    if (spotProjectIds.length === 0) return [];

    const { data: projects, error: projErr } = await this.#supabase
      .from('projects')
      .select('id, project_code, name, status, company_id, companies:company_id(name), users_otus:project_manager_id(name, email)')
      .in('id', spotProjectIds);
    if (projErr) throw new Error(`Erro ao buscar projetos: ${projErr.message}`);

    return (projects || []).map(p => ({
      project_code: p.project_code,
      project_name: p.name,
      status: p.status,
      company_name: p.companies?.name || '',
      gerente_email: p.users_otus?.email || '',
      gerente_name: p.users_otus?.name || '',
    }));
  }
}

export { SupabasePagamentoRepository };
