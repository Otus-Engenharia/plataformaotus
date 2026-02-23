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
