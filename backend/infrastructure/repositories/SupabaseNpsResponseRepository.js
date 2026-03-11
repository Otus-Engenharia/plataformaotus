/**
 * Implementação: SupabaseNpsResponseRepository
 *
 * Implementa a interface NpsResponseRepository usando Supabase como storage.
 */

import { NpsResponseRepository } from '../../domain/nps/NpsResponseRepository.js';
import { NpsResponse } from '../../domain/nps/entities/NpsResponse.js';
import { getSupabaseClient } from '../../supabase.js';

const TABLE = 'nps_responses';

class SupabaseNpsResponseRepository extends NpsResponseRepository {
  #supabase;

  constructor() {
    super();
    this.#supabase = getSupabaseClient();
  }

  async findAll(options = {}) {
    const { projectCode, projectCodes, source, limit } = options;

    let query = this.#supabase
      .from(TABLE)
      .select('*')
      .order('created_at', { ascending: false });

    if (projectCode) {
      query = query.eq('project_code', projectCode);
    }

    if (projectCodes && projectCodes.length > 0) {
      query = query.in('project_code', projectCodes);
    }

    if (source) {
      query = query.eq('source', source);
    }

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Erro ao buscar respostas NPS: ${error.message}`);
    }

    return (data || []).map(row => NpsResponse.fromPersistence(row));
  }

  async findById(id) {
    const { data, error } = await this.#supabase
      .from(TABLE)
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Erro ao buscar resposta NPS: ${error.message}`);
    }

    return data ? NpsResponse.fromPersistence(data) : null;
  }

  async findByProject(projectCode) {
    return this.findAll({ projectCode });
  }

  async save(npsResponse) {
    const persistData = npsResponse.toPersistence();
    delete persistData.id;

    const { data, error } = await this.#supabase
      .from(TABLE)
      .insert(persistData)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao salvar resposta NPS: ${error.message}`);
    }

    return NpsResponse.fromPersistence(data);
  }

  async saveBatch(entities) {
    const rows = entities.map(e => {
      const d = e.toPersistence();
      delete d.id;
      return d;
    });

    const { data, error } = await this.#supabase
      .from(TABLE)
      .insert(rows)
      .select();

    if (error) {
      throw new Error(`Erro ao salvar batch NPS: ${error.message}`);
    }

    return (data || []).map(row => NpsResponse.fromPersistence(row));
  }

  async getStats(options = {}) {
    const { projectCode, projectCodes, source } = options;

    let query = this.#supabase
      .from(TABLE)
      .select('nps_score, csat_score, ces_score');

    if (projectCode) {
      query = query.eq('project_code', projectCode);
    }

    if (projectCodes && projectCodes.length > 0) {
      query = query.in('project_code', projectCodes);
    }

    if (source) {
      query = query.eq('source', source);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Erro ao buscar estatísticas NPS: ${error.message}`);
    }

    const rows = data || [];
    const total = rows.length;

    if (total === 0) {
      return {
        total: 0, promoters: 0, passives: 0, detractors: 0,
        nps_score: null, average_nps: null, average_csat: null, average_ces: null,
      };
    }

    let promoters = 0, passives = 0, detractors = 0;
    let npsSum = 0, npsCount = 0;
    let csatSum = 0, csatCount = 0;
    let cesSum = 0, cesCount = 0;

    for (const row of rows) {
      if (row.nps_score != null) {
        npsSum += row.nps_score;
        npsCount++;
        if (row.nps_score >= 9) promoters++;
        else if (row.nps_score >= 7) passives++;
        else detractors++;
      }
      if (row.csat_score != null) {
        csatSum += row.csat_score;
        csatCount++;
      }
      if (row.ces_score != null) {
        cesSum += row.ces_score;
        cesCount++;
      }
    }

    const npsScoreCalc = npsCount > 0
      ? Math.round(((promoters - detractors) / npsCount) * 100)
      : null;

    return {
      total,
      promoters,
      passives,
      detractors,
      nps_score: npsScoreCalc,
      average_nps: npsCount > 0 ? Math.round((npsSum / npsCount) * 10) / 10 : null,
      average_csat: csatCount > 0 ? Math.round((csatSum / csatCount) * 10) / 10 : null,
      average_ces: cesCount > 0 ? Math.round((cesSum / cesCount) * 10) / 10 : null,
    };
  }
}

export { SupabaseNpsResponseRepository };
