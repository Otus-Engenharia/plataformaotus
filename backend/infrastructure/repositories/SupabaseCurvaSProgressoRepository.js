/**
 * Implementação: SupabaseCurvaSProgressoRepository
 *
 * Implementa a interface CurvaSProgressoRepository usando Supabase como storage.
 */

import { CurvaSProgressoRepository } from '../../domain/curva-s-progresso/CurvaSProgressoRepository.js';
import { getSupabaseClient } from '../../supabase.js';

const PHASE_TABLE = 'curva_s_default_phase_weights';
const DISCIPLINE_TABLE = 'curva_s_default_discipline_weights';
const ACTIVITY_TABLE = 'curva_s_default_activity_weights';
const OVERRIDES_TABLE = 'curva_s_project_weight_overrides';

class SupabaseCurvaSProgressoRepository extends CurvaSProgressoRepository {
  #supabase;

  constructor() {
    super();
    this.#supabase = getSupabaseClient();
  }

  // --- Defaults: Phase Weights ---

  async findDefaultPhaseWeights() {
    const { data, error } = await this.#supabase
      .from(PHASE_TABLE)
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      throw new Error(`Erro ao buscar pesos de fases: ${error.message}`);
    }
    return data || [];
  }

  async saveDefaultPhaseWeights(weights) {
    // Deletar todos e reinserir (transacional via batch)
    const { error: deleteError } = await this.#supabase
      .from(PHASE_TABLE)
      .delete()
      .neq('id', 0); // delete all

    if (deleteError) {
      throw new Error(`Erro ao limpar pesos de fases: ${deleteError.message}`);
    }

    if (weights.length === 0) return [];

    const rows = weights.map((w, idx) => ({
      phase_name: w.phase_name,
      weight_percent: w.weight_percent,
      sort_order: w.sort_order ?? idx + 1,
    }));

    const { data, error } = await this.#supabase
      .from(PHASE_TABLE)
      .insert(rows)
      .select();

    if (error) {
      throw new Error(`Erro ao salvar pesos de fases: ${error.message}`);
    }
    return data;
  }

  // --- Defaults: Discipline Weights ---

  async findDefaultDisciplineWeights() {
    const { data, error } = await this.#supabase
      .from(DISCIPLINE_TABLE)
      .select('*')
      .order('weight_factor', { ascending: false });

    if (error) {
      throw new Error(`Erro ao buscar pesos de disciplinas: ${error.message}`);
    }
    return data || [];
  }

  async saveDefaultDisciplineWeights(weights) {
    const { error: deleteError } = await this.#supabase
      .from(DISCIPLINE_TABLE)
      .delete()
      .neq('id', 0);

    if (deleteError) {
      throw new Error(`Erro ao limpar pesos de disciplinas: ${deleteError.message}`);
    }

    if (weights.length === 0) return [];

    const rows = weights.map(w => ({
      discipline_name: w.discipline_name,
      weight_factor: w.weight_factor,
      standard_discipline_id: w.standard_discipline_id || null,
    }));

    const { data, error } = await this.#supabase
      .from(DISCIPLINE_TABLE)
      .insert(rows)
      .select();

    if (error) {
      throw new Error(`Erro ao salvar pesos de disciplinas: ${error.message}`);
    }
    return data;
  }

  // --- Defaults: Activity Weights ---

  async findDefaultActivityWeights() {
    const { data, error } = await this.#supabase
      .from(ACTIVITY_TABLE)
      .select('*')
      .order('weight_factor', { ascending: false });

    if (error) {
      throw new Error(`Erro ao buscar pesos de etapas: ${error.message}`);
    }
    return data || [];
  }

  async saveDefaultActivityWeights(weights) {
    const { error: deleteError } = await this.#supabase
      .from(ACTIVITY_TABLE)
      .delete()
      .neq('id', 0);

    if (deleteError) {
      throw new Error(`Erro ao limpar pesos de etapas: ${deleteError.message}`);
    }

    if (weights.length === 0) return [];

    const rows = weights.map(w => ({
      activity_type: w.activity_type,
      weight_factor: w.weight_factor,
    }));

    const { data, error } = await this.#supabase
      .from(ACTIVITY_TABLE)
      .insert(rows)
      .select();

    if (error) {
      throw new Error(`Erro ao salvar pesos de etapas: ${error.message}`);
    }
    return data;
  }

  // --- Project Overrides ---

  async findProjectOverrides(projectCode) {
    const { data, error } = await this.#supabase
      .from(OVERRIDES_TABLE)
      .select('*')
      .eq('project_code', projectCode)
      .maybeSingle();

    if (error) {
      throw new Error(`Erro ao buscar overrides do projeto: ${error.message}`);
    }
    return data || null;
  }

  async saveProjectOverrides(projectCode, overrides) {
    const row = {
      project_code: projectCode,
      phase_weights: overrides.phase_weights || null,
      discipline_weights: overrides.discipline_weights || null,
      activity_weights: overrides.activity_weights || null,
      is_customized: true,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.#supabase
      .from(OVERRIDES_TABLE)
      .upsert(row, { onConflict: 'project_code' })
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao salvar overrides do projeto: ${error.message}`);
    }
    return data;
  }

  async deleteProjectOverrides(projectCode) {
    const { error } = await this.#supabase
      .from(OVERRIDES_TABLE)
      .delete()
      .eq('project_code', projectCode);

    if (error) {
      throw new Error(`Erro ao remover overrides do projeto: ${error.message}`);
    }
  }
}

export { SupabaseCurvaSProgressoRepository };
