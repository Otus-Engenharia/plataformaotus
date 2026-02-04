/**
 * Módulo de conexão e consultas ao BigQuery
 * 
 * Este arquivo gerencia a conexão com o Google BigQuery e
 * contém as funções para buscar dados do portfólio e Curva S
 */

import { BigQuery } from '@google-cloud/bigquery';
import dotenv from 'dotenv';

dotenv.config();

// Inicializa o cliente BigQuery
// Se GOOGLE_APPLICATION_CREDENTIALS estiver definido, usa automaticamente
// Caso contrário, você pode passar o caminho do arquivo JSON diretamente
const bigquery = new BigQuery({
  projectId: process.env.BIGQUERY_PROJECT_ID,
  // Se tiver o arquivo JSON, descomente a linha abaixo:
  // keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS || './service-account-key.json',
});

const datasetId = process.env.BIGQUERY_DATASET || 'seu_dataset';
const projectId = process.env.BIGQUERY_PROJECT_ID || 'seu-project-id';
const tablePortfolio = process.env.BIGQUERY_TABLE_PORTFOLIO || 'portfolio';
const location = process.env.BIGQUERY_LOCATION || 'southamerica-east1';

/**
 * Função genérica para executar queries no BigQuery
 * @param {string} query - Query SQL a ser executada
 * @returns {Promise<Array>} - Array com os resultados
 */
async function executeQuery(query) {
  try {
    // Log apenas um resumo da query (primeiras 200 caracteres) para não poluir o console
    const queryPreview = query.length > 200 ? query.substring(0, 200) + '...' : query;
    console.log('🔍 Executando query:', queryPreview);
    
    const [job] = await bigquery.createQueryJob({
      query: query,
      location: location, // Localização do dataset (southamerica-east1)
    });

    console.log(`📊 Job ${job.id} iniciado.`);

    // Aguarda o job completar
    await job.promise();
    
    // Busca todos os resultados - método mais simples e confiável
    // O BigQuery SDK automaticamente lida com paginação quando maxResults não é especificado
    // ou quando é um número muito grande
    const [rows] = await job.getQueryResults();
    
    console.log(`✅ Query retornou ${rows.length} linhas no total.`);
    return rows;
  } catch (error) {
    console.error('❌ Erro ao executar query no BigQuery:');
    console.error('   Mensagem:', error.message);
    console.error('   Código:', error.code);
    console.error('   Stack:', error.stack);
    // Log a query completa em caso de erro para debug
    console.error('   Query completa:', query);
    throw error;
  }
}

/**
 * Função auxiliar: Descobre as colunas de uma tabela
 * Use esta função para entender a estrutura da sua tabela
 * 
 * @param {string} tableName - Nome da tabela (opcional, usa a tabela do portfólio por padrão)
 * @returns {Promise<Array>} - Lista de colunas com seus tipos
 */
export async function getTableSchema(tableName = tablePortfolio) {
  // No BigQuery, podemos usar INFORMATION_SCHEMA para descobrir as colunas
  const query = `
    SELECT 
      column_name,
      data_type,
      is_nullable
    FROM \`${projectId}.${datasetId}.INFORMATION_SCHEMA.COLUMNS\`
    WHERE table_name = '${tableName}'
    ORDER BY ordinal_position
  `;
  
  console.log('🔍 Descobrindo estrutura da tabela:', tableName);
  try {
    return await executeQuery(query);
  } catch (error) {
    // Se INFORMATION_SCHEMA não funcionar, vamos tentar uma query simples
    // que retorna apenas uma linha para ver as colunas
    console.log('⚠️ INFORMATION_SCHEMA não disponível, tentando método alternativo...');
    const altQuery = `
      SELECT *
      FROM \`${projectId}.${datasetId}.${tableName}\`
      LIMIT 1
    `;
    const result = await executeQuery(altQuery);
    // Retorna as chaves do primeiro objeto como "colunas"
    if (result.length > 0) {
      return Object.keys(result[0]).map(key => ({
        column_name: key,
        data_type: 'unknown',
        is_nullable: 'YES'
      }));
    }
    throw error;
  }
}

async function getTableSchemaForDataset(datasetName, tableName) {
  const query = `
    SELECT 
      column_name,
      data_type,
      is_nullable
    FROM \`${projectId}.${datasetName}.INFORMATION_SCHEMA.COLUMNS\`
    WHERE table_name = '${tableName}'
    ORDER BY ordinal_position
  `;

  try {
    return await executeQuery(query);
  } catch (error) {
    const altQuery = `
      SELECT *
      FROM \`${projectId}.${datasetName}.${tableName}\`
      LIMIT 1
    `;
    const result = await executeQuery(altQuery);
    if (result.length > 0) {
      return Object.keys(result[0]).map(key => ({
        column_name: key,
        data_type: 'unknown',
        is_nullable: 'YES'
      }));
    }
    throw error;
  }
}

// Cache simples das colunas do portfólio para evitar chamadas repetidas
let portfolioColumnsCache = null;
let portfolioColumnsFetchedAt = 0;
const PORTFOLIO_COLUMNS_TTL_MS = 5 * 60 * 1000;

async function getPortfolioColumns() {
  const now = Date.now();
  if (portfolioColumnsCache && (now - portfolioColumnsFetchedAt) < PORTFOLIO_COLUMNS_TTL_MS) {
    return portfolioColumnsCache;
  }

  const schema = await getTableSchema(tablePortfolio);
  const columns = new Set(
    schema
      .map(col => String(col.column_name || '').toLowerCase())
      .filter(Boolean)
  );

  portfolioColumnsCache = columns;
  portfolioColumnsFetchedAt = now;
  return columns;
}

async function hasPortfolioColumn(columnName) {
  const columns = await getPortfolioColumns();
  return columns.has(String(columnName || '').toLowerCase());
}

// Cache simples do schema de entradas (financeiro.entradas)
let entradasSchemaCache = null;
let entradasSchemaFetchedAt = 0;
const ENTRADAS_COLUMNS_TTL_MS = 5 * 60 * 1000;

async function getEntradasSchema() {
  const now = Date.now();
  if (entradasSchemaCache && (now - entradasSchemaFetchedAt) < ENTRADAS_COLUMNS_TTL_MS) {
    return entradasSchemaCache;
  }

  const schema = await getTableSchemaForDataset('financeiro', 'entradas');
  entradasSchemaCache = schema;
  entradasSchemaFetchedAt = now;

  const columnsList = schema
    .map(col => String(col.column_name || ''))
    .filter(Boolean);
  console.log('🔎 Colunas disponíveis em financeiro.entradas:', columnsList.join(', '));

  return schema;
}

function getColumnsSetFromSchema(schema) {
  return new Set(
    schema
      .map(col => String(col.column_name || '').toLowerCase())
      .filter(Boolean)
  );
}

function pickFirstExistingColumn(columnsSet, candidates) {
  for (const candidate of candidates) {
    if (columnsSet.has(candidate.toLowerCase())) {
      return candidate;
    }
  }
  return null;
}

function pickDateColumnFromSchema(schema) {
  const dateTypes = new Set(['date', 'datetime', 'timestamp']);
  const dateColumn = schema.find(col => dateTypes.has(String(col.data_type || '').toLowerCase()));
  return dateColumn ? String(dateColumn.column_name) : null;
}

/**
 * Busca dados do portfólio de projetos
 * 
 * Esta função busca dados da tabela portifolio_plataforma_enriched
 * 
 * IMPORTANTE: Se a query não funcionar, primeiro execute getTableSchema()
 * para ver quais colunas existem na tabela e ajuste a query abaixo
 * 
 * @param {string|null} leaderName - Nome do líder na coluna 'lider' do BigQuery (opcional, apenas para role 'leader')
 * @returns {Promise<Array>} - Dados do portfólio
 */
