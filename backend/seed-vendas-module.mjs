/**
 * Script para inserir o módulo Vendas no Supabase
 * Executar uma única vez: node seed-vendas-module.mjs
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

async function seed() {
  const moduleData = {
    id: 'vendas',
    name: 'Vendas',
    description: 'Área comercial e passagem de projetos',
    icon_name: 'vendas',
    path: '/vendas',
    color: '#f59e0b',
    visible: true,
    show_on_home: true,
    min_access_level: 3, // admin, director, dev (vendas acessa via module_overrides)
    sort_order: 90,
    area: 'vendas',
  };

  // Verificar se ja existe
  const { data: existing } = await supabase
    .from('modules')
    .select('id')
    .eq('id', moduleData.id)
    .single();

  if (existing) {
    console.log('Modulo "Vendas" ja existe. Atualizando...');
    const { data, error } = await supabase
      .from('modules')
      .update(moduleData)
      .eq('id', moduleData.id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar:', error.message);
      process.exit(1);
    }
    console.log('Modulo atualizado:', data);
  } else {
    console.log('Inserindo modulo "Vendas"...');
    const { data, error } = await supabase
      .from('modules')
      .insert(moduleData)
      .select()
      .single();

    if (error) {
      console.error('Erro ao inserir:', error.message);
      process.exit(1);
    }
    console.log('Modulo inserido:', data);
  }

  process.exit(0);
}

seed();
