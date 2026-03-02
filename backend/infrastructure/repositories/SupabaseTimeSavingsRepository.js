/**
 * Implementação: SupabaseTimeSavingsRepository
 *
 * Implementa a interface TimeSavingsRepository usando Supabase como storage.
 */

import { TimeSavingsRepository } from '../../domain/time-savings/TimeSavingsRepository.js';
import { TimeSavingsEvent } from '../../domain/time-savings/entities/TimeSavingsEvent.js';
import { getSupabaseClient } from '../../supabase.js';

const EVENTS_TABLE = 'time_savings_events';
const CATALOG_TABLE = 'time_savings_catalog';

class SupabaseTimeSavingsRepository extends TimeSavingsRepository {
  #supabase;

  constructor() {
    super();
    this.#supabase = getSupabaseClient();
  }

  // --- Eventos ---

  async saveEvent(event) {
    const persistData = event.toPersistence();
    delete persistData.id; // BIGSERIAL gerado pelo banco

    const { data, error } = await this.#supabase
      .from(EVENTS_TABLE)
      .insert(persistData)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao salvar evento de economia: ${error.message}`);
    }

    return TimeSavingsEvent.fromPersistence(data);
  }

  async findEvents(filters = {}) {
    const { catalogId, userEmail, from, to, page = 1, limit = 50 } = filters;

    let query = this.#supabase
      .from(EVENTS_TABLE)
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (catalogId) query = query.eq('catalog_id', catalogId);
    if (userEmail) query = query.eq('user_email', userEmail);
    if (from) query = query.gte('created_at', from);
    if (to) query = query.lte('created_at', to);

    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Erro ao buscar eventos: ${error.message}`);
    }

    return {
      data: (data || []).map(row => TimeSavingsEvent.fromPersistence(row)),
      total: count || 0,
    };
  }

  // --- Agregações ---

  async getSummary(filters = {}) {
    const { from, to, area } = filters;

    let query = this.#supabase
      .from(EVENTS_TABLE)
      .select('minutes_saved, user_email');

    if (from) query = query.gte('created_at', from);
    if (to) query = query.lte('created_at', to);

    // Se filtro por área, precisa fazer join com catálogo
    if (area) {
      const catalogIds = await this.#getCatalogIdsByArea(area);
      if (catalogIds.length === 0) {
        return { totalEvents: 0, totalMinutes: 0, uniqueUsers: 0 };
      }
      query = query.in('catalog_id', catalogIds);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Erro ao buscar sumário: ${error.message}`);
    }

    const uniqueEmails = new Set();
    let totalMinutes = 0;

    for (const row of data || []) {
      totalMinutes += Number(row.minutes_saved);
      uniqueEmails.add(row.user_email);
    }

    return {
      totalEvents: (data || []).length,
      totalMinutes,
      uniqueUsers: uniqueEmails.size,
    };
  }

  async getSummaryByAutomation(filters = {}) {
    const { from, to, area } = filters;

    let query = this.#supabase
      .from(EVENTS_TABLE)
      .select('catalog_id, minutes_saved');

    if (from) query = query.gte('created_at', from);
    if (to) query = query.lte('created_at', to);

    if (area) {
      const catalogIds = await this.#getCatalogIdsByArea(area);
      if (catalogIds.length === 0) return [];
      query = query.in('catalog_id', catalogIds);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Erro ao buscar sumário por automação: ${error.message}`);
    }

    // Agrupar por catalog_id
    const grouped = {};
    for (const row of data || []) {
      if (!grouped[row.catalog_id]) {
        grouped[row.catalog_id] = { eventCount: 0, totalMinutes: 0 };
      }
      grouped[row.catalog_id].eventCount++;
      grouped[row.catalog_id].totalMinutes += Number(row.minutes_saved);
    }

    // Buscar nomes do catálogo
    const catalog = await this.findAllCatalog(false);
    const catalogMap = new Map(catalog.map(c => [c.id, c]));

    return Object.entries(grouped)
      .map(([catalogId, stats]) => ({
        catalogId,
        name: catalogMap.get(catalogId)?.name || catalogId,
        eventCount: stats.eventCount,
        totalMinutes: stats.totalMinutes,
        totalHours: Math.round(stats.totalMinutes / 60 * 10) / 10,
      }))
      .sort((a, b) => b.totalMinutes - a.totalMinutes);
  }

  async getSummaryByUser(filters = {}) {
    const { from, to, area } = filters;

    let query = this.#supabase
      .from(EVENTS_TABLE)
      .select('user_email, user_name, minutes_saved');

    if (from) query = query.gte('created_at', from);
    if (to) query = query.lte('created_at', to);

    if (area) {
      const catalogIds = await this.#getCatalogIdsByArea(area);
      if (catalogIds.length === 0) return [];
      query = query.in('catalog_id', catalogIds);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Erro ao buscar sumário por usuário: ${error.message}`);
    }

    // Agrupar por user_email
    const grouped = {};
    for (const row of data || []) {
      if (!grouped[row.user_email]) {
        grouped[row.user_email] = { userName: row.user_name, eventCount: 0, totalMinutes: 0 };
      }
      grouped[row.user_email].eventCount++;
      grouped[row.user_email].totalMinutes += Number(row.minutes_saved);
      // Atualiza o nome caso esteja null em linhas anteriores
      if (row.user_name) grouped[row.user_email].userName = row.user_name;
    }

    return Object.entries(grouped)
      .map(([userEmail, stats]) => ({
        userEmail,
        userName: stats.userName,
        eventCount: stats.eventCount,
        totalMinutes: stats.totalMinutes,
        totalHours: Math.round(stats.totalMinutes / 60 * 10) / 10,
      }))
      .sort((a, b) => b.totalMinutes - a.totalMinutes);
  }

  async getMonthlyTrend(monthsBack = 12) {
    const fromDate = new Date();
    fromDate.setMonth(fromDate.getMonth() - monthsBack);
    fromDate.setDate(1);
    fromDate.setHours(0, 0, 0, 0);

    const { data, error } = await this.#supabase
      .from(EVENTS_TABLE)
      .select('minutes_saved, created_at')
      .gte('created_at', fromDate.toISOString())
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Erro ao buscar tendência mensal: ${error.message}`);
    }

    // Agrupar por mês (YYYY-MM)
    const grouped = {};
    for (const row of data || []) {
      const date = new Date(row.created_at);
      const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!grouped[month]) {
        grouped[month] = { events: 0, minutes: 0 };
      }
      grouped[month].events++;
      grouped[month].minutes += Number(row.minutes_saved);
    }

    return Object.entries(grouped)
      .map(([month, stats]) => ({
        month,
        events: stats.events,
        minutes: stats.minutes,
        hours: Math.round(stats.minutes / 60 * 10) / 10,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }

  // --- Catálogo ---

  async findAllCatalog(activeOnly = true) {
    let query = this.#supabase
      .from(CATALOG_TABLE)
      .select('*')
      .order('area')
      .order('name');

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Erro ao buscar catálogo: ${error.message}`);
    }

    return data || [];
  }

  async findCatalogById(id) {
    const { data, error } = await this.#supabase
      .from(CATALOG_TABLE)
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Erro ao buscar automação do catálogo: ${error.message}`);
    }

    return data;
  }

  async updateCatalog(id, updates) {
    const updateData = { updated_at: new Date().toISOString() };
    if (updates.default_minutes !== undefined) updateData.default_minutes = updates.default_minutes;
    if (updates.is_active !== undefined) updateData.is_active = updates.is_active;
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;

    const { data, error } = await this.#supabase
      .from(CATALOG_TABLE)
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao atualizar catálogo: ${error.message}`);
    }

    return data;
  }

  // --- Helpers internos ---

  async #getCatalogIdsByArea(area) {
    const { data, error } = await this.#supabase
      .from(CATALOG_TABLE)
      .select('id')
      .eq('area', area)
      .eq('is_active', true);

    if (error) return [];
    return (data || []).map(c => c.id);
  }
}

export { SupabaseTimeSavingsRepository };
