/**
 * Implementação: SupabaseIfcChangeLogRepository
 *
 * Implementa a interface IfcChangeLogRepository usando Supabase.
 */

import { IfcChangeLogRepository } from '../../domain/acd/ifc-changelog/IfcChangeLogRepository.js';
import { IfcFileSnapshot } from '../../domain/acd/ifc-changelog/entities/IfcFileSnapshot.js';
import { IfcChangeLog } from '../../domain/acd/ifc-changelog/entities/IfcChangeLog.js';
import { getSupabaseServiceClient } from '../../supabase.js';

const SNAPSHOTS_TABLE = 'ifc_file_snapshots';
const CHANGE_LOGS_TABLE = 'ifc_change_logs';

class SupabaseIfcChangeLogRepository extends IfcChangeLogRepository {
  #supabase;

  constructor() {
    super();
    this.#supabase = getSupabaseServiceClient();
  }

  // --- Snapshots ---

  async findSnapshotsByProject(projectCode) {
    const { data, error } = await this.#supabase
      .from(SNAPSHOTS_TABLE)
      .select('*')
      .eq('project_code', projectCode);

    if (error) {
      throw new Error(`Erro ao buscar snapshots: ${error.message}`);
    }

    return (data || []).map(row => IfcFileSnapshot.fromPersistence(row));
  }

  async upsertSnapshots(snapshots) {
    if (!snapshots.length) return;

    const rows = snapshots.map(s => {
      // Aceita tanto entidade quanto objeto plain
      if (s.toPersistence) {
        const p = s.toPersistence();
        delete p.id;
        return p;
      }
      // Objeto plain do FileChangeDetector (newSnapshots)
      return {
        project_code: s.projectCode,
        drive_folder_id: s.driveFolderId,
        drive_file_id: s.driveFileId,
        file_name: s.fileName,
        file_size: s.fileSize,
        mime_type: s.mimeType,
        md5_checksum: s.md5Checksum,
        drive_created_time: s.driveCreatedTime || null,
        drive_modified_time: s.driveModifiedTime || null,
        parsed_base_name: s.parsedBaseName,
        parsed_phase: s.parsedPhase,
        parsed_revision: s.parsedRevision,
        parsed_discipline: s.parsedDiscipline,
      };
    });

    const { error } = await this.#supabase
      .from(SNAPSHOTS_TABLE)
      .upsert(rows, { onConflict: 'project_code,drive_file_id' });

    if (error) {
      throw new Error(`Erro ao upsert snapshots: ${error.message}`);
    }
  }

  async updateSnapshot(snapshot) {
    const data = snapshot.toPersistence();
    const { id, ...fields } = data;

    const { error } = await this.#supabase
      .from(SNAPSHOTS_TABLE)
      .update(fields)
      .eq('id', id);

    if (error) {
      throw new Error(`Erro ao atualizar snapshot: ${error.message}`);
    }
  }

  // --- Change Logs ---

  async saveChangeLogs(changeLogs) {
    if (!changeLogs.length) return;

    const rows = changeLogs.map(cl => {
      const p = cl.toPersistence();
      delete p.id;
      return p;
    });

    const { error } = await this.#supabase
      .from(CHANGE_LOGS_TABLE)
      .insert(rows);

    if (error) {
      throw new Error(`Erro ao salvar change logs: ${error.message}`);
    }
  }

  async findChangeLogsByProject(projectCode, options = {}) {
    const { page = 1, limit = 50, category = null } = options;

    let query = this.#supabase
      .from(CHANGE_LOGS_TABLE)
      .select('*', { count: 'exact' })
      .eq('project_code', projectCode)
      .order('created_at', { ascending: false });

    if (category) {
      query = query.eq('category', category);
    }

    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Erro ao buscar change logs: ${error.message}`);
    }

    return {
      data: (data || []).map(row => IfcChangeLog.fromPersistence(row)),
      total: count || 0,
    };
  }

  async findRecentChangeLogs(options = {}) {
    const { page = 1, limit = 20, days = 7 } = options;

    const since = new Date();
    since.setDate(since.getDate() - days);

    let query = this.#supabase
      .from(CHANGE_LOGS_TABLE)
      .select('*', { count: 'exact' })
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false });

    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Erro ao buscar mudanças recentes: ${error.message}`);
    }

    return {
      data: (data || []).map(row => IfcChangeLog.fromPersistence(row)),
      total: count || 0,
    };
  }

  async getRecentSummary(days = 7) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceISO = since.toISOString();

    // Buscar todos os logs do período (sem paginação) para agregar
    const { data, error } = await this.#supabase
      .from(CHANGE_LOGS_TABLE)
      .select('project_code, category, file_name, file_size')
      .gte('created_at', sinceISO);

    if (error) {
      throw new Error(`Erro ao buscar resumo: ${error.message}`);
    }

    const rows = data || [];
    const porCategoria = { nova_revisao: 0, mudanca_fase: 0, novo_arquivo: 0 };
    const projectSet = new Set();
    let tamanhoTotal = 0;

    for (const row of rows) {
      if (porCategoria[row.category] !== undefined) {
        porCategoria[row.category]++;
      }
      projectSet.add(row.project_code);
      tamanhoTotal += Number(row.file_size) || 0;
    }

    return {
      totalMudancas: rows.length,
      porCategoria,
      projetosAtivos: projectSet.size,
      tamanhoTotal,
      logs: rows,
    };
  }

  async getNomenclaturaPatternsForProjects(projectCodes) {
    if (!projectCodes.length) return new Map();

    const { data, error } = await this.#supabase
      .from('project_nomenclatura')
      .select('project_code, segments')
      .eq('tipo', 'modelos')
      .in('project_code', projectCodes);

    if (error) {
      throw new Error(`Erro ao buscar nomenclaturas: ${error.message}`);
    }

    const map = new Map();
    for (const row of (data || [])) {
      map.set(row.project_code, row.segments);
    }
    return map;
  }

  // --- Project Features (read-only) ---

  async findProjectsWithIfcLinks() {
    const { data, error } = await this.#supabase
      .from('project_features')
      .select('link_ifc, projects!inner(project_code)')
      .not('link_ifc', 'is', null);

    if (error) {
      throw new Error(`Erro ao buscar projetos com IFC: ${error.message}`);
    }

    return (data || [])
      .filter(row => row.link_ifc && row.projects?.project_code)
      .map(row => ({
        projectCode: row.projects.project_code,
        linkIfc: row.link_ifc,
      }));
  }
}

export { SupabaseIfcChangeLogRepository };
