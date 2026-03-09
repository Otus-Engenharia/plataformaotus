/**
 * Implementacao: SupabaseAutodocEntregasRepository
 *
 * Implementa a interface AutodocEntregasRepository usando Supabase.
 */

import { AutodocEntregasRepository } from '../../domain/acd/autodoc-entregas/AutodocEntregasRepository.js';
import { AutodocDocument } from '../../domain/acd/autodoc-entregas/entities/AutodocDocument.js';
import { getSupabaseServiceClient } from '../../supabase.js';

const DOCUMENTS_TABLE = 'autodoc_documents';
const MAPPINGS_TABLE = 'autodoc_project_mappings';
const SYNC_RUNS_TABLE = 'autodoc_sync_runs';

class SupabaseAutodocEntregasRepository extends AutodocEntregasRepository {
  #supabase;

  constructor() {
    super();
    this.#supabase = getSupabaseServiceClient();
  }

  // --- Documentos ---

  async findRecentDocuments(options = {}) {
    const { days = 7, projectCode, classification, page = 1, limit = 50 } = options;

    const since = new Date();
    since.setDate(since.getDate() - days);

    let query = this.#supabase
      .from(DOCUMENTS_TABLE)
      .select('*', { count: 'exact' })
      .gte('autodoc_created_at', since.toISOString())
      .order('autodoc_created_at', { ascending: false });

    if (projectCode) {
      query = query.eq('project_code', projectCode);
    }
    if (classification) {
      query = query.eq('classification', classification);
    }

    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Erro ao buscar documentos recentes: ${error.message}`);
    }

    return {
      data: (data || []).map(row => AutodocDocument.fromPersistence(row)),
      total: count || 0,
    };
  }

  async findByDocumentCode(documentCode) {
    const { data, error } = await this.#supabase
      .from(DOCUMENTS_TABLE)
      .select('*')
      .eq('document_code', documentCode)
      .order('autodoc_created_at', { ascending: false });

    if (error) {
      throw new Error(`Erro ao buscar por document_code: ${error.message}`);
    }

    return (data || []).map(row => AutodocDocument.fromPersistence(row));
  }

  async upsertDocuments(documents) {
    if (!documents.length) return;

    const rows = documents.map(doc => {
      const p = doc.toPersistence();
      delete p.id;
      return p;
    });

    const { error } = await this.#supabase
      .from(DOCUMENTS_TABLE)
      .upsert(rows, { onConflict: 'autodoc_doc_id' });

    if (error) {
      throw new Error(`Erro ao upsert documentos: ${error.message}`);
    }
  }

  // --- Mapeamentos ---

  async getProjectMappings(options = {}) {
    const { activeOnly = true } = options;

    let query = this.#supabase
      .from(MAPPINGS_TABLE)
      .select('*')
      .order('autodoc_customer_name', { ascending: true });

    if (activeOnly) {
      query = query.eq('active', true);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Erro ao buscar mapeamentos: ${error.message}`);
    }

    return data || [];
  }

  async upsertProjectMapping(mapping) {
    const row = {
      portfolio_project_code: mapping.portfolioProjectCode,
      autodoc_customer_id: mapping.autodocCustomerId,
      autodoc_customer_name: mapping.autodocCustomerName,
      autodoc_project_folder_id: mapping.autodocProjectFolderId,
      autodoc_project_name: mapping.autodocProjectName,
      active: mapping.active !== false,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.#supabase
      .from(MAPPINGS_TABLE)
      .upsert(row, { onConflict: 'autodoc_customer_id,autodoc_project_folder_id' })
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao salvar mapeamento: ${error.message}`);
    }

    return data;
  }

  async deleteProjectMapping(id) {
    const { error } = await this.#supabase
      .from(MAPPINGS_TABLE)
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Erro ao deletar mapeamento: ${error.message}`);
    }
  }

  // --- Resumo ---

  async getSummary(options = {}) {
    const { days = 7 } = options;

    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data, error } = await this.#supabase
      .from(DOCUMENTS_TABLE)
      .select('project_code, classification, document_name, raw_size, discipline_name')
      .gte('autodoc_created_at', since.toISOString());

    if (error) {
      throw new Error(`Erro ao buscar resumo: ${error.message}`);
    }

    const rows = data || [];
    const porClassificacao = { novo_arquivo: 0, nova_revisao: 0, mudanca_fase: 0 };
    const projectSet = new Set();
    const disciplineSet = new Set();
    let tamanhoTotal = 0;

    for (const row of rows) {
      if (porClassificacao[row.classification] !== undefined) {
        porClassificacao[row.classification]++;
      }
      projectSet.add(row.project_code);
      if (row.discipline_name) disciplineSet.add(row.discipline_name);
      tamanhoTotal += Number(row.raw_size) || 0;
    }

    return {
      totalEntregas: rows.length,
      porClassificacao,
      projetosAtivos: projectSet.size,
      disciplinas: [...disciplineSet],
      tamanhoTotal,
    };
  }

  // --- Sync Runs ---

  async createSyncRun(customerId) {
    const { data, error } = await this.#supabase
      .from(SYNC_RUNS_TABLE)
      .insert({
        autodoc_customer_id: customerId,
        status: 'running',
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao criar sync run: ${error.message}`);
    }

    return data;
  }

  async completeSyncRun(id, { projectsScanned = 0, documentsFound = 0, newDocuments = 0, error: runError = null, status = 'completed' }) {
    const { error } = await this.#supabase
      .from(SYNC_RUNS_TABLE)
      .update({
        finished_at: new Date().toISOString(),
        projects_scanned: projectsScanned,
        documents_found: documentsFound,
        new_documents: newDocuments,
        error: runError,
        status,
      })
      .eq('id', id);

    if (error) {
      throw new Error(`Erro ao completar sync run: ${error.message}`);
    }
  }
}

export { SupabaseAutodocEntregasRepository };
