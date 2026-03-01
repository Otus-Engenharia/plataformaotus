/**
 * Implementação: SupabaseWeeklyReportRepository
 *
 * Implementa a interface WeeklyReportRepository usando Supabase como storage.
 */

import { WeeklyReportRepository } from '../../domain/weekly-reports/WeeklyReportRepository.js';
import { WeeklyReport } from '../../domain/weekly-reports/entities/WeeklyReport.js';
import { getSupabaseClient } from '../../supabase.js';

const TABLE = 'weekly_reports';

class SupabaseWeeklyReportRepository extends WeeklyReportRepository {
  #supabase;

  constructor() {
    super();
    this.#supabase = getSupabaseClient();
  }

  async save(report) {
    const data = report.toPersistence();
    delete data.id; // Supabase gera o UUID

    const { data: inserted, error } = await this.#supabase
      .from(TABLE)
      .insert(data)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao salvar relatório semanal: ${error.message}`);
    }

    return WeeklyReport.fromPersistence(inserted);
  }

  async update(report) {
    const data = report.toPersistence();
    const id = data.id;
    delete data.id;
    delete data.created_at;

    const { data: updated, error } = await this.#supabase
      .from(TABLE)
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao atualizar relatório semanal: ${error.message}`);
    }

    return WeeklyReport.fromPersistence(updated);
  }

  async findById(id) {
    const { data, error } = await this.#supabase
      .from(TABLE)
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Erro ao buscar relatório: ${error.message}`);
    }

    return WeeklyReport.fromPersistence(data);
  }

  async findByProject(projectCode, options = {}) {
    const { limit = 10 } = options;

    const { data, error } = await this.#supabase
      .from(TABLE)
      .select('*')
      .eq('project_code', projectCode)
      .order('generated_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Erro ao buscar relatórios do projeto: ${error.message}`);
    }

    return (data || []).map(row => WeeklyReport.fromPersistence(row));
  }

  async findByWeek(weekYear, weekNumber) {
    const { data, error } = await this.#supabase
      .from(TABLE)
      .select('*')
      .eq('week_year', weekYear)
      .eq('week_number', weekNumber)
      .eq('status', 'completed');

    if (error) {
      throw new Error(`Erro ao buscar relatórios da semana: ${error.message}`);
    }

    return (data || []).map(row => WeeklyReport.fromPersistence(row));
  }

  async getWeeklyStats(options = {}) {
    const { weeks = 12 } = options;

    // Calcula a data de corte (N semanas atrás)
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - weeks * 7);

    const { data, error } = await this.#supabase
      .from(TABLE)
      .select('week_year, week_number, week_text, project_code')
      .eq('status', 'completed')
      .gte('generated_at', cutoff.toISOString())
      .order('week_year', { ascending: true })
      .order('week_number', { ascending: true });

    if (error) {
      throw new Error(`Erro ao buscar estatísticas: ${error.message}`);
    }

    // Agrupa por semana e conta projetos únicos
    const grouped = new Map();
    for (const row of (data || [])) {
      const key = `${row.week_year}-${row.week_number}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          week_year: row.week_year,
          week_number: row.week_number,
          week_text: row.week_text || `S${row.week_number}`,
          projects: new Set(),
        });
      }
      grouped.get(key).projects.add(row.project_code);
    }

    return Array.from(grouped.values()).map(g => ({
      week_year: g.week_year,
      week_number: g.week_number,
      week_text: g.week_text,
      total_generated: g.projects.size,
    }));
  }

  async existsForProjectWeek(projectCode, weekYear, weekNumber) {
    const { count, error } = await this.#supabase
      .from(TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('project_code', projectCode)
      .eq('week_year', weekYear)
      .eq('week_number', weekNumber)
      .eq('status', 'completed');

    if (error) {
      throw new Error(`Erro ao verificar existência: ${error.message}`);
    }

    return count > 0;
  }

  async saveSnapshot({ weekYear, weekNumber, snapshotDate, totalActiveProjects, projectsReportEnabled, reportsSent, pctReportEnabled, pctReportsSent, leaderName = null }) {
    const payload = {
      week_year: weekYear,
      week_number: weekNumber,
      snapshot_date: snapshotDate,
      total_active_projects: totalActiveProjects,
      projects_report_enabled: projectsReportEnabled,
      reports_sent: reportsSent,
      pct_report_enabled: pctReportEnabled,
      pct_reports_sent: pctReportsSent,
      leader_name: leaderName,
    };

    // Check if snapshot exists
    let query = this.#supabase
      .from('weekly_kpi_snapshots')
      .select('id')
      .eq('week_year', weekYear)
      .eq('week_number', weekNumber);

    if (leaderName) {
      query = query.eq('leader_name', leaderName);
    } else {
      query = query.is('leader_name', null);
    }

    const { data: existing } = await query.maybeSingle();

    if (existing) {
      const { data, error } = await this.#supabase
        .from('weekly_kpi_snapshots')
        .update(payload)
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw new Error(`Erro ao atualizar snapshot: ${error.message}`);
      return data;
    } else {
      const { data, error } = await this.#supabase
        .from('weekly_kpi_snapshots')
        .insert(payload)
        .select()
        .single();
      if (error) throw new Error(`Erro ao inserir snapshot: ${error.message}`);
      return data;
    }
  }

  async getSnapshots({ weeks = 12, leaderName = null } = {}) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - weeks * 7);

    let query = this.#supabase
      .from('weekly_kpi_snapshots')
      .select('*')
      .gte('snapshot_date', cutoff.toISOString().split('T')[0])
      .order('week_year', { ascending: true })
      .order('week_number', { ascending: true });

    if (leaderName) {
      query = query.eq('leader_name', leaderName);
    } else {
      query = query.is('leader_name', null);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Erro ao buscar snapshots: ${error.message}`);
    return data || [];
  }

  async snapshotExists(weekYear, weekNumber, leaderName = null) {
    let query = this.#supabase
      .from('weekly_kpi_snapshots')
      .select('id')
      .eq('week_year', weekYear)
      .eq('week_number', weekNumber);

    if (leaderName) {
      query = query.eq('leader_name', leaderName);
    } else {
      query = query.is('leader_name', null);
    }

    const { data } = await query.maybeSingle();
    return !!data;
  }
}

export { SupabaseWeeklyReportRepository };
