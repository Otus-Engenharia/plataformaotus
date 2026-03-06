/**
 * Script one-time: Popula project_order e client_code a partir dos dados do BigQuery.
 *
 * Uso:
 *   cd backend && node scripts/seed-project-codes.js
 *
 * Pré-requisito: .env configurado com BigQuery e Supabase.
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { BigQuery } from '@google-cloud/bigquery';

const bigquery = new BigQuery({
  projectId: process.env.BIGQUERY_PROJECT_ID,
});

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const dataset = process.env.BIGQUERY_DATASET || 'OTUS_PAINEL';
const projectId = process.env.BIGQUERY_PROJECT_ID;
const location = process.env.BIGQUERY_LOCATION || 'southamerica-east1';

async function seed() {
  console.log('=== Seed Project Codes ===\n');

  // 1. Fetch from BigQuery
  const query = `
    SELECT project_order, project_code_norm
    FROM \`${projectId}.${dataset}.vw_portfolio_completo\`
    WHERE project_order IS NOT NULL
    ORDER BY project_order
  `;

  const [job] = await bigquery.createQueryJob({ query, location });
  await job.promise();
  const [rows] = await job.getQueryResults();

  console.log(`Found ${rows.length} projects in BigQuery with project_order\n`);

  let updatedProjects = 0;
  let updatedCompanies = 0;
  let skipped = 0;
  const companyUpdates = new Map(); // company_id -> client_code

  for (const row of rows) {
    const code = String(row.project_code_norm || '');
    const order = parseInt(row.project_order);

    // Parse 9-digit code
    if (!/^\d{9}$/.test(code)) {
      skipped++;
      console.log(`  Skipped non-9-digit code: "${code}" (order=${order})`);
      continue;
    }

    const xxx = parseInt(code.substring(0, 3)); // project_order
    const yyy = parseInt(code.substring(3, 6)); // client_code

    // Update project_order in Supabase
    const { error: projError } = await supabase
      .from('projects')
      .update({ project_order: order || xxx })
      .eq('project_code', code);

    if (projError) {
      console.log(`  Error updating project ${code}: ${projError.message}`);
    } else {
      updatedProjects++;
    }

    // Find company_id for this project to update client_code
    const { data: projData } = await supabase
      .from('projects')
      .select('company_id')
      .eq('project_code', code)
      .single();

    if (projData?.company_id && !companyUpdates.has(projData.company_id)) {
      companyUpdates.set(projData.company_id, yyy);
    }
  }

  // Batch update companies
  for (const [companyId, clientCode] of companyUpdates) {
    const { error: compError } = await supabase
      .from('companies')
      .update({ client_code: clientCode })
      .eq('id', companyId);

    if (compError) {
      console.log(`  Error updating company ${companyId}: ${compError.message}`);
    } else {
      updatedCompanies++;
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Projects updated: ${updatedProjects}`);
  console.log(`Companies updated: ${updatedCompanies}`);
  console.log(`Skipped (non-9-digit): ${skipped}`);
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
