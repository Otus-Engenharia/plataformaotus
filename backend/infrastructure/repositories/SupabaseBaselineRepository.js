/**
 * Implementação: SupabaseBaselineRepository
 *
 * Implementa a interface BaselineRepository usando:
 * - Supabase para metadados de baselines
 * - BigQuery para snapshots de tarefas
 */

import { BaselineRepository } from '../../domain/baselines/BaselineRepository.js';
import { Baseline } from '../../domain/baselines/entities/Baseline.js';
import { getSupabaseClient } from '../../supabase.js';
import { BigQuery } from '@google-cloud/bigquery';
import dotenv from 'dotenv';
dotenv.config();

const BASELINES_TABLE = 'baselines';
const BQ_SNAPSHOTS_TABLE = 'baseline_task_snapshots';
const BQ_DATASET = 'smartsheet_atrasos';
const BQ_PROJECT = process.env.BIGQUERY_PROJECT_ID;
const BQ_LOCATION = process.env.BIGQUERY_LOCATION || 'southamerica-east1';

class SupabaseBaselineRepository extends BaselineRepository {
  #supabase;
  #bigquery;

  constructor() {
    super();
    this.#supabase = getSupabaseClient();
    this.#bigquery = new BigQuery({ projectId: BQ_PROJECT });
  }

  // =====================
  // Supabase (metadados)
  // =====================

  async getSummaryByProject() {
    const { data, error } = await this.#supabase
      .from(BASELINES_TABLE)
      .select('project_code, revision_number');

    if (error) {
      throw new Error(`Erro ao buscar resumo: ${error.message}`);
    }

    // Agrupar por project_code
    const grouped = {};
    for (const row of (data || [])) {
      if (!grouped[row.project_code]) {
        grouped[row.project_code] = 0;
      }
      grouped[row.project_code]++;
    }

    return grouped;
  }

  async findByProjectCode(projectCode) {
    const { data, error } = await this.#supabase
      .from(BASELINES_TABLE)
      .select('*')
      .eq('project_code', projectCode)
      .order('revision_number', { ascending: true });

    if (error) {
      throw new Error(`Erro ao buscar baselines: ${error.message}`);
    }

    return (data || []).map(row => Baseline.fromPersistence(row));
  }

