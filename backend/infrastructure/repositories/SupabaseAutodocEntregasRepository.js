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

  // Resolve date range: startDate/endDate explicitos ou fallback para days
  // Usa offset -03:00 (Brasilia) para meia-noite local
  #dateRangeFromOptions(options) {
    const { startDate, endDate, days = 7 } = options;
    if (startDate && endDate) {
      return {
        since: `${startDate}T00:00:00-03:00`,
        until: `${endDate}T23:59:59.999-03:00`,
      };
    }
    const d = new Date();
    d.setDate(d.getDate() - days);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return {
      since: `${y}-${m}-${dd}T00:00:00-03:00`,
      until: null,
    };
  }

  async findRecentDocuments(options = {}) {
    const { projectCode, classification, page = 1, limit = 50, filterBy = 'created' } = options;

    const { since, until } = this.#dateRangeFromOptions(options);
    const dateColumn = filterBy === 'synced' ? 'synced_at' : 'autodoc_created_at';

    let query = this.#supabase
      .from(DOCUMENTS_TABLE)
      .select('*', { count: 'exact' })
      .gte(dateColumn, since)
      .neq('project_code', '__DISMISSED__')
      .order(dateColumn, { ascending: false });

    if (until) {
      query = query.lte(dateColumn, until);
    }

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

  async findByDocumentCodes(documentCodes) {
    if (!documentCodes.length) return new Map();

    const uniqueCodes = [...new Set(documentCodes)];
    const CHUNK = 500;
    const result = new Map(); // code -> AutodocDocument[]

    for (let i = 0; i < uniqueCodes.length; i += CHUNK) {
      const chunk = uniqueCodes.slice(i, i + CHUNK);
      const { data, error } = await this.#supabase
        .from(DOCUMENTS_TABLE)
        .select('*')
        .in('document_code', chunk)
        .order('autodoc_created_at', { ascending: false });

      if (error) {
        throw new Error(`Erro ao buscar por document_codes em batch: ${error.message}`);
      }

      for (const row of (data || [])) {
        const code = row.document_code;
        if (!result.has(code)) result.set(code, []);
        result.get(code).push(AutodocDocument.fromPersistence(row));
      }
    }

    return result;
  }

  async findExistingDatesByDocIds(docIds) {
    if (!docIds.length) return new Map();

    // Supabase IN filter max ~1000 items, chunk if needed
    const CHUNK = 500;
    const result = new Map();

    for (let i = 0; i < docIds.length; i += CHUNK) {
      const chunk = docIds.slice(i, i + CHUNK);
      const { data, error } = await this.#supabase
        .from(DOCUMENTS_TABLE)
        .select('autodoc_doc_id, autodoc_created_at')
        .in('autodoc_doc_id', chunk);

      if (error) {
        console.warn(`[SupabaseAutodocEntregasRepository] Erro ao buscar datas existentes: ${error.message}`);
        continue;
      }

      for (const row of (data || [])) {
        if (row.autodoc_created_at) {
          result.set(String(row.autodoc_doc_id), row.autodoc_created_at);
        }
      }
    }

    return result;
  }

  async upsertDocuments(documents) {
    if (!documents.length) return;

    const rowMap = new Map();
    for (const doc of documents) {
      const p = doc.toPersistence();
      delete p.id;
      // Deduplica por autodoc_doc_id (último vence)
      rowMap.set(p.autodoc_doc_id, p);
    }
    const rows = [...rowMap.values()];

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
      use_classic_api: mapping.useClassicApi === true,
      classic_instance_id: mapping.classicInstanceId || null,
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

  async updateMappingSyncMetadata(mappingId, { lastSyncAt, lastSyncStatus, lastDocCount, lastDocFingerprint, lastSyncDurationMs }) {
    const update = {
      last_sync_at: lastSyncAt || new Date().toISOString(),
      last_sync_status: lastSyncStatus || 'success',
    };
    if (lastDocCount !== undefined) update.last_doc_count = lastDocCount;
    if (lastDocFingerprint !== undefined) update.last_doc_fingerprint = lastDocFingerprint;
    if (lastSyncDurationMs !== undefined) update.last_sync_duration_ms = lastSyncDurationMs;

    const { error } = await this.#supabase
      .from(MAPPINGS_TABLE)
      .update(update)
      .eq('id', mappingId);

    if (error) {
      throw new Error(`Erro ao atualizar metadata do mapping: ${error.message}`);
    }
  }

  // --- Resumo ---

  async getSummary(options = {}) {
    const { filterBy = 'created' } = options;
    const { since, until } = this.#dateRangeFromOptions(options);
    const dateColumn = filterBy === 'synced' ? 'synced_at' : 'autodoc_created_at';

    let query = this.#supabase
      .from(DOCUMENTS_TABLE)
      .select('project_code, classification, document_name, raw_size, discipline_name')
      .gte(dateColumn, since)
      .neq('project_code', '__DISMISSED__');

    if (until) {
      query = query.lte(dateColumn, until);
    }

    const { data, error } = await query;

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

  // --- Estatísticas Diárias ---

  async getDailyStats(options = {}) {
    const { filterBy = 'created' } = options;
    const { since, until } = this.#dateRangeFromOptions(options);
    const dateColumn = filterBy === 'synced' ? 'synced_at' : 'autodoc_created_at';

    let query = this.#supabase
      .from(DOCUMENTS_TABLE)
      .select(`project_code, ${dateColumn}`)
      .gte(dateColumn, since)
      .neq('project_code', '__DISMISSED__');

    if (until) {
      query = query.lte(dateColumn, until);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Erro ao buscar stats diárias: ${error.message}`);
    }

    const rows = data || [];
    const dayMap = {};

    for (const row of rows) {
      const date = new Date(row[dateColumn])
        .toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
      if (!dayMap[date]) dayMap[date] = {};
      dayMap[date][row.project_code] = (dayMap[date][row.project_code] || 0) + 1;
    }

    const dates = Object.keys(dayMap).sort();
    return dates.map(date => {
      const byProject = dayMap[date];
      const total = Object.values(byProject).reduce((s, v) => s + v, 0);
      return { date, total, byProject };
    });
  }

  // --- Nomes de Projetos ---

  async getProjectNameMap() {
    const { data, error } = await this.#supabase
      .from('projects')
      .select('project_code, name');

    if (error) throw new Error(`Erro ao buscar nomes de projetos: ${error.message}`);

    const map = new Map();
    for (const row of (data || [])) {
      map.set(String(row.project_code), row.name || String(row.project_code));
    }
    return map;
  }

  // --- Sync Runs ---

  async createSyncRun(customerId, batchId = null) {
    const row = {
      autodoc_customer_id: customerId,
      status: 'running',
    };
    if (batchId) row.batch_id = batchId;

    const { data, error } = await this.#supabase
      .from(SYNC_RUNS_TABLE)
      .insert(row)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao criar sync run: ${error.message}`);
    }

    return data;
  }

  async timeoutStaleRuns(minutesThreshold = 30) {
    const cutoff = new Date(Date.now() - minutesThreshold * 60 * 1000).toISOString();

    const { data, error } = await this.#supabase
      .from(SYNC_RUNS_TABLE)
      .update({
        status: 'timeout',
        finished_at: new Date().toISOString(),
        error: `Timeout: sync não completou em ${minutesThreshold} minutos`,
      })
      .eq('status', 'running')
      .lt('started_at', cutoff)
      .select('id');

    if (error) {
      throw new Error(`Erro ao limpar sync runs órfãos: ${error.message}`);
    }

    return (data || []).length;
  }

  async getRecentSyncRuns(hours = 2, { batchId } = {}) {
    let query = this.#supabase
      .from(SYNC_RUNS_TABLE)
      .select('*')
      .order('started_at', { ascending: false });

    if (batchId) {
      query = query.eq('batch_id', batchId);
    } else {
      const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
      query = query.gte('started_at', since);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Erro ao buscar sync runs recentes: ${error.message}`);
    }

    return data || [];
  }

  async updateSyncRunProgress(id, { currentProject, projectsCompleted, totalProjects }) {
    const update = {};
    if (currentProject !== undefined) update.current_project = currentProject;
    if (projectsCompleted !== undefined) update.projects_completed = projectsCompleted;
    if (totalProjects !== undefined) update.total_projects = totalProjects;

    const { error } = await this.#supabase
      .from(SYNC_RUNS_TABLE)
      .update(update)
      .eq('id', id);

    if (error) {
      console.warn(`Erro ao atualizar progresso sync run ${id}: ${error.message}`);
    }
  }

  // --- Diagnostics ---

  async getDiagnostics() {
    // 1. All mappings (active + inactive)
    const { data: mappings, error: mappingsErr } = await this.#supabase
      .from(MAPPINGS_TABLE)
      .select('*')
      .order('autodoc_customer_name', { ascending: true });

    if (mappingsErr) throw new Error(`Erro ao buscar mappings: ${mappingsErr.message}`);

    // 2. Recent sync runs (last 48h) with project_results
    const since48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const { data: recentRuns, error: runsErr } = await this.#supabase
      .from(SYNC_RUNS_TABLE)
      .select('*')
      .gte('started_at', since48h)
      .order('started_at', { ascending: false });

    if (runsErr) throw new Error(`Erro ao buscar sync runs: ${runsErr.message}`);

    // 3. Doc counts per project_code (last 7d by autodoc_created_at)
    const since7d = new Date();
    since7d.setDate(since7d.getDate() - 7);
    const since7dStr = since7d.toISOString();

    const { data: recentByCreated, error: createdErr } = await this.#supabase
      .from(DOCUMENTS_TABLE)
      .select('project_code')
      .gte('autodoc_created_at', since7dStr)
      .neq('project_code', '__DISMISSED__');

    if (createdErr) throw new Error(`Erro ao buscar docs by created: ${createdErr.message}`);

    // 4. Doc counts per project_code (last 7d by synced_at)
    const { data: recentBySynced, error: syncedErr } = await this.#supabase
      .from(DOCUMENTS_TABLE)
      .select('project_code')
      .gte('synced_at', since7dStr)
      .neq('project_code', '__DISMISSED__');

    if (syncedErr) throw new Error(`Erro ao buscar docs by synced: ${syncedErr.message}`);

    // Build counts
    const countByCreated = {};
    for (const row of (recentByCreated || [])) {
      countByCreated[row.project_code] = (countByCreated[row.project_code] || 0) + 1;
    }

    const countBySynced = {};
    for (const row of (recentBySynced || [])) {
      countBySynced[row.project_code] = (countBySynced[row.project_code] || 0) + 1;
    }

    // 5. Aggregate project results from recent sync runs
    const projectErrors = {};
    for (const run of (recentRuns || [])) {
      if (!run.project_results) continue;
      for (const pr of run.project_results) {
        if (pr.status === 'error') {
          if (!projectErrors[pr.projectCode]) projectErrors[pr.projectCode] = [];
          projectErrors[pr.projectCode].push({
            error: pr.error,
            runId: run.id,
            startedAt: run.started_at,
          });
        }
      }
    }

    // 6. Build per-mapping diagnostics
    const mappingDiagnostics = (mappings || []).map(m => {
      const code = m.portfolio_project_code;
      return {
        ...m,
        docsLast7dByCreated: countByCreated[code] || 0,
        docsLast7dBySynced: countBySynced[code] || 0,
        recentErrors: projectErrors[code] || [],
        suspect: m.active && (countBySynced[code] || 0) === 0,
      };
    });

    const suspects = mappingDiagnostics.filter(m => m.suspect);
    const gapProjects = mappingDiagnostics.filter(m =>
      m.active && (countBySynced[m.portfolio_project_code] || 0) > (countByCreated[m.portfolio_project_code] || 0)
    );

    return {
      mappings: mappingDiagnostics,
      recentRuns: recentRuns || [],
      suspects,
      gapProjects,
      totals: {
        activeMappings: (mappings || []).filter(m => m.active).length,
        totalMappings: (mappings || []).length,
        projectsWithDocsCreated: Object.keys(countByCreated).length,
        projectsWithDocsSynced: Object.keys(countBySynced).length,
        suspectsCount: suspects.length,
      },
    };
  }

  async completeSyncRun(id, { projectsScanned = 0, documentsFound = 0, newDocuments = 0, error: runError = null, status = 'completed', projectResults = null }) {
    const update = {
      finished_at: new Date().toISOString(),
      projects_scanned: projectsScanned,
      documents_found: documentsFound,
      new_documents: newDocuments,
      error: runError,
      status,
    };
    if (projectResults) {
      update.project_results = projectResults;
    }

    const { error } = await this.#supabase
      .from(SYNC_RUNS_TABLE)
      .update(update)
      .eq('id', id);

    if (error) {
      throw new Error(`Erro ao completar sync run: ${error.message}`);
    }
  }
}

export { SupabaseAutodocEntregasRepository };
