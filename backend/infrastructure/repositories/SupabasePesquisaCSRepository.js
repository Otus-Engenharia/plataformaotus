/**
 * Implementação: SupabasePesquisaCSRepository
 *
 * Implementa a interface PesquisaCSRepository usando Supabase como storage.
 */

import { PesquisaCSRepository } from '../../domain/pesquisas-cs/PesquisaCSRepository.js';
import { PercepcaoEquipe } from '../../domain/pesquisas-cs/entities/PercepcaoEquipe.js';
import { getSupabaseClient } from '../../supabase.js';

const TABLE = 'cs_percepcao_equipe';

class SupabasePesquisaCSRepository extends PesquisaCSRepository {
  #supabase;

  constructor() {
    super();
    this.#supabase = getSupabaseClient();
  }

  async save(percepcao) {
    const persistData = percepcao.toPersistence();
    delete persistData.id;

    const { data, error } = await this.#supabase
      .from(TABLE)
      .insert(persistData)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new Error('Já existe uma resposta deste respondente para este projeto/período.');
      }
      throw new Error(`Erro ao criar percepção: ${error.message}`);
    }

    return PercepcaoEquipe.fromPersistence(data);
  }

  async saveMany(percepcoes) {
    const rows = percepcoes.map(p => {
      const d = p.toPersistence();
      delete d.id;
      return d;
    });

    const { data, error } = await this.#supabase
      .from(TABLE)
      .upsert(rows, {
        onConflict: 'project_code,mes_referencia,ano_referencia,respondente_email',
      })
      .select();

    if (error) {
      throw new Error(`Erro ao importar percepções: ${error.message}`);
    }

    return (data || []).map(row => PercepcaoEquipe.fromPersistence(row));
  }

  async findAll(filters = {}) {
    let query = this.#supabase
      .from(TABLE)
      .select('*')
      .order('ano_referencia', { ascending: false })
      .order('mes_referencia', { ascending: false })
      .order('project_code', { ascending: true });

    if (filters.ano) {
      query = query.eq('ano_referencia', filters.ano);
    }
    if (filters.mes) {
      query = query.eq('mes_referencia', filters.mes);
    }
    if (filters.projectCode) {
      query = query.eq('project_code', filters.projectCode);
    }
    if (filters.respondenteEmail) {
      query = query.eq('respondente_email', filters.respondenteEmail);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Erro ao buscar percepções: ${error.message}`);
    }

    return (data || []).map(row => PercepcaoEquipe.fromPersistence(row));
  }

  async findById(id) {
    const { data, error } = await this.#supabase
      .from(TABLE)
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Erro ao buscar percepção: ${error.message}`);
    }

    return data ? PercepcaoEquipe.fromPersistence(data) : null;
  }

  async findProjetosComResposta(mes, ano) {
    const { data, error } = await this.#supabase
      .from(TABLE)
      .select('project_code')
      .eq('mes_referencia', mes)
      .eq('ano_referencia', ano);

    if (error) {
      throw new Error(`Erro ao buscar projetos com resposta: ${error.message}`);
    }

    return [...new Set((data || []).map(r => r.project_code))];
  }

  async delete(id) {
    const { error } = await this.#supabase
      .from(TABLE)
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Erro ao remover percepção: ${error.message}`);
    }
  }
}

export { SupabasePesquisaCSRepository };
