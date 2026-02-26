/**
 * Implementação: SupabaseUserPreferencesRepository
 *
 * Implementa a interface UserPreferencesRepository usando Supabase como storage.
 */

import { UserPreferencesRepository } from '../../domain/user-preferences/UserPreferencesRepository.js';
import { getSupabaseServiceClient } from '../../supabase.js';

const FAVORITES_TABLE = 'project_favorites';
const PROJECTS_TABLE = 'projects';
const TEAMS_TABLE = 'teams';

class SupabaseUserPreferencesRepository extends UserPreferencesRepository {
  #supabase;

  constructor() {
    super();
    this.#supabase = getSupabaseServiceClient();
  }

  async getFavoriteProjects(userId) {
    const { data, error } = await this.#supabase
      .from(FAVORITES_TABLE)
      .select('project_id, projects(id, name, project_code, comercial_name, status, sector, team_id)')
      .eq('user_id', userId);

    if (error) throw new Error(`Erro ao buscar favoritos: ${error.message}`);

    return (data || [])
      .map(row => row.projects)
      .filter(Boolean);
  }

  async addFavoriteProject(userId, projectId) {
    // Verifica se já existe para evitar duplicata (tabela sem unique constraint)
    const { data: existing } = await this.#supabase
      .from(FAVORITES_TABLE)
      .select('id')
      .eq('user_id', userId)
      .eq('project_id', projectId)
      .maybeSingle();

    if (!existing) {
      const { error } = await this.#supabase
        .from(FAVORITES_TABLE)
        .insert({ user_id: userId, project_id: projectId });

      if (error) throw new Error(`Erro ao adicionar favorito: ${error.message}`);
    }

    // Retorna o projeto completo
    const { data: project, error: projErr } = await this.#supabase
      .from(PROJECTS_TABLE)
      .select('id, name, project_code, comercial_name, status, sector, team_id')
      .eq('id', projectId)
      .single();

    if (projErr) throw new Error(`Erro ao buscar projeto: ${projErr.message}`);

    return project;
  }

  async addFavoriteProjectsByTeam(userId, teamId) {
    // Busca projetos ativos do time (exclui finalizados/encerrados)
    const EXCLUDED_STATUSES = '("execução","obra finalizada","churn pelo cliente","close")';
    const { data: projects, error: projErr } = await this.#supabase
      .from(PROJECTS_TABLE)
      .select('id')
      .eq('team_id', teamId)
      .not('status', 'in', EXCLUDED_STATUSES);

    if (projErr) throw new Error(`Erro ao buscar projetos do time: ${projErr.message}`);

    if (!projects || projects.length === 0) {
      return { count: 0 };
    }

    // Busca favoritos existentes para evitar duplicatas
    const { data: existing } = await this.#supabase
      .from(FAVORITES_TABLE)
      .select('project_id')
      .eq('user_id', userId);

    const existingIds = new Set((existing || []).map(e => e.project_id));
    const newRows = projects
      .filter(p => !existingIds.has(p.id))
      .map(p => ({ user_id: userId, project_id: p.id }));

    if (newRows.length > 0) {
      const { error } = await this.#supabase
        .from(FAVORITES_TABLE)
        .insert(newRows);

      if (error) throw new Error(`Erro ao adicionar favoritos do time: ${error.message}`);
    }

    return { count: newRows.length };
  }

  async removeFavoriteProject(userId, projectId) {
    const { error } = await this.#supabase
      .from(FAVORITES_TABLE)
      .delete()
      .eq('user_id', userId)
      .eq('project_id', projectId);

    if (error) throw new Error(`Erro ao remover favorito: ${error.message}`);
  }

  async getAllProjects() {
    const { data, error } = await this.#supabase
      .from(PROJECTS_TABLE)
      .select('id, name, project_code, comercial_name, status, team_id')
      .order('comercial_name', { ascending: true });

    if (error) throw new Error(`Erro ao buscar projetos: ${error.message}`);

    return data || [];
  }

  async getTeams() {
    const { data, error } = await this.#supabase
      .from(TEAMS_TABLE)
      .select('id, team_name, team_number')
      .order('team_number', { ascending: true });

    if (error) throw new Error(`Erro ao buscar times: ${error.message}`);

    return data || [];
  }
}

export { SupabaseUserPreferencesRepository };