export async function queryPortfolio(leaderName = null) {
  let query = `
    SELECT 
      *
    FROM \`${projectId}.${datasetId}.${tablePortfolio}\`
  `;

  // Se um líder específico foi fornecido, filtra apenas os projetos dele
  // A coluna 'lider' contém nomes, não emails
  if (leaderName) {
    const hasLider = await hasPortfolioColumn('lider');
    if (!hasLider) {
      console.warn('⚠️ Coluna "lider" não encontrada na tabela do portfólio. Retornando vazio por segurança.');
      return [];
    }
    // Escapa o nome para evitar SQL injection
    const escapedName = leaderName.replace(/'/g, "''");
    // Compara o nome (case-insensitive)
    query += ` WHERE LOWER(lider) = LOWER('${escapedName}')`;
  }

  query += ` ORDER BY 1 DESC`;

  return await executeQuery(query);
}

/**
 * Busca dados para a Curva S (evolução de custos e receitas ao longo do tempo)
 * 
 * Combina dados do portfólio com custos mensais por projeto
 * Calcula valores acumulados para formar a Curva S
 * 
 * @param {string|null} leaderName - Nome do líder para filtrar projetos (opcional)
 * @param {string|null} projectCode - Código do projeto específico (opcional)
 * @returns {Promise<Array>} - Dados da Curva S agregados por mês e projeto
 */
export async function queryCurvaS(leaderName = null, projectCode = null) {
  // Dataset de custos
  const costDataset = 'financeiro';
  const costTable = 'custo_usuario_projeto_mes';
  
  console.log(`📊 Query Curva S - Dataset: ${costDataset}, Tabela: ${costTable}`);
  console.log(`📊 Filtros - Líder: ${leaderName || 'nenhum'}, Projeto: ${projectCode || 'todos'}`);
  
  const hasLider = await hasPortfolioColumn('lider');
  if (leaderName && !hasLider) {
    console.warn('⚠️ Coluna "lider" não encontrada na tabela do portfólio. Retornando vazio por segurança.');
    return [];
  }

  const leaderSelect = hasLider ? 'lider' : 'NULL AS lider';

  const entradasSchema = await getEntradasSchema();
  const entradasColumns = getColumnsSetFromSchema(entradasSchema);
  let entradasDateColumn = pickFirstExistingColumn(entradasColumns, [
    'M_s',
    'mes',
    'data',
    'data_mes',
    'data_entrada',
    'dt',
    'competencia',
    'data_competencia'
  ]);

  if (!entradasDateColumn) {
    entradasDateColumn = pickDateColumnFromSchema(entradasSchema);
  }

  if (!entradasDateColumn) {
    console.warn('⚠️ Coluna de data não encontrada em financeiro.entradas. Retornando vazio por segurança.');
    return [];
  }

  // Query que combina portfólio com custos mensais
  let query = `
    WITH portfolio_data AS (
      SELECT 
        project_code_norm,
        project_name,
        valor_contrato_total,
        valor_total_contrato_mais_aditivos,
        data_inicio_cronograma,
        data_termino_cronograma,
        data_termino_contrato,
        status,
        ${leaderSelect},
        nome_time
      FROM \`${projectId}.${datasetId}.${tablePortfolio}\`
      WHERE project_code_norm IS NOT NULL
  `;

  // Filtro por líder se fornecido
  if (leaderName) {
    const escapedName = leaderName.replace(/'/g, "''");
    query += ` AND LOWER(lider) = LOWER('${escapedName}')`;
  }

  query += `
    ),
    custos_mensais AS (
      SELECT 
        c.project_code,
        c.projeto,
        c.mes,
        SUM(COALESCE(c.custo_total_usuario_projeto_mes, 0)) AS custo_total_mes,
        SUM(COALESCE(c.custo_direto_usuario_projeto_mes, 0)) AS custo_direto_mes,
        SUM(COALESCE(c.custo_indireto_usuario_projeto_mes, 0)) AS custo_indireto_mes,
        SUM(COALESCE(c.horas_usuario_projeto_mes, 0)) AS horas_mes
      FROM \`${projectId}.${costDataset}.${costTable}\` c
      WHERE c.project_code IS NOT NULL
        AND c.mes IS NOT NULL
  `;

  // Filtro por projeto específico se fornecido
  if (projectCode) {
    const escapedCode = projectCode.replace(/'/g, "''");
    query += ` AND c.project_code = '${escapedCode}'`;
  }

  query += `
      GROUP BY c.project_code, c.projeto, c.mes
    ),
    receitas_mensais AS (
      SELECT 
        CAST(e.codigo_projeto AS STRING) AS project_code,
        DATE_TRUNC(
          COALESCE(
            SAFE_CAST(e.${entradasDateColumn} AS DATE),
            SAFE.PARSE_DATE('%Y-%m-%d', CAST(e.${entradasDateColumn} AS STRING)),
            SAFE.PARSE_DATE('%d/%m/%Y', CAST(e.${entradasDateColumn} AS STRING))
          ),
          MONTH
        ) AS mes,
        SUM(COALESCE(e.Valor, 0)) AS receita_mes
      FROM \`${projectId}.${costDataset}.entradas\` e
      WHERE e.codigo_projeto IS NOT NULL
        AND e.${entradasDateColumn} IS NOT NULL
  `;

  // Filtro por projeto específico se fornecido
  if (projectCode) {
    const escapedCode = projectCode.replace(/'/g, "''");
    query += ` AND CAST(e.codigo_projeto AS STRING) = '${escapedCode}'`;
  }

  query += `
      GROUP BY project_code, mes
    ),
    todos_meses AS (
      SELECT DISTINCT project_code, mes FROM custos_mensais
      UNION DISTINCT
      SELECT DISTINCT project_code, mes FROM receitas_mensais
    ),
    meses_combinados AS (
      SELECT 
        p.project_code_norm,
        p.project_name,
        p.valor_contrato_total,
        p.valor_total_contrato_mais_aditivos,
        p.data_inicio_cronograma,
        p.data_termino_cronograma,
        p.data_termino_contrato,
        p.status,
        p.lider,
        p.nome_time,
        t.mes
      FROM portfolio_data p
      INNER JOIN todos_meses t
        ON CAST(p.project_code_norm AS STRING) = t.project_code
    ),
    dados_combinados AS (
      SELECT 
        m.project_code_norm,
        m.project_name,
        m.valor_contrato_total,
        m.valor_total_contrato_mais_aditivos,
        m.data_inicio_cronograma,
        m.data_termino_cronograma,
        m.data_termino_contrato,
        m.status,
        m.lider,
        m.nome_time,
        m.mes,
        COALESCE(c.custo_total_mes, 0) AS custo_total_mes,
        COALESCE(c.custo_direto_mes, 0) AS custo_direto_mes,
        COALESCE(c.custo_indireto_mes, 0) AS custo_indireto_mes,
        COALESCE(c.horas_mes, 0) AS horas_mes,
        COALESCE(r.receita_mes, 0) AS receita_mes,
        -- Calcula margem (55% do valor do contrato)
        (COALESCE(m.valor_total_contrato_mais_aditivos, m.valor_contrato_total, 0) * 0.55) AS valor_margem_total,
        -- Receita bruta total do contrato (para referência)
        COALESCE(m.valor_total_contrato_mais_aditivos, m.valor_contrato_total, 0) AS receita_bruta_total
      FROM meses_combinados m
      LEFT JOIN custos_mensais c 
        ON CAST(m.project_code_norm AS STRING) = CAST(c.project_code AS STRING)
        AND m.mes = c.mes
      LEFT JOIN receitas_mensais r
        ON CAST(m.project_code_norm AS STRING) = r.project_code
        AND m.mes = r.mes
    )
    SELECT 
      project_code_norm AS project_code,
      project_name,
      mes,
      custo_total_mes,
      custo_direto_mes,
      custo_indireto_mes,
      horas_mes,
      receita_mes,
      valor_margem_total,
      receita_bruta_total,
      status,
      lider,
      nome_time,
      data_inicio_cronograma,
      data_termino_cronograma,
      data_termino_contrato,
      -- Calcula valores acumulados (para a Curva S)
      SUM(custo_total_mes) OVER (
        PARTITION BY project_code_norm 
        ORDER BY mes 
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      ) AS custo_total_acumulado,
      -- Receita bruta acumulada (soma das receitas reais mensais)
      SUM(receita_mes) OVER (
        PARTITION BY project_code_norm 
        ORDER BY mes 
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      ) AS receita_bruta_acumulado,
      -- Margem acumulada (receita acumulada - custo acumulado)
      SUM(receita_mes) OVER (
        PARTITION BY project_code_norm 
        ORDER BY mes 
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      ) - SUM(custo_total_mes) OVER (
        PARTITION BY project_code_norm 
        ORDER BY mes 
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      ) AS valor_margem_acumulado
    FROM dados_combinados
    WHERE mes IS NOT NULL
    ORDER BY project_code_norm, mes ASC
  `;

  console.log('📊 Query Curva S gerada. Executando...');
  return await executeQuery(query);
}

/**
 * Busca detalhamento de custos por colaborador para um projeto específico
 * 
 * @param {string} projectCode - Código do projeto
 * @param {string|null} leaderName - Nome do líder para validação (opcional)
 * @returns {Promise<Array>} - Dados detalhados por colaborador
 */
export async function queryCurvaSColaboradores(projectCode, leaderName = null) {
  const costDataset = 'financeiro';
  const costTable = 'custo_usuario_projeto_mes';
  
  // Valida se o projeto pertence ao líder (se fornecido)
  let validationQuery = '';
  if (leaderName) {
    const hasLider = await hasPortfolioColumn('lider');
    if (!hasLider) {
      console.warn('⚠️ Coluna "lider" não encontrada na tabela do portfólio. Retornando vazio por segurança.');
      return [];
    }
    const escapedName = leaderName.replace(/'/g, "''");
    validationQuery = `
      AND EXISTS (
        SELECT 1 
        FROM \`${projectId}.${datasetId}.${tablePortfolio}\` p
        WHERE p.project_code_norm = '${projectCode.replace(/'/g, "''")}'
          AND LOWER(p.lider) = LOWER('${escapedName}')
      )
    `;
  }

  const query = `
    SELECT 
      usuario,
      projeto,
      project_code,
      mes,
      SUM(COALESCE(custo_direto_usuario_projeto_mes, 0)) AS custo_direto_total,
      SUM(COALESCE(custo_indireto_usuario_projeto_mes, 0)) AS custo_indireto_total,
      SUM(COALESCE(custo_total_usuario_projeto_mes, 0)) AS custo_total,
      SUM(COALESCE(horas_usuario_projeto_mes, 0)) AS horas_total
    FROM \`${projectId}.${costDataset}.${costTable}\`
    WHERE project_code = '${projectCode.replace(/'/g, "''")}'
      ${validationQuery}
    GROUP BY usuario, projeto, project_code, mes
    ORDER BY usuario, mes ASC
  `;

  return await executeQuery(query);
}

/**
 * Busca apontamentos (issues) de um projeto específico
 * 
 * @param {string} construflowId - ID do projeto no Construflow (corresponde ao construflow_id do portfólio)
 * @returns {Promise<Array>} - Dados dos apontamentos
 */
export async function queryIssues(construflowId) {
  if (!construflowId) {
    throw new Error('construflowId é obrigatório');
  }

  // Valida se projectId está configurado
  if (!projectId || projectId === 'seu-project-id') {
    const errorMsg = `BIGQUERY_PROJECT_ID não está configurado. Valor atual: "${projectId}"`;
    console.error(`❌ ${errorMsg}`);
    throw new Error(errorMsg);
  }
  
  // Valida se o BigQuery client está inicializado
  if (!bigquery) {
    const errorMsg = 'Cliente BigQuery não foi inicializado corretamente';
    console.error(`❌ ${errorMsg}`);
    throw new Error(errorMsg);
  }

  const issuesDataset = 'construflow_data';
  const issuesTable = 'issues';
  
  // Escapa o construflowId para evitar SQL injection
  const escapedProjectId = String(construflowId).replace(/'/g, "''");
  
  console.log(`🔍 [queryIssues] Iniciando busca de apontamentos`);
  console.log(`   Projeto BigQuery: ${projectId}`);
  console.log(`   Dataset: ${issuesDataset}`);
  console.log(`   Tabela: ${issuesTable}`);
  console.log(`   Construflow ID: ${construflowId} (escaped: ${escapedProjectId})`);
  console.log(`   Query completa será: ${projectId}.${issuesDataset}.${issuesTable}`);
  
  // Query básica primeiro, depois enriquecemos com queries separadas
  const baseQuery = `
    SELECT 
      i.id,
      i.guid,
      i.code,
      i.title,
      i.description,
      i.status,
      i.priority,
      i.category,
      i.createdAt,
      i.updatedAt,
      i.deadline,
      i.createdByUserId,
      i.statusUpdatedByUserId,
      i.statusUpdatedAt,
      i.creationPhase,
      i.resolutionPhase,
      i.projectId,
      i.visibility,
      i.editedAt,
      i.visibilityUpdatedAt
    FROM \`${projectId}.${issuesDataset}.${issuesTable}\` i
    WHERE CAST(i.projectId AS STRING) = '${escapedProjectId}'
    ORDER BY i.createdAt DESC
    LIMIT 1000
  `;

  try {
    // Primeiro busca os issues básicos
    let results;
    try {
      console.log(`📝 Executando query básica...`);
      results = await executeQuery(baseQuery);
      console.log(`✅ Query básica executada com sucesso!`);
      console.log(`✅ Encontrados ${results.length} apontamentos para o projeto ${construflowId}`);
    } catch (baseQueryError) {
      console.error(`❌ Erro na query básica de apontamentos:`);
      console.error(`   Mensagem: ${baseQueryError.message}`);
      console.error(`   Código: ${baseQueryError.code || 'N/A'}`);
      console.error(`   Stack: ${baseQueryError.stack}`);
      
      // Tenta uma query ainda mais simples sem LIMIT
      console.log(`🔄 Tentando query alternativa mais simples...`);
      try {
        const simpleQuery = `
          SELECT *
          FROM \`${projectId}.${issuesDataset}.${issuesTable}\`
          WHERE CAST(projectId AS STRING) = '${escapedProjectId}'
          ORDER BY createdAt DESC
          LIMIT 100
        `;
        results = await executeQuery(simpleQuery);
        console.log(`✅ Query simples retornou ${results.length} apontamentos`);
      } catch (simpleError) {
        console.error(`❌ Erro também na query simples:`);
        console.error(`   Mensagem: ${simpleError.message}`);
        console.error(`   Código: ${simpleError.code || 'N/A'}`);
        console.error(`   Stack: ${simpleError.stack}`);
        throw new Error(`Erro ao buscar apontamentos: ${simpleError.message}`);
      }
    }
    
    if (!results || results.length === 0) {
      return [];
    }

    // Tenta enriquecer os dados, mas não falha se houver erro
    const phaseMap = {};
    const categoryMap = {};
    const localMap = {};
    const disciplineMap = {};
    const commentDateMap = {};

    try {
      // Busca fases e categorias em lote
      // Coleta os valores brutos primeiro (podem ser string ou número)
      const phaseIdsRaw = [...new Set([
        ...results.map(r => r.creationPhase).filter(v => v != null),
        ...results.map(r => r.resolutionPhase).filter(v => v != null)
      ])];
      const categoryIdsRaw = [...new Set(results.map(r => r.category).filter(v => v != null))];
      
      // Converte para número se possível, mantém como string se não for numérico
      const phaseIds = phaseIdsRaw.map(val => {
        const num = Number(val);
        return !isNaN(num) && isFinite(num) ? num : String(val);
      });
      const categoryIds = categoryIdsRaw.map(val => {
        const num = Number(val);
        return !isNaN(num) && isFinite(num) ? num : String(val);
      });
      
      console.log(`🔍 [DEBUG] Coletados ${phaseIds.length} IDs únicos de fases:`, phaseIds.slice(0, 10));
      console.log(`🔍 [DEBUG] Coletados ${categoryIds.length} IDs únicos de categorias:`, categoryIds.slice(0, 10));
      console.log(`🔍 [DEBUG] Tipos dos IDs de fases:`, phaseIds.slice(0, 5).map(id => ({ value: id, type: typeof id })));
      console.log(`🔍 [DEBUG] Tipos dos IDs de categorias:`, categoryIds.slice(0, 5).map(id => ({ value: id, type: typeof id })));
      
      // Mapeamento de fases
      // Conecta phases.id com issues.creationPhase (e issues.resolutionPhase)
      if (phaseIds.length > 0) {
        console.log(`✅ [DEBUG] phaseIds.length > 0, iniciando busca de fases...`);
        try {
          // Filtra apenas IDs numéricos (phases.id é INTEGER)
          console.log(`🔍 [DEBUG] Convertendo ${phaseIds.length} IDs de fases para números...`);
          const phaseIdNumbers = phaseIds
            .map((id, index) => {
              const numId = typeof id === 'number' ? id : Number(id);
              const isValid = !isNaN(numId) && isFinite(numId);
              if (index < 5) {
                console.log(`   [DEBUG] ID ${index}: valor="${id}", tipo=${typeof id}, numId=${numId}, válido=${isValid}`);
              }
              return isValid ? numId : null;
            })
            .filter(id => id !== null);
          
          console.log(`🔍 [DEBUG] IDs de fases coletados (raw):`, phaseIdsRaw.slice(0, 10));
          console.log(`🔍 [DEBUG] IDs de fases após processamento:`, phaseIds.slice(0, 10));
          console.log(`🔍 [DEBUG] IDs numéricos de fases para query (${phaseIdNumbers.length} válidos):`, phaseIdNumbers.slice(0, 10));
          
          if (phaseIdNumbers.length === 0) {
            console.warn(`⚠️ Nenhum ID de fase válido (numérico) encontrado para buscar`);
            console.warn(`   IDs originais coletados:`, phaseIdsRaw);
            console.warn(`   IDs após processamento:`, phaseIds);
          } else {
            const escapedPhaseIds = phaseIdNumbers.join(', ');
            
            const phaseQuery = `
              SELECT 
                id,
                CAST(id AS STRING) AS id_str,
                name
              FROM \`${projectId}.${issuesDataset}.phases\`
              WHERE id IN (${escapedPhaseIds})
              ORDER BY id
            `;
            console.log(`🔍 Buscando nomes de ${phaseIdNumbers.length} fases da tabela phases...`);
            console.log(`   📊 COMPARAÇÃO:`);
            console.log(`      - issues.creationPhase/resolutionPhase (STRING): ${phaseIdsRaw.slice(0, 5).join(', ')}`);
            console.log(`      - Convertido para NUMBER: ${phaseIdNumbers.slice(0, 5).join(', ')}`);
            console.log(`      - Comparando com phases.id (INTEGER): ${phaseIdNumbers.slice(0, 5).join(', ')}`);
            console.log(`   📍 Query completa: ${phaseQuery}`);
            console.log(`   📍 Project ID: ${projectId}, Dataset: ${issuesDataset}`);
            const phases = await executeQuery(phaseQuery);
            console.log(`   📊 Resultado da query: ${phases ? phases.length : 0} fases encontradas`);
            if (phases && Array.isArray(phases)) {
              console.log(`✅ Encontradas ${phases.length} fases no banco`);
              if (phases.length === 0) {
                console.warn(`⚠️ Query retornou 0 resultados para IDs: ${phaseIdNumbers.join(', ')}`);
              }
              phases.forEach(p => {
                if (p && (p.id !== null && p.id !== undefined)) {
                  // Usa o ID original (número) e também a string para garantir compatibilidade
                  const idNum = Number(p.id);
                  const idStr = String(p.id);
                  // Prioriza 'name' da tabela phases, depois o ID como fallback
                  const phaseName = (p.name && String(p.name).trim() !== '') ? p.name : idStr;
                  // Mapeia tanto com string quanto número
                  phaseMap[idStr] = phaseName;
                  if (!isNaN(idNum) && isFinite(idNum)) {
                    phaseMap[idNum] = phaseName;
                  }
                  console.log(`   ✅ Fase ID ${idStr} (num: ${idNum}) → Nome: "${phaseName}"`);
                } else {
                  console.warn(`   ⚠️ Fase inválida retornada:`, p);
                }
              });
              console.log(`📊 Total de fases mapeadas: ${Object.keys(phaseMap).length}`);
            } else {
              console.warn(`⚠️ Nenhuma fase encontrada no banco para os IDs: ${phaseIdNumbers.join(', ')}`);
              console.warn(`   Query executada: ${phaseQuery.substring(0, 300)}`);
            }
          }
        } catch (phaseError) {
          console.warn('⚠️ Erro ao buscar fases (continuando sem fases):', phaseError.message);
          console.warn('   Stack:', phaseError.stack);
        }
      }

      // Mapeamento de categorias
      // Conecta categories.id com issues.category
      if (categoryIds.length > 0) {
        console.log(`✅ [DEBUG] categoryIds.length > 0, iniciando busca de categorias...`);
        try {
          // Filtra apenas IDs numéricos (categories.id é INTEGER)
          console.log(`🔍 [DEBUG] Convertendo ${categoryIds.length} IDs de categorias para números...`);
          const categoryIdNumbers = categoryIds
            .map((id, index) => {
              const numId = typeof id === 'number' ? id : Number(id);
              const isValid = !isNaN(numId) && isFinite(numId);
              if (index < 5) {
                console.log(`   [DEBUG] ID ${index}: valor="${id}", tipo=${typeof id}, numId=${numId}, válido=${isValid}`);
              }
              return isValid ? numId : null;
            })
            .filter(id => id !== null);
          
          console.log(`🔍 [DEBUG] IDs de categorias coletados (raw):`, categoryIdsRaw.slice(0, 10));
          console.log(`🔍 [DEBUG] IDs de categorias após processamento:`, categoryIds.slice(0, 10));
          console.log(`🔍 [DEBUG] IDs numéricos de categorias para query (${categoryIdNumbers.length} válidos):`, categoryIdNumbers.slice(0, 10));
          
          if (categoryIdNumbers.length === 0) {
            console.warn(`⚠️ Nenhum ID de categoria válido (numérico) encontrado para buscar`);
            console.warn(`   IDs originais coletados:`, categoryIdsRaw);
            console.warn(`   IDs após processamento:`, categoryIds);
          } else {
            const escapedCategoryIds = categoryIdNumbers.join(', ');
            
            const categoryQuery = `
              SELECT 
                id,
                CAST(id AS STRING) AS id_str,
                name
              FROM \`${projectId}.${issuesDataset}.categories\`
              WHERE id IN (${escapedCategoryIds})
              ORDER BY id
            `;
            console.log(`🔍 Buscando nomes de ${categoryIdNumbers.length} categorias da tabela categories...`);
            console.log(`   📊 COMPARAÇÃO:`);
            console.log(`      - issues.category (STRING): ${categoryIdsRaw.slice(0, 5).join(', ')}`);
            console.log(`      - Convertido para NUMBER: ${categoryIdNumbers.slice(0, 5).join(', ')}`);
            console.log(`      - Comparando com categories.id (INTEGER): ${categoryIdNumbers.slice(0, 5).join(', ')}`);
            console.log(`   📍 Query completa: ${categoryQuery}`);
            console.log(`   📍 Project ID: ${projectId}, Dataset: ${issuesDataset}`);
            const categories = await executeQuery(categoryQuery);
            console.log(`   📊 Resultado da query: ${categories ? categories.length : 0} categorias encontradas`);
            if (categories && Array.isArray(categories)) {
              console.log(`✅ Encontradas ${categories.length} categorias no banco`);
              if (categories.length === 0) {
                console.warn(`⚠️ Query retornou 0 resultados para IDs: ${categoryIdNumbers.join(', ')}`);
              }
              categories.forEach(c => {
                if (c && (c.id !== null && c.id !== undefined)) {
                  // Usa o ID original (número) e também a string para garantir compatibilidade
                  const idNum = Number(c.id);
                  const idStr = String(c.id);
                    // Prioriza 'name' da tabela categories, depois o ID como fallback
                    const categoryName = (c.name && String(c.name).trim() !== '') ? c.name : idStr;
                  // Mapeia tanto com string quanto número
                  categoryMap[idStr] = categoryName;
                  if (!isNaN(idNum) && isFinite(idNum)) {
                    categoryMap[idNum] = categoryName;
                  }
                  console.log(`   ✅ Categoria ID ${idStr} (num: ${idNum}) → Nome: "${categoryName}"`);
                } else {
                  console.warn(`   ⚠️ Categoria inválida retornada:`, c);
                }
              });
              console.log(`📊 Total de categorias mapeadas: ${Object.keys(categoryMap).length}`);
            } else {
              console.warn(`⚠️ Nenhuma categoria encontrada no banco para os IDs: ${categoryIdNumbers.join(', ')}`);
              console.warn(`   Query executada: ${categoryQuery.substring(0, 300)}`);
            }
          }
        } catch (categoryError) {
          console.warn('⚠️ Erro ao buscar categorias (continuando sem categorias):', categoryError.message);
          console.warn('   Stack:', categoryError.stack);
        }
      }

      // Busca todos os issueIds para buscar locais e disciplinas
      // Fluxo: issues.id -> issues_locals.issueId -> issues_locals.localId -> locals.id
      const issueIds = results.map(r => r.id).filter(Boolean);
      const issueGuids = results.map(r => r.guid).filter(Boolean);
      
      // Cria um mapa de id -> guid para fazer a correspondência
      const idToGuidMap = {};
      results.forEach(r => {
        if (r.id && r.guid) {
          idToGuidMap[String(r.id)] = r.guid;
        }
      });
      
      // Busca locais em lote (apenas se houver issues e não muitos)
      // issues_locals.issueId corresponde a issues.id (não guid)
      console.log(`📍 [DEBUG] Total de issueIds: ${issueIds.length}, buscando locais...`);
      if (issueIds.length > 0 && issueIds.length <= 500) { // Limita a 500 para evitar query muito grande
        try {
          const escapedIds = issueIds.map(id => `'${String(id).replace(/'/g, "''")}'`).join(', ');
          const localsQuery = `
            SELECT DISTINCT il.issueId, loc.name, loc.abbreviation
            FROM \`${projectId}.${issuesDataset}.issues_locals\` il
            LEFT JOIN \`${projectId}.${issuesDataset}.locals\` loc ON loc.id = il.localId
            WHERE il.issueId IN (${escapedIds})
              AND loc.name IS NOT NULL
            ORDER BY il.issueId, loc.name
          `;
          const locals = await executeQuery(localsQuery);
          
          if (locals && Array.isArray(locals)) {
            console.log(`✅ [DEBUG] Encontrados ${locals.length} registros de locais`);
            locals.forEach(l => {
              if (l && l.issueId && l.name) {
                // issues_locals.issueId corresponde a issues.id (não guid)
                // Precisamos mapear o id para o guid usando o idToGuidMap
                const guid = idToGuidMap[String(l.issueId)];
                
                if (guid) {
                  if (!localMap[guid]) {
                    localMap[guid] = [];
                  }
                  // Armazena objeto com name e abbreviation
                  localMap[guid].push({
                    name: l.name,
                    abbreviation: l.abbreviation || l.name
                  });
                  console.log(`✅ [DEBUG] Adicionado local "${l.name}" (${l.abbreviation || l.name}) para issue id ${l.issueId} -> guid ${guid}`);
                } else {
                  console.warn(`⚠️ [DEBUG] Não foi possível encontrar guid para issueId ${l.issueId}`);
                }
              }
            });
            console.log(`✅ [DEBUG] Total de issues com locais mapeados: ${Object.keys(localMap).length}`);
            console.log(`📍 [DEBUG] Amostra de locais encontrados:`, 
              Object.entries(localMap).slice(0, 3).map(([guid, locals]) => ({
                guid,
                locals: locals.map(l => l.name)
              }))
            );
          } else {
            console.warn(`⚠️ [DEBUG] Nenhum local retornado da query!`);
          }
        } catch (localError) {
          console.warn('⚠️ Erro ao buscar locais (continuando sem locais):', localError.message);
          console.warn('   Stack:', localError.stack);
        }
      } else if (issueIds.length > 500) {
        // Processa em lotes de 500 para projetos grandes
        console.log(`📍 Processando ${issueIds.length} issues em lotes de 500 para buscar locais...`);
        const batchSize = 500;
        for (let i = 0; i < issueIds.length; i += batchSize) {
          const batch = issueIds.slice(i, i + batchSize);
          try {
            const escapedIds = batch.map(id => `'${String(id).replace(/'/g, "''")}'`).join(', ');
            const localsQuery = `
              SELECT DISTINCT il.issueId, loc.name, loc.abbreviation
              FROM \`${projectId}.${issuesDataset}.issues_locals\` il
              LEFT JOIN \`${projectId}.${issuesDataset}.locals\` loc ON loc.id = il.localId
              WHERE il.issueId IN (${escapedIds})
                AND loc.name IS NOT NULL
              ORDER BY il.issueId, loc.name
            `;
            const locals = await executeQuery(localsQuery);
            
            if (locals && Array.isArray(locals)) {
              locals.forEach(l => {
                if (l && l.issueId && l.name) {
                  const guid = idToGuidMap[String(l.issueId)];
                  if (guid) {
                    if (!localMap[guid]) {
                      localMap[guid] = [];
                    }
                    localMap[guid].push({
                      name: l.name,
                      abbreviation: l.abbreviation || l.name
                    });
                  }
                }
              });
              console.log(`✅ [DEBUG] Lote ${Math.floor(i / batchSize) + 1}: ${locals.length} locais encontrados`);
            }
          } catch (batchError) {
            console.warn(`⚠️ Erro ao processar lote de locais ${Math.floor(i / batchSize) + 1}:`, batchError.message);
          }
        }
        console.log(`✅ [DEBUG] Total de issues com locais mapeados: ${Object.keys(localMap).length}`);
      } else if (issueIds.length === 0) {
        console.warn(`⚠️ [DEBUG] Nenhum issueId encontrado para buscar locais!`);
      }

      // Busca disciplinas em lote (apenas se houver issues e não muitos)
      // Usa issue.id (não guid) para conectar com issues_disciplines.issueId
      console.log(`📚 [DEBUG] Total de results: ${results.length}, buscando disciplinas...`);
      if (results.length > 0 && results.length <= 500) {
        try {
          // Coleta os IDs dos issues (não os GUIDs)
          const issueIds = results
            .map(issue => issue.id)
            .filter(id => id != null && id !== undefined && id !== '');
          
          if (issueIds.length === 0) {
            console.warn('⚠️ Nenhum issue.id encontrado para buscar disciplinas');
          } else {
            // Escapa os IDs para o IN clause (mantém como string para compatibilidade)
            const escapedIds = issueIds.map(id => `'${String(id).replace(/'/g, "''")}'`).join(', ');
            
            const disciplinesQuery = `
              SELECT 
                CAST(id_dis.issueId AS STRING) AS issueId,
                d.name AS disciplineName,
                id_dis.status AS disciplineStatus
              FROM \`${projectId}.${issuesDataset}.issues_disciplines\` id_dis
              LEFT JOIN \`${projectId}.${issuesDataset}.disciplines\` d ON CAST(d.id AS STRING) = CAST(id_dis.disciplineId AS STRING)
              WHERE CAST(id_dis.issueId AS STRING) IN (${escapedIds})
                AND d.name IS NOT NULL
              ORDER BY id_dis.issueId, d.name
            `;
            console.log(`📚 Buscando disciplinas para ${issueIds.length} issues...`);
            const disciplines = await executeQuery(disciplinesQuery);
            if (disciplines && Array.isArray(disciplines)) {
              disciplines.forEach(d => {
                if (d && d.issueId && d.disciplineName) {
                  const issueIdStr = String(d.issueId);
                  if (!disciplineMap[issueIdStr]) {
                    disciplineMap[issueIdStr] = [];
                  }
                  // Armazena objeto com nome e status da disciplina
                  disciplineMap[issueIdStr].push({
                    name: d.disciplineName,
                    status: d.disciplineStatus || null
                  });
                }
              });
              console.log(`✅ Encontradas disciplinas para ${Object.keys(disciplineMap).length} issues`);
            console.log(`📚 [DEBUG] Amostra de disciplinas encontradas:`, 
              Object.entries(disciplineMap).slice(0, 3).map(([issueId, disciplines]) => ({
                issueId,
                disciplines: disciplines.map(d => d.name)
              }))
            );
            } else {
              console.warn(`⚠️ [DEBUG] Nenhuma disciplina retornada da query!`);
            }
          }
        } catch (disciplineError) {
          console.warn('⚠️ Erro ao buscar disciplinas (continuando sem disciplinas):', disciplineError.message);
          console.warn('   Stack:', disciplineError.stack);
        }
      } else if (results.length > 500) {
        // Processa em lotes de 500 para projetos grandes
        console.log(`📚 Processando ${results.length} issues em lotes de 500 para buscar disciplinas...`);
        const batchSize = 500;
        const allIssueIds = results
          .map(issue => issue.id)
          .filter(id => id != null && id !== undefined && id !== '');
        
        for (let i = 0; i < allIssueIds.length; i += batchSize) {
          const batch = allIssueIds.slice(i, i + batchSize);
          try {
            const escapedIds = batch.map(id => `'${String(id).replace(/'/g, "''")}'`).join(', ');
            const disciplinesQuery = `
              SELECT 
                CAST(id_dis.issueId AS STRING) AS issueId,
                d.name AS disciplineName,
                id_dis.status AS disciplineStatus
              FROM \`${projectId}.${issuesDataset}.issues_disciplines\` id_dis
              LEFT JOIN \`${projectId}.${issuesDataset}.disciplines\` d ON CAST(d.id AS STRING) = CAST(id_dis.disciplineId AS STRING)
              WHERE CAST(id_dis.issueId AS STRING) IN (${escapedIds})
                AND d.name IS NOT NULL
              ORDER BY id_dis.issueId, d.name
            `;
            const disciplines = await executeQuery(disciplinesQuery);
            
            if (disciplines && Array.isArray(disciplines)) {
              disciplines.forEach(d => {
                if (d && d.issueId && d.disciplineName) {
                  const issueIdStr = String(d.issueId);
                  if (!disciplineMap[issueIdStr]) {
                    disciplineMap[issueIdStr] = [];
                  }
                  disciplineMap[issueIdStr].push({
                    name: d.disciplineName,
                    status: d.disciplineStatus || null
                  });
                }
              });
              console.log(`✅ [DEBUG] Lote ${Math.floor(i / batchSize) + 1}: ${disciplines.length} disciplinas encontradas`);
            }
          } catch (batchError) {
            console.warn(`⚠️ Erro ao processar lote de disciplinas ${Math.floor(i / batchSize) + 1}:`, batchError.message);
          }
        }
        console.log(`✅ Encontradas disciplinas para ${Object.keys(disciplineMap).length} issues`);
      }

      // Busca última data de comentários para cada issue
      if (results.length > 0 && results.length <= 500) {
        try {
          const issueIds = results
            .map(issue => issue.id)
            .filter(id => id != null && id !== undefined && id !== '');
          
          if (issueIds.length > 0) {
            const escapedIds = issueIds.map(id => `'${String(id).replace(/'/g, "''")}'`).join(', ');
            
            const commentsQuery = `
              SELECT 
                CAST(issue_id AS STRING) AS issueId,
                MAX(date) AS lastCommentDate
              FROM \`${projectId}.${issuesDataset}.comments\`
              WHERE CAST(project_id AS STRING) = '${escapedProjectId}'
                AND CAST(issue_id AS STRING) IN (${escapedIds})
              GROUP BY issue_id
            `;
            
            console.log(`💬 Buscando última data de comentários para ${issueIds.length} issues...`);
            const comments = await executeQuery(commentsQuery);
            
            if (comments && Array.isArray(comments)) {
              comments.forEach(c => {
                if (c && c.issueId && c.lastCommentDate) {
                  const issueIdStr = String(c.issueId);
                  if (!commentDateMap[issueIdStr] || new Date(c.lastCommentDate) > new Date(commentDateMap[issueIdStr])) {
                    commentDateMap[issueIdStr] = c.lastCommentDate;
                  }
                }
              });
              console.log(`✅ Encontradas datas de comentários para ${Object.keys(commentDateMap).length} issues`);
            }
          }
        } catch (commentError) {
          console.warn('⚠️ Erro ao buscar comentários (continuando sem comentários):', commentError.message);
          console.warn('   Stack:', commentError.stack);
        }
      } else if (results.length > 500) {
        // Processa em lotes de 500 para projetos grandes
        console.log(`💬 Processando ${results.length} issues em lotes de 500 para buscar comentários...`);
        const batchSize = 500;
        const allIssueIds = results
          .map(issue => issue.id)
          .filter(id => id != null && id !== undefined && id !== '');
        
        for (let i = 0; i < allIssueIds.length; i += batchSize) {
          const batch = allIssueIds.slice(i, i + batchSize);
          try {
            const escapedIds = batch.map(id => `'${String(id).replace(/'/g, "''")}'`).join(', ');
            const commentsQuery = `
              SELECT 
                CAST(issue_id AS STRING) AS issueId,
                MAX(date) AS lastCommentDate
              FROM \`${projectId}.${issuesDataset}.comments\`
              WHERE CAST(project_id AS STRING) = '${escapedProjectId}'
                AND CAST(issue_id AS STRING) IN (${escapedIds})
              GROUP BY issue_id
            `;
            const comments = await executeQuery(commentsQuery);
            
            if (comments && Array.isArray(comments)) {
              comments.forEach(c => {
                if (c && c.issueId && c.lastCommentDate) {
                  const issueIdStr = String(c.issueId);
                  if (!commentDateMap[issueIdStr] || new Date(c.lastCommentDate) > new Date(commentDateMap[issueIdStr])) {
                    commentDateMap[issueIdStr] = c.lastCommentDate;
                  }
                }
              });
              console.log(`✅ [DEBUG] Lote ${Math.floor(i / batchSize) + 1}: ${comments.length} comentários encontrados`);
            }
          } catch (batchError) {
            console.warn(`⚠️ Erro ao processar lote de comentários ${Math.floor(i / batchSize) + 1}:`, batchError.message);
          }
        }
        console.log(`✅ Encontradas datas de comentários para ${Object.keys(commentDateMap).length} issues`);
      }
    } catch (enrichError) {
      console.warn('⚠️ Erro geral ao enriquecer dados (retornando dados básicos):', enrichError.message);
    }

    // Enriquece os resultados (mesmo que alguns mapas estejam vazios)
    const enrichedResults = results.map(issue => {
      // Tenta buscar por string e número para garantir compatibilidade
      const creationPhaseId = issue.creationPhase;
      const creationPhaseName = creationPhaseId ? (
        phaseMap[String(creationPhaseId)] || 
        phaseMap[Number(creationPhaseId)] || 
        null
      ) : null;
      
      const resolutionPhaseId = issue.resolutionPhase;
      const resolutionPhaseName = resolutionPhaseId ? (
        phaseMap[String(resolutionPhaseId)] || 
        phaseMap[Number(resolutionPhaseId)] || 
        null
      ) : null;
      
      const categoryId = issue.category;
      const categoryName = categoryId ? (
        categoryMap[String(categoryId)] || 
        categoryMap[Number(categoryId)] || 
        null
      ) : null;
      
      const disciplines = disciplineMap[String(issue.id)] || [];
      const locals = localMap[issue.guid] || [];
      
      // Log de debug para verificar se os nomes estão sendo mapeados
      if (issue.creationPhase || issue.resolutionPhase || issue.category || disciplines.length > 0 || locals.length > 0) {
        console.log(`[DEBUG] Issue ${issue.guid} (id: ${issue.id}):`, {
          creationPhase: issue.creationPhase,
          creationPhaseName: creationPhaseName,
          resolutionPhase: issue.resolutionPhase,
          resolutionPhaseName: resolutionPhaseName,
          category: issue.category,
          categoryName: categoryName,
          disciplinesCount: disciplines.length,
          disciplines: disciplines.map(d => d.name),
          localsCount: locals.length,
          locals: locals.map(l => l.name)
        });
      }
      
      // Busca última data de comentário para este issue
      const lastCommentDate = commentDateMap[String(issue.id)] || null;
      
      return {
        ...issue,
        creationPhaseName,
        resolutionPhaseName,
        categoryName,
        locals: localMap[issue.guid] || [], // Agora é array de objetos { name, abbreviation }
        localNames: (localMap[issue.guid] || []).map(l => l.name || l), // Mantém compatibilidade com código antigo
        // Disciplinas agora são objetos com { name, status } ao invés de apenas nomes
        // Usa issue.id (não guid) para buscar no mapa
        disciplines,
        lastCommentDate,
      };
    });

    console.log(`✅ Total de issues enriquecidos: ${enrichedResults.length}`);
    console.log(`   Fases mapeadas: ${Object.keys(phaseMap).length}`);
    console.log(`   Categorias mapeadas: ${Object.keys(categoryMap).length}`);
    console.log(`   Issues com disciplinas: ${enrichedResults.filter(i => (i.disciplines || []).length > 0).length}`);

    return enrichedResults;
  } catch (error) {
    console.error(`❌ Erro geral na query de apontamentos para projeto ${construflowId}:`);
    console.error(`   Mensagem: ${error.message}`);
    console.error(`   Tipo: ${error.constructor.name}`);
    console.error(`   Código: ${error.code || 'N/A'}`);
    console.error(`   Stack: ${error.stack}`);
    if (error.errors) {
      console.error(`   Erros detalhados:`, JSON.stringify(error.errors, null, 2));
    }
    throw new Error(`Erro ao buscar apontamentos: ${error.message}`);
  }
}

/**
 * Busca dados de cronograma (smartsheet_data_projetos) para um projeto específico
 * 
 * @param {string} smartsheetId - ID do projeto no SmartSheet (corresponde ao smartsheet_id do portfólio)
 * @returns {Promise<Array>} - Dados do cronograma
 */
export async function queryCronograma(smartsheetId) {
  if (!smartsheetId) {
    throw new Error('smartsheetId é obrigatório');
  }

  // Valida se projectId está configurado
  if (!projectId || projectId === 'seu-project-id') {
    const errorMsg = `BIGQUERY_PROJECT_ID não está configurado. Valor atual: "${projectId}"`;
    console.error(`❌ ${errorMsg}`);
    throw new Error(errorMsg);
  }
  
  // Valida se o BigQuery client está inicializado
  if (!bigquery) {
    const errorMsg = 'Cliente BigQuery não foi inicializado corretamente';
    console.error(`❌ ${errorMsg}`);
    throw new Error(errorMsg);
  }

  // Dataset e tabela do SmartSheet
  // O caminho completo é: dadosindicadores.smartsheet.smartsheet_data_projetos
  // No BigQuery, isso significa: projectId = dadosindicadores, dataset = smartsheet, table = smartsheet_data_projetos
  const smartsheetProjectId = 'dadosindicadores';
  const smartsheetDataset = 'smartsheet';
  const smartsheetTable = 'smartsheet_data_projetos';
  
  // Escapa o smartsheetId para evitar SQL injection
  const escapedId = String(smartsheetId).replace(/'/g, "''");
  
  console.log(`📅 [queryCronograma] Iniciando busca de cronograma`);
  console.log(`   Projeto BigQuery: ${smartsheetProjectId}`);
  console.log(`   Dataset: ${smartsheetDataset}`);
  console.log(`   Tabela: ${smartsheetTable}`);
  console.log(`   SmartSheet ID: ${smartsheetId} (escaped: ${escapedId})`);
  
  const query = `
    SELECT 
      ID_Projeto,
      NomeDaPlanilha,
      NomeDaTarefa,
      DataDeInicio,
      DataDeTermino,
      CaminhoCriticoMarco,
      Disciplina,
      Level,
      Status,
      KPI,
      Categoria_de_atraso,
      Motivo_de_atraso,
      DataAtualizacao,
      rowId,
      rowNumber,
      Duracao,
      DataDeInicioBaselineOtus,
      DataDeFimBaselineOtus,
      VarianciaBaselineOtus,
      ObservacaoOtus,
      LiberaPagamento,
      MedicaoPagamento
    FROM \`${smartsheetProjectId}.${smartsheetDataset}.${smartsheetTable}\`
    WHERE ID_Projeto = '${escapedId}'
    ORDER BY DataDeTermino ASC, NomeDaTarefa ASC
  `;

  try {
    console.log('📅 Executando query de cronograma...');
    const rows = await executeQuery(query);
    console.log(`✅ Query de cronograma retornou ${rows.length} linhas`);
    return rows;
  } catch (error) {
    console.error('❌ Erro ao buscar cronograma:');
    console.error(`   Mensagem: ${error.message}`);
    console.error(`   Tipo: ${error.constructor.name}`);
    console.error(`   Código: ${error.code || 'N/A'}`);
    console.error(`   Stack: ${error.stack}`);
    if (error.errors) {
      console.error(`   Erros detalhados:`, JSON.stringify(error.errors, null, 2));
    }
    throw new Error(`Erro ao buscar cronograma: ${error.message}`);
  }
}

/**
 * Busca próximas tarefas de TODOS os projetos do portfólio
 * Usado pela área de Apoio de Projetos para visualizar cronograma consolidado
 *
 * @param {string|null} leaderName - Nome do líder para filtrar (null = todos os projetos)
 * @param {Object} options - Opções de filtro
 * @param {number} options.weeksAhead - Quantas semanas à frente buscar (padrão: 2)
 * @returns {Promise<Array>} - Lista de tarefas com dados do projeto
 */
export async function queryProximasTarefasAll(leaderName = null, options = {}) {
  const { weeksAhead = 2 } = options;

  // Valida se projectId está configurado
  if (!projectId || projectId === 'seu-project-id') {
    const errorMsg = `BIGQUERY_PROJECT_ID não está configurado. Valor atual: "${projectId}"`;
    console.error(`❌ ${errorMsg}`);
    throw new Error(errorMsg);
  }

  // Valida se o BigQuery client está inicializado
  if (!bigquery) {
    const errorMsg = 'Cliente BigQuery não foi inicializado corretamente';
    console.error(`❌ ${errorMsg}`);
    throw new Error(errorMsg);
  }

  // Dataset e tabela do SmartSheet
  const smartsheetProjectId = 'dadosindicadores';
  const smartsheetDataset = 'smartsheet';
  const smartsheetTable = 'smartsheet_data_projetos';

  console.log(`📅 [queryProximasTarefasAll] Buscando próximas tarefas de todos os projetos`);
  console.log(`   Semanas à frente: ${weeksAhead}`);
  console.log(`   Filtro de líder: ${leaderName || 'Nenhum (todos)'}`);

  let query = `
    SELECT
      s.ID_Projeto,
      s.NomeDaPlanilha AS projeto_nome,
      s.NomeDaTarefa,
      s.DataDeInicio,
      s.DataDeTermino,
      s.Disciplina,
      s.Status,
      s.KPI,
      s.Level,
      s.rowId,
      s.CaminhoCriticoMarco,
      p.lider,
      p.nome_time
    FROM \`${smartsheetProjectId}.${smartsheetDataset}.${smartsheetTable}\` s
    INNER JOIN \`${projectId}.${datasetId}.${tablePortfolio}\` p
      ON CAST(s.ID_Projeto AS STRING) = CAST(p.smartsheet_id AS STRING)
    WHERE
      s.DataDeInicio IS NOT NULL
      AND s.DataDeInicio >= CURRENT_DATE()
      AND s.DataDeInicio <= DATE_ADD(CURRENT_DATE(), INTERVAL ${weeksAhead} WEEK)
  `;

  if (leaderName) {
    const escapedName = String(leaderName).replace(/'/g, "''");
    query += ` AND LOWER(p.lider) = LOWER('${escapedName}')`;
  }

  query += ` ORDER BY s.DataDeInicio ASC, s.NomeDaPlanilha, s.Disciplina`;

  try {
    console.log('📅 Executando query de próximas tarefas...');
    const rows = await executeQuery(query);
    console.log(`✅ Query retornou ${rows.length} tarefas`);
    return rows;
  } catch (error) {
    console.error('❌ Erro ao buscar próximas tarefas:');
    console.error(`   Mensagem: ${error.message}`);
    console.error(`   Stack: ${error.stack}`);
    throw new Error(`Erro ao buscar próximas tarefas: ${error.message}`);
  }
}

const CS_PROJECT = process.env.BIGQUERY_PROJECT_ID || 'dadosindicadores';
const CS_DATASET = 'CS';
const PORT_DATASET = 'portifolio';
const CS_NPS_TABLE = 'CS_NPS_pbi';
const PORT_CLIENTES_TABLE = 'port_clientes';

/**
 * Busca dados de NPS (CS_NPS_pbi) com vínculo a port_clientes.
 * Filtra por time do líder quando aplicável.
 *
 * @param {string|null} ultimoTime - Ultimo_Time para filtrar (leader); null = todos
 * @param {{ campanha?: string, organizacao?: string, cargo?: string }} filters
 * @returns {Promise<Array>}
 */
export async function queryNPSRaw(ultimoTime, filters = {}) {
  if (!bigquery) throw new Error('Cliente BigQuery não inicializado');

  const { campanha, organizacao, cargo } = filters;

  let sql = `
    SELECT
      n.Campanha,
      n.ID_da_resposta,
      n.Nome,
      n.Cargo,
      n.\`Organiza___o\`,
      n.\`Prt___Cliente\`,
      n.E_mail,
      n.Coordenador,
      n.NPS,
      n.Feedback,
      n.data,
      p.Ultimo_Time,
      p.Ultimo_Coordenador
    FROM \`${CS_PROJECT}.${CS_DATASET}.${CS_NPS_TABLE}\` n
    INNER JOIN \`${CS_PROJECT}.${PORT_DATASET}.${PORT_CLIENTES_TABLE}\` p
      ON TRIM(COALESCE(n.\`Prt___Cliente\`, '')) = TRIM(COALESCE(p.Cliente, ''))
    WHERE 1=1
  `;

  if (ultimoTime) {
    const escaped = String(ultimoTime).replace(/'/g, "''");
    sql += ` AND TRIM(COALESCE(p.Ultimo_Time, '')) = TRIM('${escaped}')`;
  }
  if (campanha && String(campanha).trim() !== '') {
    const escaped = String(campanha).replace(/'/g, "''");
    sql += ` AND TRIM(COALESCE(n.Campanha, '')) = TRIM('${escaped}')`;
  }
  if (organizacao && String(organizacao).trim() !== '' && organizacao !== 'Todos') {
    const escaped = String(organizacao).replace(/'/g, "''");
    sql += ` AND TRIM(COALESCE(n.\`Organiza___o\`, '')) = TRIM('${escaped}')`;
  }
  if (cargo && String(cargo).trim() !== '' && cargo !== 'Todos') {
    const escaped = String(cargo).replace(/'/g, "''");
    sql += ` AND TRIM(COALESCE(n.Cargo, '')) = TRIM('${escaped}')`;
  }

  sql += ` ORDER BY n.data DESC, n.Campanha, n.\`Organiza___o\``;

  try {
    const rows = await executeQuery(sql);
    return rows;
  } catch (e) {
    console.error('❌ Erro ao buscar NPS:', e);
    throw new Error(`Erro ao buscar NPS: ${e.message}`);
  }
}

/**
 * Lista clientes (port_clientes) por Ultimo_Time para cálculo de “clientes ativos”.
 *
 * @param {string|null} ultimoTime - Filtrar por time; null = todos
 * @returns {Promise<Array<{ Ultimo_Time: string, Cliente: string }>>}
 */
export async function queryPortClientes(ultimoTime) {
  if (!bigquery) throw new Error('Cliente BigQuery não inicializado');

  let sql = `
    SELECT Ultimo_Time, Cliente
    FROM \`${CS_PROJECT}.${PORT_DATASET}.${PORT_CLIENTES_TABLE}\`
    WHERE TRIM(COALESCE(Cliente, '')) <> ''
  `;
  if (ultimoTime) {
    const escaped = String(ultimoTime).replace(/'/g, "''");
    sql += ` AND TRIM(COALESCE(Ultimo_Time, '')) = TRIM('${escaped}')`;
  }
  sql += ` ORDER BY Ultimo_Time, Cliente`;

  try {
    const rows = await executeQuery(sql);
    return rows;
  } catch (e) {
    console.error('❌ Erro ao buscar port_clientes:', e);
    throw new Error(`Erro ao buscar port_clientes: ${e.message}`);
  }
}

/**
 * Opções para filtros NPS (Campanha, Organização, Cargo).
 * @param {string|null} ultimoTime
 * @returns {Promise<Array<{ Campanha: string, Organiza___o: string, Cargo: string }>>}
 */
export async function queryNPSFilterOptions(ultimoTime) {
  if (!bigquery) throw new Error('Cliente BigQuery não inicializado');

  let sql = `
    SELECT DISTINCT n.Campanha, n.\`Organiza___o\`, n.Cargo
    FROM \`${CS_PROJECT}.${CS_DATASET}.${CS_NPS_TABLE}\` n
    INNER JOIN \`${CS_PROJECT}.${PORT_DATASET}.${PORT_CLIENTES_TABLE}\` p
      ON TRIM(COALESCE(n.\`Prt___Cliente\`, '')) = TRIM(COALESCE(p.Cliente, ''))
    WHERE (TRIM(COALESCE(n.Campanha, '')) <> '' OR TRIM(COALESCE(n.\`Organiza___o\`, '')) <> '' OR TRIM(COALESCE(n.Cargo, '')) <> '')
  `;
  if (ultimoTime) {
    const escaped = String(ultimoTime).replace(/'/g, "''");
    sql += ` AND TRIM(COALESCE(p.Ultimo_Time, '')) = TRIM('${escaped}')`;
  }
  sql += ` ORDER BY n.Campanha, n.\`Organiza___o\`, n.Cargo`;

  try {
    return await executeQuery(sql);
  } catch (e) {
    console.error('❌ Erro ao buscar filtros NPS:', e);
    throw new Error(`Erro ao buscar filtros NPS: ${e.message}`);
  }
}

const DADOS_PROJECT = process.env.BIGQUERY_PROJECT_ID || 'dadosindicadores';
const APOIO_DATASET = 'apoio_projetos';
const ESTUDO_CUSTOS_TABLE = 'estudo_custos_pbi';
const TIMETRACKER_DATASET = 'timetracker';
const TIMETRACKER_TABLE = 'timetracker_merged';

/**
 * Busca dados de Estudo de Custos (estudo_custos_pbi) com coordenador do portfólio.
 * Todos os usuários autenticados têm acesso.
 * LEFT JOIN ao portfólio por Projeto = project_name → lider como coordenador.
 *
 * @returns {Promise<Array>}
 */
export async function queryEstudoCustos() {
  if (!bigquery) throw new Error('Cliente BigQuery não inicializado');

  const portProject = projectId;
  const portDataset = datasetId;
  const portTable = tablePortfolio;

  const sql = `
    SELECT
      e.Projeto,
      e.\`C__digo_do_Projeto\` AS codigo_projeto,
      e.Data,
      e.\`Valor_Estudo_Custo\` AS valor_estudo_custo,
      e.\`Custo_Estimado_Obra\` AS custo_estimado_obra,
      e.\`_Economia_Oba\` AS economia_oba,
      e.Planilha,
      p.lider AS coordenador
    FROM \`${DADOS_PROJECT}.${APOIO_DATASET}.${ESTUDO_CUSTOS_TABLE}\` e
    LEFT JOIN (
      SELECT DISTINCT project_name, lider
      FROM \`${portProject}.${portDataset}.${portTable}\`
      WHERE TRIM(COALESCE(project_name, '')) <> ''
        AND lider IS NOT NULL
    ) p ON LOWER(TRIM(COALESCE(e.Projeto, ''))) = LOWER(TRIM(COALESCE(p.project_name, '')))
    WHERE TRIM(COALESCE(e.Projeto, '')) <> ''
    ORDER BY e.Data DESC, e.Projeto
  `;

  try {
    const rows = await executeQuery(sql);
    return rows;
  } catch (e) {
    console.error('❌ Erro ao buscar estudo de custos:', e);
    throw new Error(`Erro ao buscar estudo de custos: ${e.message}`);
  }
}

/**
 * Busca dados de Horas (timetracker_merged) com vínculo ao portfólio por projeto.
 * Líderes veem apenas seu time; privilegiados veem todos.
 *
 * @param {string|null} leaderName - Nome do líder para filtrar; null = todos
 * @param {{ dataInicio?: string, dataFim?: string }} opts - dataInicio/dataFim em YYYY-MM-DD (opcional)
 * @returns {Promise<Array<{ task_name, fase, projeto, usuario, duracao, data_de_apontamento, lider }>>}
 */
export async function queryHorasRaw(leaderName, opts = {}) {
  if (!bigquery) throw new Error('Cliente BigQuery não inicializado');

  const portProject = projectId;
  const portDataset = datasetId;
  const portTable = tablePortfolio;
  const { dataInicio, dataFim } = opts;

  let sql = `
    SELECT
      t.task_name,
      t.fase,
      t.projeto,
      t.usuario,
      t.duracao,
      t.data_de_apontamento,
      p.lider
    FROM \`${DADOS_PROJECT}.${TIMETRACKER_DATASET}.${TIMETRACKER_TABLE}\` t
    LEFT JOIN (
      SELECT DISTINCT project_name, lider
      FROM \`${portProject}.${portDataset}.${portTable}\`
      WHERE TRIM(COALESCE(project_name, '')) <> ''
        AND lider IS NOT NULL
    ) p ON LOWER(TRIM(COALESCE(t.projeto, ''))) = LOWER(TRIM(COALESCE(p.project_name, '')))
    WHERE 1=1
  `;

  if (leaderName) {
    const escaped = String(leaderName).replace(/'/g, "''");
    sql += ` AND LOWER(TRIM(COALESCE(p.lider, ''))) = LOWER(TRIM('${escaped}'))`;
  }

  if (dataInicio && /^\d{4}-\d{2}-\d{2}$/.test(String(dataInicio).trim())) {
    sql += ` AND t.data_de_apontamento >= DATE('${String(dataInicio).trim()}')`;
  }
  if (dataFim && /^\d{4}-\d{2}-\d{2}$/.test(String(dataFim).trim())) {
    sql += ` AND t.data_de_apontamento <= DATE('${String(dataFim).trim()}')`;
  }

  /* Sem ORDER BY para acelerar; ordenação feita em Node. */

  try {
    const rows = await executeQuery(sql);
    return rows;
  } catch (e) {
    console.error('❌ Erro ao buscar horas:', e);
    throw new Error(`Erro ao buscar horas: ${e.message}`);
  }
}
