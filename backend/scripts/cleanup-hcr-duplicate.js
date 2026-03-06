/**
 * Script one-time: Remove projeto duplicado HCR_AVELL com cascade.
 *
 * Uso:
 *   cd backend && node scripts/cleanup-hcr-duplicate.js
 *
 * Pré-requisito: .env configurado com Supabase.
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanup() {
  console.log('=== Cleanup HCR_AVELL Duplicate ===\n');

  // Find the project
  const { data: projects, error } = await supabase
    .from('projects')
    .select('id, name, project_code, company_id, status')
    .or('project_code.eq.HCR_AVELL,name.eq.HCR_AVELL');

  if (error) {
    console.error('Error finding project:', error);
    return;
  }

  if (!projects?.length) {
    console.log('No HCR_AVELL project found. Nothing to clean up.');
    return;
  }

  console.log(`Found ${projects.length} HCR_AVELL project(s):`);
  projects.forEach(p => console.log(`  - ID: ${p.id}, Name: ${p.name}, Code: ${p.project_code}, Status: ${p.status}`));

  for (const project of projects) {
    const pid = project.id;
    console.log(`\nDeleting project ID ${pid} (${project.name})...`);

    // Delete in dependency order
    const tables = [
      'project_comercial_infos',
      'project_features',
      'project_services',
      'project_disciplines',
    ];

    for (const table of tables) {
      const { error: delErr, count } = await supabase
        .from(table)
        .delete({ count: 'exact' })
        .eq('project_id', pid);

      console.log(`  ${table}: ${delErr ? 'ERROR - ' + delErr.message : `deleted ${count || 0} rows`}`);
    }

    // Delete the project itself
    const { error: projErr } = await supabase
      .from('projects')
      .delete()
      .eq('id', pid);

    console.log(`  projects: ${projErr ? 'ERROR - ' + projErr.message : 'deleted'}`);
  }

  console.log('\nCleanup complete.');
}

cleanup().catch(err => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});
