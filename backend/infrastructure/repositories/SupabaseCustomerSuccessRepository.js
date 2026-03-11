/**
 * Implementação: SupabaseCustomerSuccessRepository
 *
 * Implementa a interface CustomerSuccessRepository usando Supabase como storage.
 */

import { CustomerSuccessRepository } from '../../domain/customer-success/CustomerSuccessRepository.js';
import { ClassificacaoCliente } from '../../domain/customer-success/entities/ClassificacaoCliente.js';
import { PortfolioSnapshot } from '../../domain/customer-success/entities/PortfolioSnapshot.js';
import { getSupabaseClient } from '../../supabase.js';

const CLASSIFICACOES_TABLE = 'cs_classificacao_clientes';
const SNAPSHOTS_TABLE = 'cs_portfolio_snapshots';

class SupabaseCustomerSuccessRepository extends CustomerSuccessRepository {
  #supabase;

  constructor() {
    super();
    this.#supabase = getSupabaseClient();
  }

  async findAllClassificacoes() {
    const { data, error } = await this.#supabase
      .from(CLASSIFICACOES_TABLE)
      .select('*, companies:company_id(id, name)')
      .order('cliente');

    if (error) {
      throw new Error(`Erro ao buscar classificações: ${error.message}`);
    }

    return (data || []).map(row => {
      if (row.companies?.name) {
        row.cliente = row.companies.name;
      }
      return ClassificacaoCliente.fromPersistence(row);
    });
  }

  async findClassificacaoByCompanyId(companyId) {
    const { data, error } = await this.#supabase
      .from(CLASSIFICACOES_TABLE)
      .select('*')
      .eq('company_id', companyId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Erro ao buscar classificação da company: ${error.message}`);
    }

    return data ? ClassificacaoCliente.fromPersistence(data) : null;
  }

  async findAllCompaniesClient() {
    const { data, error } = await this.#supabase
      .from('companies')
      .select('id, name')
      .eq('company_type', 'client')
      .order('name');

    if (error) {
      throw new Error(`Erro ao buscar companies client: ${error.message}`);
    }

    return data || [];
  }

  async findProjectCompanyMap() {
    const { data, error } = await this.#supabase
      .from('projects')
      .select('project_code, company_id, companies:company_id(id, name)')
      .not('company_id', 'is', null);

    if (error) {
      throw new Error(`Erro ao buscar mapa project-company: ${error.message}`);
    }

    const map = new Map();
    for (const row of (data || [])) {
      if (row.project_code && row.companies) {
        map.set(row.project_code, {
          companyId: row.companies.id,
          companyName: row.companies.name,
        });
      }
    }
    return map;
  }

  async saveClassificacao(classificacao) {
    const persistData = classificacao.toPersistence();
    delete persistData.id;

    const { data, error } = await this.#supabase
      .from(CLASSIFICACOES_TABLE)
      .insert(persistData)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao salvar classificação: ${error.message}`);
    }

    return ClassificacaoCliente.fromPersistence(data);
  }

  async updateClassificacao(classificacao) {
    const persistData = classificacao.toPersistence();
    const { id, ...updateData } = persistData;

    updateData.updated_at = new Date().toISOString();

    const { data, error } = await this.#supabase
      .from(CLASSIFICACOES_TABLE)
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao atualizar classificação: ${error.message}`);
    }

    return ClassificacaoCliente.fromPersistence(data);
  }

  async upsertClassificacoes(classificacoes) {
    const rows = classificacoes.map(c => {
      const data = c.toPersistence();
      delete data.id;
      return data;
    });

    const { data, error } = await this.#supabase
      .from(CLASSIFICACOES_TABLE)
      .upsert(rows, { onConflict: 'company_id' })
      .select();

    if (error) {
      throw new Error(`Erro ao sincronizar classificações: ${error.message}`);
    }

    return (data || []).length;
  }

  async findSnapshots({ snapshotDate, month, year, cliente, statusProjeto } = {}) {
    let query = this.#supabase
      .from(SNAPSHOTS_TABLE)
      .select('*');

    if (snapshotDate) {
      query = query.eq('snapshot_date', snapshotDate);
    } else if (month != null && year != null) {
      const paddedMonth = String(month).padStart(2, '0');
      const prefix = `${year}-${paddedMonth}`;
      query = query.like('snapshot_date', `${prefix}%`);
    }

    if (cliente) {
      query = query.eq('cliente', cliente);
    }

    if (statusProjeto) {
      query = query.eq('status_projeto', statusProjeto);
    }

    query = query
      .order('snapshot_date', { ascending: false })
      .order('cliente');

    const { data, error } = await query;

    if (error) {
      throw new Error(`Erro ao buscar snapshots: ${error.message}`);
    }

    return (data || []).map(row => PortfolioSnapshot.fromPersistence(row));
  }

  async saveSnapshots(snapshots) {
    const rows = snapshots.map(s => {
      const data = s.toPersistence();
      delete data.id;
      return data;
    });

    const { data, error } = await this.#supabase
      .from(SNAPSHOTS_TABLE)
      .insert(rows)
      .select();

    if (error) {
      throw new Error(`Erro ao salvar snapshots: ${error.message}`);
    }

    return (data || []).length;
  }

  async deleteSnapshotsByDate(snapshotDate) {
    const { error } = await this.#supabase
      .from(SNAPSHOTS_TABLE)
      .delete()
      .eq('snapshot_date', snapshotDate);

    if (error) {
      throw new Error(`Erro ao remover snapshots da data ${snapshotDate}: ${error.message}`);
    }
  }

  async getSnapshotStats({ month, year }) {
    const paddedMonth = String(month).padStart(2, '0');
    const prefix = `${year}-${paddedMonth}`;

    const { data, error } = await this.#supabase
      .from(SNAPSHOTS_TABLE)
      .select('cliente, status_cliente, status_projeto')
      .like('snapshot_date', `${prefix}%`);

    if (error) {
      throw new Error(`Erro ao buscar estatísticas de snapshots: ${error.message}`);
    }

    const rows = data || [];

    const clientesPorStatus = new Map();
    let projetosAtivos = 0;
    let projetosInativos = 0;
    let projetosEncerrados = 0;

    for (const row of rows) {
      if (!clientesPorStatus.has(row.cliente)) {
        clientesPorStatus.set(row.cliente, row.status_cliente);
      }

      if (row.status_projeto === 'ATIVO') {
        projetosAtivos++;
      } else if (row.status_projeto === 'INATIVO') {
        projetosInativos++;
      } else if (row.status_projeto === 'ENCERRADO') {
        projetosEncerrados++;
      }
    }

    let clientesAtivos = 0;
    let churns = 0;

    for (const statusCliente of clientesPorStatus.values()) {
      if (statusCliente === 'CHURN') {
        churns++;
      } else {
        clientesAtivos++;
      }
    }

    return { clientesAtivos, churns, projetosAtivos, projetosInativos, projetosEncerrados };
  }
}

export { SupabaseCustomerSuccessRepository };
