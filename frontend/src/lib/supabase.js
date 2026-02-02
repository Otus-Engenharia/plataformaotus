/**
 * Supabase Client - Frontend
 */

import { createClient } from '@supabase/supabase-js';

let supabaseClient = null;

export function getSupabaseClient() {
  if (supabaseClient) return supabaseClient;

  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.warn('Supabase nao configurado no frontend');
    return null;
  }

  supabaseClient = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return supabaseClient;
}