  async findById(id) {
    const { data, error } = await this.#supabase
      .from(BASELINES_TABLE)
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Erro ao buscar baseline: ${error.message}`);
    }
    if (!data) return null;

    return Baseline.fromPersistence(data);
  }

  async getNextRevisionNumber(projectCode) {
    const { data, error } = await this.#supabase
      .from(BASELINES_TABLE)
      .select('revision_number')
      .eq('project_code', projectCode)
      .order('revision_number', { ascending: false })
      .limit(1);

    if (error) {
      throw new Error(`Erro ao buscar próxima revisão: ${error.message}`);
    }

    if (!data || data.length === 0) return 0;
    return data[0].revision_number + 1;
  }

  async save(baseline) {
    const persistence = baseline.toPersistence();

    const { data, error } = await this.#supabase
      .from(BASELINES_TABLE)
      .insert(persistence)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao salvar baseline: ${error.message}`);
    }

    return Baseline.fromPersistence(data);
  }

  async update(baseline) {
    const persistence = baseline.toPersistence();

    const { data, error } = await this.#supabase
      .from(BASELINES_TABLE)
      .update({
        name: persistence.name,
        description: persistence.description,
        is_active: persistence.is_active,
        task_count: persistence.task_count,
        updated_at: new Date().toISOString(),
      })
      .eq('id', baseline.id)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao atualizar baseline: ${error.message}`);
    }

    return Baseline.fromPersistence(data);
  }

  async delete(id) {
    // Delete metadata from Supabase
    const { error } = await this.#supabase
      .from(BASELINES_TABLE)
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Erro ao deletar baseline: ${error.message}`);
    }

    // Delete task snapshots from BigQuery
    await this.deleteTaskSnapshots(id);
  }

  // =====================
  // BigQuery (snapshots)
  // =====================

  async saveTaskSnapshots(baselineId, projectCode, snapshotDate, tasks) {
    if (!tasks || tasks.length === 0) return 0;

    const dataset = this.#bigquery.dataset(BQ_DATASET);
    const table = dataset.table(BQ_SNAPSHOTS_TABLE);

    const rows = tasks.map(task => ({
      baseline_id: baselineId,
      project_code: projectCode,
      row_number: task.rowNumber || task.row_number || null,
      nome_tarefa: task.NomeDaTarefa || task.nome_tarefa || null,
      data_inicio: this.#formatDate(task.DataDeInicio || task.data_inicio),
      data_termino: this.#formatDate(task.DataDeTermino || task.data_termino),
      status: task.Status || task.status || null,
      disciplina: task.Disciplina || task.disciplina || null,
      fase_nome: task.fase_nome || null,
      level: task.Level || task.level || null,
      snapshot_date: snapshotDate,
      created_at: this.#bigquery.timestamp(new Date()),
    }));

    // Insert in batches of 500
    const BATCH_SIZE = 500;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      await table.insert(batch);
    }

    return rows.length;
  }

  async getTaskSnapshots(baselineId) {
    const query = `
      SELECT
        baseline_id,
        project_code,
        row_number AS rowNumber,
        nome_tarefa AS NomeDaTarefa,
        data_inicio AS DataDeInicio,
        data_termino AS DataDeTermino,
        status AS Status,
        disciplina AS Disciplina,
        fase_nome,
        level AS Level,
        snapshot_date
      FROM \`${BQ_PROJECT}.${BQ_DATASET}.${BQ_SNAPSHOTS_TABLE}\`
      WHERE baseline_id = @baselineId
      ORDER BY row_number
    `;

    const [job] = await this.#bigquery.createQueryJob({
      query,
      params: { baselineId },
      location: BQ_LOCATION,
    });

    const [rows] = await job.getQueryResults();
    return rows;
  }

  async deleteTaskSnapshots(baselineId) {
    const query = `
      DELETE FROM \`${BQ_PROJECT}.${BQ_DATASET}.${BQ_SNAPSHOTS_TABLE}\`
      WHERE baseline_id = @baselineId
    `;

    try {
      const [job] = await this.#bigquery.createQueryJob({
        query,
        params: { baselineId },
        location: BQ_LOCATION,
      });
      await job.getQueryResults();
    } catch (err) {
      console.warn(`Aviso: Erro ao deletar snapshots do BigQuery (baseline ${baselineId}):`, err.message);
    }
  }

  // =====================
  // Batch queries (marcos enrichment)
  // =====================

  /**
   * Busca data_termino da última baseline ativa para múltiplos projetos de uma vez.
   * Retorna Map: projectCode → Map(row_number_string → data_termino_string)
   */
  async getLatestBaselineTaskDates(projectCodes) {
    if (!projectCodes || projectCodes.length === 0) return new Map();

    // 1. Buscar últimas baselines ativas por projeto (Supabase)
    const { data, error } = await this.#supabase
      .from(BASELINES_TABLE)
      .select('id, project_code, revision_number')
      .in('project_code', projectCodes)
      .eq('is_active', true)
      .order('revision_number', { ascending: false });

    if (error) {
      console.error('Erro ao buscar baselines para marcos:', error.message);
      return new Map();
    }

    // Pegar o mais recente (maior revision_number) por project_code
    const latestByProject = {};
    for (const bl of (data || [])) {
      if (!latestByProject[bl.project_code]) {
        latestByProject[bl.project_code] = bl;
      }
    }

    const baselines = Object.values(latestByProject);
    if (baselines.length === 0) return new Map();

    const baselineIds = baselines.map(b => b.id);

    // 2. BigQuery: buscar row_number + data_termino dos snapshots (query única)
    const idList = baselineIds.map(id => `'${id}'`).join(',');
    const query = `
      SELECT baseline_id, project_code, row_number, data_termino
      FROM \`${BQ_PROJECT}.${BQ_DATASET}.${BQ_SNAPSHOTS_TABLE}\`
      WHERE baseline_id IN (${idList})
        AND row_number IS NOT NULL
        AND data_termino IS NOT NULL
    `;

    try {
      const [job] = await this.#bigquery.createQueryJob({
        query,
        location: BQ_LOCATION,
      });
      const [rows] = await job.getQueryResults();

      // 3. Mapear: projectCode → Map(row_number → data_termino)
      const result = new Map();
      for (const row of rows) {
        const pc = row.project_code;
        if (!result.has(pc)) result.set(pc, new Map());
        const rowNum = String(row.row_number);
        const dt = row.data_termino?.value || row.data_termino;
        result.get(pc).set(rowNum, dt);
      }
      return result;
    } catch (err) {
      console.error('Erro ao buscar snapshots para marcos:', err.message);
      return new Map();
    }
  }

  // =====================
  // Helpers
  // =====================

  #formatDate(value) {
    if (!value) return null;
    // BigQuery DATE object { value: 'YYYY-MM-DD' }
    if (typeof value === 'object' && value.value) return value.value;
    // String ISO
    if (typeof value === 'string') return value.split('T')[0];
    // Date object
    if (value instanceof Date) return value.toISOString().split('T')[0];
    return String(value);
  }
}

export { SupabaseBaselineRepository };
