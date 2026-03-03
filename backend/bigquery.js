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
 * @param {Object} [params] - Parâmetros nomeados para a query (ex: { mes: '2025-01-01' })
 * @returns {Promise<Array>} - Array com os resultados
 */
async function executeQuery(query, params) {
  try {
    // Log apenas um resumo da query (primeiras 200 caracteres) para não poluir o console
    const queryPreview = query.length > 200 ? query.substring(0, 200) + '...' : query;
    console.log('🔍 Executando query:', queryPreview);

    const jobConfig = {
      query: query,
      location: location, // Localização do dataset (southamerica-east1)
    };

    if (params) {
      jobConfig.params = params;
    }

    const [job] = await bigquery.createQueryJob(jobConfig);

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

// Cache permanente das colunas do portfólio (schema não muda durante runtime)
let portfolioColumnsCache = null;

async function getPortfolioColumns() {
  if (portfolioColumnsCache) return portfolioColumnsCache;

  const schema = await getTableSchema(tablePortfolio);
  const columns = new Set(
    schema
      .map(col => String(col.column_name || '').toLowerCase())
      .filter(Boolean)
  );

  portfolioColumnsCache = columns;
  return columns;
}

async function hasPortfolioColumn(columnName) {
  const columns = await getPortfolioColumns();
  return columns.has(String(columnName || '').toLowerCase());
}

// Cache permanente do schema de entradas (schema não muda durante runtime)
let entradasSchemaCache = null;

async function getEntradasSchema() {
  if (entradasSchemaCache) return entradasSchemaCache;

  const schema = await getTableSchemaForDataset('financeiro', 'entradas');
  entradasSchemaCache = schema;

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
    receitas_liquidas_mensais AS (
      SELECT
        project_code,
        mes,
        SUM(COALESCE(receita_bruta, 0)) AS receita_bruta_mes,
        SUM(COALESCE(receita_liquida, 0)) AS receita_liquida_mes,
        SUM(COALESCE(margem_55, 0)) AS margem_55_mes
      FROM \`${projectId}.financeiro.receita_liquida_projeto_mes\`
      WHERE project_code IS NOT NULL
        AND mes IS NOT NULL
  `;

  // Filtro por projeto específico se fornecido
  if (projectCode) {
    const escapedCode = projectCode.replace(/'/g, "''");
    query += ` AND project_code = '${escapedCode}'`;
  }

  query += `
      GROUP BY project_code, mes
    ),
    todos_meses AS (
      SELECT DISTINCT project_code, mes FROM custos_mensais
      UNION DISTINCT
      SELECT DISTINCT project_code, mes FROM receitas_mensais
      UNION DISTINCT
      SELECT DISTINCT project_code, mes FROM receitas_liquidas_mensais
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
        -- Receita líquida da nova tabela (receita bruta - imposto)
        COALESCE(rl.receita_liquida_mes, 0) AS receita_liquida_mes,
        -- Margem 55% = Receita Líquida × 0.55 (valor disponível para custos)
        COALESCE(rl.margem_55_mes, 0) AS margem_55_mes,
        -- Margem Operacional = Margem 55% - Custo (lucro/prejuízo)
        COALESCE(rl.margem_55_mes, 0) - COALESCE(c.custo_total_mes, 0) AS margem_operacional_mes,
        -- Calcula margem (55% do valor do contrato) - legado
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
      LEFT JOIN receitas_liquidas_mensais rl
        ON CAST(m.project_code_norm AS STRING) = rl.project_code
        AND m.mes = rl.mes
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
      receita_liquida_mes,
      margem_55_mes,
      margem_operacional_mes,
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
      -- Receita líquida acumulada (receita com desconto de imposto)
      SUM(receita_liquida_mes) OVER (
        PARTITION BY project_code_norm
        ORDER BY mes
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      ) AS receita_liquida_acumulado,
      -- Margem 55% acumulada (receita líquida × 0.55 - valor disponível para custos)
      SUM(margem_55_mes) OVER (
        PARTITION BY project_code_norm
        ORDER BY mes
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      ) AS margem_55_acumulado
    FROM dados_combinados
    WHERE mes IS NOT NULL
      AND mes <= CURRENT_DATE()
    ORDER BY project_code_norm, mes ASC
  `;

  console.log('📊 Query Curva S gerada. Executando...');
  const rows = await executeQuery(query);

  // Campos derivados calculados em JS (evita window functions extras no BigQuery)
  for (const row of rows) {
    row.margem_operacional_acumulado = (row.margem_55_acumulado || 0) - (row.custo_total_acumulado || 0);
    row.valor_margem_acumulado = (row.receita_bruta_acumulado || 0) - (row.custo_total_acumulado || 0);
  }

  return rows;
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
 * Busca custos por usuário, projeto e mês para breakdown por cargo
 * Retorna dados granulares que serão enriquecidos com cargo no endpoint
 *
 * @param {string|null} leaderName - Nome do líder para filtrar projetos (opcional)
 * @param {string|null} projectCode - Código do projeto específico (opcional)
 * @returns {Promise<Array>} - Dados por usuário/projeto/mês
 */
export async function queryCustosPorUsuarioProjeto(leaderName = null, projectCode = null) {
  const costDataset = 'financeiro';
  const costTable = 'custo_usuario_projeto_mes';

  let portfolioFilter = '';
  if (leaderName) {
    const hasLider = await hasPortfolioColumn('lider');
    if (!hasLider) {
      console.warn('⚠️ Coluna "lider" não encontrada na tabela do portfólio. Retornando vazio por segurança.');
      return [];
    }
    const escapedName = leaderName.replace(/'/g, "''");
    portfolioFilter = `AND LOWER(lider) = LOWER('${escapedName}')`;
  }

  let projectFilter = '';
  if (projectCode) {
    const escapedCode = projectCode.replace(/'/g, "''");
    projectFilter = `AND c.project_code = '${escapedCode}'`;
  }

  const query = `
    WITH portfolio_projects AS (
      SELECT DISTINCT CAST(project_code_norm AS STRING) AS project_code_norm
      FROM \`${projectId}.${datasetId}.${tablePortfolio}\`
      WHERE project_code_norm IS NOT NULL
      ${portfolioFilter}
    )
    SELECT
      c.usuario,
      CAST(c.project_code AS STRING) AS project_code,
      c.mes,
      SUM(COALESCE(c.custo_direto_usuario_projeto_mes, 0)) AS custo_direto,
      SUM(COALESCE(c.custo_indireto_usuario_projeto_mes, 0)) AS custo_indireto,
      SUM(COALESCE(c.custo_total_usuario_projeto_mes, 0)) AS custo_total,
      SUM(COALESCE(c.horas_usuario_projeto_mes, 0)) AS horas,
      MAX(COALESCE(c.horas_totais_mes_usuario, 0)) AS horas_totais_mes
    FROM \`${projectId}.${costDataset}.${costTable}\` c
    INNER JOIN portfolio_projects pp
      ON CAST(c.project_code AS STRING) = pp.project_code_norm
    WHERE c.project_code IS NOT NULL
      AND c.mes IS NOT NULL
      AND c.mes <= CURRENT_DATE()
      ${projectFilter}
    GROUP BY c.usuario, CAST(c.project_code AS STRING), c.mes
    ORDER BY c.usuario, CAST(c.project_code AS STRING), c.mes ASC
  `;

  return await executeQuery(query);
}

/**
 * Reconciliação mensal: compara totais da fonte financeira vs custos distribuídos
 * @returns {Promise<Array>} - Resumo mês a mês com fonte, distribuído e diferença
 */
export async function queryReconciliacaoMensal() {
  const query = `
    WITH fonte_direto AS (
      SELECT
        M__s AS mes,
        ABS(SUM(Valor)) AS total_direto_fonte
      FROM \`${projectId}.financeiro_custos_operacao.custos_operacao_diretos\`
      GROUP BY mes
    ),
    fonte_indireto AS (
      SELECT
        M__s AS mes,
        ABS(SUM(Valor)) AS total_indireto_fonte
      FROM \`${projectId}.financeiro_custos_operacao.custos_operacao_indiretos\`
      GROUP BY mes
    ),
    distribuido AS (
      SELECT
        mes,
        SUM(custo_direto_usuario_projeto_mes) AS total_direto_dist,
        SUM(custo_indireto_usuario_projeto_mes) AS total_indireto_dist,
        SUM(custo_total_usuario_projeto_mes) AS total_dist
      FROM \`${projectId}.financeiro.custo_usuario_projeto_mes\`
      GROUP BY mes
    )
    SELECT
      COALESCE(fd.mes, fi.mes, d.mes) AS mes,
      COALESCE(fd.total_direto_fonte, 0) AS total_direto_fonte,
      COALESCE(fi.total_indireto_fonte, 0) AS total_indireto_fonte,
      COALESCE(fd.total_direto_fonte, 0) + COALESCE(fi.total_indireto_fonte, 0) AS total_fonte,
      COALESCE(d.total_direto_dist, 0) AS total_direto_dist,
      COALESCE(d.total_indireto_dist, 0) AS total_indireto_dist,
      COALESCE(d.total_dist, 0) AS total_dist,
      (COALESCE(fd.total_direto_fonte, 0) + COALESCE(fi.total_indireto_fonte, 0))
        - COALESCE(d.total_dist, 0) AS diferenca
    FROM fonte_direto fd
    FULL OUTER JOIN fonte_indireto fi ON fd.mes = fi.mes
    FULL OUTER JOIN distribuido d ON COALESCE(fd.mes, fi.mes) = d.mes
    ORDER BY COALESCE(fd.mes, fi.mes, d.mes) DESC
  `;

  return await executeQuery(query);
}

/**
 * Reconciliação por usuário: para um mês, compara custo-fonte vs distribuído por pessoa
 * @param {string} mes - Mês no formato YYYY-MM-DD
 * @returns {Promise<Array>} - Detalhamento por usuário com status
 */
export async function queryReconciliacaoUsuarios(mes) {
  const query = `
    WITH fonte_usuario AS (
      SELECT
        d.Nome_do_fornecedor_cliente AS usuario_fonte,
        COALESCE(alias.nome_correto, d.Nome_do_fornecedor_cliente) AS usuario,
        ABS(SUM(d.Valor)) AS salario_fonte
      FROM \`${projectId}.financeiro_custos_operacao.custos_operacao_diretos\` d
      LEFT JOIN \`${projectId}.financeiro_custos_operacao.usuario_alias\` alias
        ON LOWER(TRIM(d.Nome_do_fornecedor_cliente)) = LOWER(TRIM(alias.nome_planilha))
      WHERE d.M__s = @mes
      GROUP BY usuario_fonte, usuario
    ),
    indireto_usuario AS (
      SELECT
        COALESCE(alias.nome_correto, c.usuario) AS usuario,
        c.custo_indireto_usuario_mes AS indireto_fonte,
        c.custo_total_usuario_mes AS total_fonte_usuario
      FROM \`${projectId}.financeiro_custos_operacao.custo_indireto_usuario_mes\` c
      LEFT JOIN \`${projectId}.financeiro_custos_operacao.usuario_alias\` alias
        ON LOWER(TRIM(c.usuario)) = LOWER(TRIM(alias.nome_planilha))
      WHERE c.mes = @mes
    ),
    dist_usuario AS (
      SELECT
        usuario,
        SUM(custo_direto_usuario_projeto_mes) AS direto_dist,
        SUM(custo_indireto_usuario_projeto_mes) AS indireto_dist,
        SUM(custo_total_usuario_projeto_mes) AS total_dist,
        COUNT(DISTINCT project_code) AS qtd_projetos
      FROM \`${projectId}.financeiro.custo_usuario_projeto_mes\`
      WHERE mes = @mes
      GROUP BY usuario
    )
    SELECT
      COALESCE(f.usuario, du.usuario) AS usuario,
      f.salario_fonte,
      iu.indireto_fonte,
      iu.total_fonte_usuario,
      du.direto_dist,
      du.indireto_dist,
      du.total_dist,
      du.qtd_projetos,
      COALESCE(iu.total_fonte_usuario, f.salario_fonte, 0) - COALESCE(du.total_dist, 0) AS diferenca,
      CASE
        WHEN du.usuario IS NULL THEN 'nao_alocado'
        WHEN f.usuario IS NULL THEN 'sem_fonte'
        ELSE 'ok'
      END AS status
    FROM fonte_usuario f
    FULL OUTER JOIN dist_usuario du
      ON LOWER(TRIM(f.usuario)) = LOWER(TRIM(du.usuario))
    LEFT JOIN indireto_usuario iu
      ON LOWER(TRIM(COALESCE(f.usuario, du.usuario))) = LOWER(TRIM(iu.usuario))
    ORDER BY ABS(COALESCE(iu.total_fonte_usuario, f.salario_fonte, 0) - COALESCE(du.total_dist, 0)) DESC
  `;

  return await executeQuery(query, { mes });
}

/**
 * Reconciliação por projeto: para um usuário num mês, mostra distribuição por projeto
 * @param {string} mes - Mês no formato YYYY-MM-DD
 * @param {string} usuario - Nome do usuário
 * @returns {Promise<Array>} - Projetos com horas, peso e custos
 */
export async function queryReconciliacaoProjetos(mes, usuario) {
  const query = `
    SELECT
      project_code,
      projeto,
      horas_usuario_projeto_mes AS horas,
      horas_totais_mes_usuario AS horas_totais,
      peso_projeto_no_mes AS peso,
      custo_direto_usuario_projeto_mes AS custo_direto,
      custo_indireto_usuario_projeto_mes AS custo_indireto,
      custo_total_usuario_projeto_mes AS custo_total
    FROM \`${projectId}.financeiro.custo_usuario_projeto_mes\`
    WHERE mes = @mes
      AND LOWER(TRIM(usuario)) = LOWER(TRIM(@usuario))
    ORDER BY custo_total_usuario_projeto_mes DESC
  `;

  return await executeQuery(query, { mes, usuario });
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
 * Suporta duas formas de identificação:
 * 1. smartsheetId numérico (formato antigo)
 * 2. projectName com match normalizado (formato novo após mudança BigQuery)
 *
 * @param {string} smartsheetId - ID do projeto no SmartSheet (corresponde ao smartsheet_id do portfólio)
 * @param {string} projectName - Nome do projeto no portfólio (opcional, usado para match normalizado)
 * @returns {Promise<Array>} - Dados do cronograma
 */
export async function queryCronograma(smartsheetId, projectName = null) {
  if (!smartsheetId && !projectName) {
    throw new Error('smartsheetId ou projectName é obrigatório');
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
  const smartsheetProjectId = 'dadosindicadores';
  const smartsheetDataset = 'smartsheet';
  const smartsheetTable = 'smartsheet_data_projetos';

  console.log(`📅 [queryCronograma] Iniciando busca de cronograma`);
  console.log(`   Projeto BigQuery: ${smartsheetProjectId}`);
  console.log(`   Dataset: ${smartsheetDataset}`);
  console.log(`   Tabela: ${smartsheetTable}`);
  console.log(`   SmartSheet ID: ${smartsheetId}`);
  console.log(`   Project Name: ${projectName}`);

  const selectFields = `
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
      MedicaoPagamento`;

  try {
    let rows = [];

    // Estratégia 1: Tentar pelo smartsheetId numérico (formato antigo)
    if (smartsheetId) {
      const escapedId = String(smartsheetId).replace(/'/g, "''");
      console.log('📅 Estratégia 1: Buscando por smartsheetId numérico...');

      const queryById = `
        SELECT ${selectFields}
        FROM \`${smartsheetProjectId}.${smartsheetDataset}.${smartsheetTable}\`
        WHERE ID_Projeto = '${escapedId}'
        ORDER BY DataDeTermino ASC, NomeDaTarefa ASC
      `;

      rows = await executeQuery(queryById);
      console.log(`   Resultado: ${rows.length} linhas`);
    }

    // Estratégia 2: Se não encontrou e tem projectName, tentar match normalizado
    if (rows.length === 0 && projectName) {
      console.log('📅 Estratégia 2: Buscando por match normalizado do nome...');

      // Normaliza o projectName removendo caracteres especiais
      // Ex: ABC_RUA289 -> abcrua289
      const escapedProjectName = String(projectName).replace(/'/g, "''");

      // Query com match normalizado:
      // - Remove "Pjt - ", "(Backup...)", espaços, hífens do NomeDaPlanilha
      // - Remove underscores do projectName
      // - Compara se um contém o outro
      // - Exclui backups, cópias e obsoletos
      const queryByName = `
        WITH normalized AS (
          SELECT
            *,
            LOWER(REGEXP_REPLACE(
              REGEXP_REPLACE(NomeDaPlanilha, r'^\\(.*?\\)\\s*', ''),
              r'[^a-zA-Z0-9]', ''
            )) AS nome_normalizado
          FROM \`${smartsheetProjectId}.${smartsheetDataset}.${smartsheetTable}\`
          WHERE NomeDaPlanilha NOT LIKE '%(Backup%'
            AND NomeDaPlanilha NOT LIKE '%Cópia%'
            AND NomeDaPlanilha NOT LIKE '%OBSOLETO%'
            AND NomeDaPlanilha NOT LIKE '%obsoleto%'
            AND NomeDaPlanilha NOT LIKE '%Copy%'
        )
        SELECT ${selectFields}
        FROM normalized
        WHERE nome_normalizado LIKE CONCAT('%', LOWER(REGEXP_REPLACE('${escapedProjectName}', r'[^a-zA-Z0-9]', '')), '%')
        ORDER BY DataDeTermino ASC, NomeDaTarefa ASC
      `;

      rows = await executeQuery(queryByName);
      console.log(`   Resultado: ${rows.length} linhas`);

      if (rows.length > 0) {
        console.log(`   ✅ Match encontrado via nome normalizado: ${rows[0].NomeDaPlanilha}`);
      }
    }

    console.log(`✅ Query de cronograma retornou ${rows.length} linhas no total`);
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

  // Query com match normalizado para suportar o novo formato de ID_Projeto
  // O JOIN é feito comparando o nome normalizado da planilha com o nome do projeto
  let query = `
    WITH smartsheet_normalized AS (
      SELECT
        *,
        -- Normaliza: remove prefixos como (Backup...), caracteres especiais, e converte para minúsculo
        LOWER(REGEXP_REPLACE(
          REGEXP_REPLACE(NomeDaPlanilha, r'^\\(.*?\\)\\s*', ''),
          r'[^a-zA-Z0-9]', ''
        )) AS nome_normalizado
      FROM \`${smartsheetProjectId}.${smartsheetDataset}.${smartsheetTable}\`
      WHERE NomeDaPlanilha NOT LIKE '%(Backup%'
        AND NomeDaPlanilha NOT LIKE '%Cópia%'
        AND NomeDaPlanilha NOT LIKE '%OBSOLETO%'
        AND NomeDaPlanilha NOT LIKE '%obsoleto%'
        AND NomeDaPlanilha NOT LIKE '%Copy%'
    ),
    portfolio_normalized AS (
      SELECT
        *,
        -- Normaliza: remove caracteres especiais e converte para minúsculo
        LOWER(REGEXP_REPLACE(project_name, r'[^a-zA-Z0-9]', '')) AS nome_normalizado
      FROM \`${projectId}.${datasetId}.${tablePortfolio}\`
      WHERE project_name IS NOT NULL
    )
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
      p.nome_time,
      p.project_name
    FROM smartsheet_normalized s
    INNER JOIN portfolio_normalized p
      ON s.nome_normalizado LIKE CONCAT('%', p.nome_normalizado, '%')
    WHERE
      s.DataDeInicio IS NOT NULL
      AND s.DataDeTermino >= CURRENT_DATE()
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

/**
 * Busca tarefas de Modelagem diretamente da tabela SmartSheet.
 * Query dedicada sem JOIN com portfolio — as planilhas de Modelagem
 * não casam com projetos do portfolio pelo nome normalizado.
 */
export async function queryModelagemTarefas(options = {}) {
  const { weeksAhead = 8 } = options;

  const query = `
    SELECT
      ID_Projeto,
      NomeDaPlanilha AS projeto_nome,
      NomeDaTarefa,
      DataDeInicio,
      DataDeTermino,
      Disciplina,
      Status,
      KPI,
      Level,
      rowId,
      CaminhoCriticoMarco
    FROM \`dadosindicadores.smartsheet.smartsheet_data_projetos\`
    WHERE
      LOWER(Disciplina) LIKE '%modelagem%'
      AND DataDeInicio IS NOT NULL
      AND DataDeTermino >= CURRENT_DATE()
      AND DataDeInicio <= DATE_ADD(CURRENT_DATE(), INTERVAL ${weeksAhead} WEEK)
      AND NomeDaPlanilha NOT LIKE '%(Backup%'
      AND NomeDaPlanilha NOT LIKE '%Cópia%'
      AND NomeDaPlanilha NOT LIKE '%OBSOLETO%'
      AND NomeDaPlanilha NOT LIKE '%Copy%'
    ORDER BY DataDeInicio ASC, NomeDaPlanilha, Disciplina
  `;

  try {
    console.log(`📅 [queryModelagemTarefas] Buscando tarefas de Modelagem (${weeksAhead} semanas)`);
    const rows = await executeQuery(query);
    console.log(`✅ Query retornou ${rows.length} tarefas de Modelagem`);
    return rows;
  } catch (error) {
    console.error('❌ Erro ao buscar tarefas de Modelagem:', error.message);
    throw new Error(`Erro ao buscar tarefas de Modelagem: ${error.message}`);
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
/**
 * Busca dados consolidados para o Controle Passivo (Admin & Financeiro)
 *
 * Combina portfólio com receitas recebidas (financeiro.entradas) para mostrar:
 * - Valor contratado (contrato + aditivos)
 * - Receita recebida (soma das entradas)
 * - Valor a receber (contratado - recebido)
 * - % recebido
 */
export async function queryControlePassivo(leaderName = null) {
  const hasLider = await hasPortfolioColumn('lider');
  if (leaderName && !hasLider) {
    console.warn('⚠️ Coluna "lider" não encontrada na tabela do portfólio. Retornando vazio por segurança.');
    return [];
  }

  const entradasSchema = await getEntradasSchema();
  const entradasColumns = getColumnsSetFromSchema(entradasSchema);
  let entradasDateColumn = pickFirstExistingColumn(entradasColumns, [
    'M_s', 'mes', 'data', 'data_mes', 'data_entrada', 'dt', 'competencia', 'data_competencia'
  ]);
  if (!entradasDateColumn) {
    entradasDateColumn = pickDateColumnFromSchema(entradasSchema);
  }

  let query = `
    WITH portfolio_base AS (
      SELECT
        project_code_norm,
        project_name,
        comercial_name,
        client,
        lider,
        nome_time,
        status,
        COALESCE(valor_total_contrato_mais_aditivos, 0) AS valor_contratado,
        data_inicio_cronograma,
        COALESCE(duracao_total_meses, 0) AS duracao_total_meses,
        COALESCE(total_dias_pausa, 0) AS total_dias_pausa,
        CASE
          WHEN data_inicio_cronograma IS NOT NULL
          THEN ROUND(
            (DATE_DIFF(CURRENT_DATE(), SAFE_CAST(data_inicio_cronograma AS DATE), DAY)
             - COALESCE(total_dias_pausa, 0)) / 30.44, 2)
          ELSE NULL
        END AS meses_ativos
      FROM \`${projectId}.${datasetId}.${tablePortfolio}\`
      WHERE project_code_norm IS NOT NULL
  `;

  if (leaderName) {
    const escapedName = leaderName.replace(/'/g, "''");
    query += ` AND LOWER(lider) = LOWER('${escapedName}')`;
  }

  query += `
    ),
    receitas_recebidas AS (
      SELECT
        CAST(codigo_projeto AS STRING) AS project_code,
        SUM(COALESCE(Valor, 0)) AS receita_recebida_total
      FROM \`${projectId}.financeiro.entradas\`
      WHERE codigo_projeto IS NOT NULL${entradasDateColumn ? `
        AND COALESCE(
          SAFE_CAST(${entradasDateColumn} AS DATE),
          SAFE.PARSE_DATE('%Y-%m-%d', CAST(${entradasDateColumn} AS STRING)),
          SAFE.PARSE_DATE('%d/%m/%Y', CAST(${entradasDateColumn} AS STRING))
        ) <= CURRENT_DATE()` : ''}
      GROUP BY project_code
    )
    SELECT
      p.project_code_norm,
      p.project_name,
      p.client,
      p.status,
      p.valor_contratado,
      COALESCE(r.receita_recebida_total, 0) AS receita_recebida,
      p.data_inicio_cronograma,
      p.duracao_total_meses,
      p.meses_ativos
    FROM portfolio_base p
    LEFT JOIN receitas_recebidas r
      ON CAST(p.project_code_norm AS STRING) = r.project_code
    ORDER BY p.project_code_norm
  `;

  try {
    const rows = await executeQuery(query);
    return rows;
  } catch (e) {
    console.error('❌ Erro ao buscar controle passivo:', e);
    throw new Error(`Erro ao buscar controle passivo: ${e.message}`);
  }
}

/**
 * Busca custos agregados por projeto para Indicadores de Vendas
 * Agrega custo_total, meses_com_custo e horas_total por projeto
 */
export async function queryCustosAgregadosProjeto() {
  const costDataset = 'financeiro';
  const costTable = 'custo_usuario_projeto_mes';

  const query = `
    SELECT
      c.project_code,
      SUM(COALESCE(c.custo_total_usuario_projeto_mes, 0)) AS custo_total,
      COUNT(DISTINCT c.mes) AS meses_com_custo,
      SUM(COALESCE(c.horas_usuario_projeto_mes, 0)) AS horas_total
    FROM \`${projectId}.${costDataset}.${costTable}\` c
    WHERE c.project_code IS NOT NULL
      AND c.mes IS NOT NULL
    GROUP BY c.project_code
  `;

  try {
    return await executeQuery(query);
  } catch (e) {
    console.error('❌ Erro ao buscar custos agregados:', e);
    throw new Error(`Erro ao buscar custos agregados: ${e.message}`);
  }
}

/**
 * Busca disciplinas distintas do Smartsheet e ConstruFlow para análise cruzada.
 * Usado para verificar se o coordenador registrou todas as disciplinas na plataforma Otus.
 *
 * @param {string} construflowId - ID do projeto no ConstruFlow
 * @param {string|null} smartsheetId - ID do projeto no Smartsheet
 * @param {string|null} projectName - Nome do projeto (fallback para match normalizado)
 * @returns {Promise<Object>} - { smartsheet: string[], construflow: string[] }
 */
export async function queryDisciplinesCrossReference(construflowId, smartsheetId = null, projectName = null) {
  if (!projectId || projectId === 'seu-project-id') {
    throw new Error(`BIGQUERY_PROJECT_ID não está configurado. Valor atual: "${projectId}"`);
  }
  if (!bigquery) {
    throw new Error('Cliente BigQuery não foi inicializado corretamente');
  }

  const smartsheetProjectId = 'dadosindicadores';
  const smartsheetDataset = 'smartsheet';
  const smartsheetTable = 'smartsheet_data_projetos';
  const issuesDataset = 'construflow_data';

  console.log(`🔀 [queryDisciplinesCrossReference] Iniciando análise cruzada de disciplinas`);
  console.log(`   ConstruFlow ID: ${construflowId}`);
  console.log(`   SmartSheet ID: ${smartsheetId}`);
  console.log(`   Project Name: ${projectName}`);

  // 1. Busca disciplinas do Smartsheet
  let smartsheetDisciplines = [];
  try {
    if (smartsheetId) {
      const escapedId = String(smartsheetId).replace(/'/g, "''");
      const query = `
        SELECT DISTINCT Disciplina
        FROM \`${smartsheetProjectId}.${smartsheetDataset}.${smartsheetTable}\`
        WHERE ID_Projeto = '${escapedId}'
          AND Disciplina IS NOT NULL
          AND TRIM(Disciplina) != ''
          AND Level = 5
        ORDER BY Disciplina
      `;
      const rows = await executeQuery(query);
      smartsheetDisciplines = rows.map(r => r.Disciplina).filter(Boolean);
    }

    // Fallback por nome normalizado se não encontrou
    if (smartsheetDisciplines.length === 0 && projectName) {
      const escapedName = String(projectName).replace(/'/g, "''");
      const query = `
        WITH normalized AS (
          SELECT
            Disciplina,
            LOWER(REGEXP_REPLACE(
              REGEXP_REPLACE(NomeDaPlanilha, r'^\\(.*?\\)\\s*', ''),
              r'[^a-zA-Z0-9]', ''
            )) AS nome_normalizado
          FROM \`${smartsheetProjectId}.${smartsheetDataset}.${smartsheetTable}\`
          WHERE NomeDaPlanilha NOT LIKE '%(Backup%'
            AND NomeDaPlanilha NOT LIKE '%Cópia%'
            AND NomeDaPlanilha NOT LIKE '%OBSOLETO%'
            AND NomeDaPlanilha NOT LIKE '%Copy%'
            AND Disciplina IS NOT NULL
            AND TRIM(Disciplina) != ''
            AND Level = 5
        )
        SELECT DISTINCT Disciplina
        FROM normalized
        WHERE nome_normalizado LIKE CONCAT('%', LOWER(REGEXP_REPLACE('${escapedName}', r'[^a-zA-Z0-9]', '')), '%')
        ORDER BY Disciplina
      `;
      const rows = await executeQuery(query);
      smartsheetDisciplines = rows.map(r => r.Disciplina).filter(Boolean);
    }

    console.log(`   ✅ Smartsheet: ${smartsheetDisciplines.length} disciplinas`);
  } catch (err) {
    console.warn(`   ⚠️ Erro ao buscar disciplinas do Smartsheet (continuando):`, err.message);
  }

  // 2. Busca disciplinas do ConstruFlow
  let construflowDisciplines = [];
  try {
    if (construflowId) {
      const escapedCfId = String(construflowId).replace(/'/g, "''");
      const query = `
        SELECT DISTINCT d.name AS disciplineName
        FROM \`${projectId}.${issuesDataset}.issues_disciplines\` id_dis
        LEFT JOIN \`${projectId}.${issuesDataset}.disciplines\` d
          ON CAST(d.id AS STRING) = CAST(id_dis.disciplineId AS STRING)
        WHERE CAST(id_dis.issueId AS STRING) IN (
          SELECT CAST(id AS STRING)
          FROM \`${projectId}.${issuesDataset}.issues\`
          WHERE CAST(projectId AS STRING) = '${escapedCfId}'
        )
          AND d.name IS NOT NULL
        ORDER BY d.name
      `;
      const rows = await executeQuery(query);
      construflowDisciplines = rows.map(r => r.disciplineName).filter(Boolean);
    }

    console.log(`   ✅ ConstruFlow: ${construflowDisciplines.length} disciplinas`);
  } catch (err) {
    console.warn(`   ⚠️ Erro ao buscar disciplinas do ConstruFlow (continuando):`, err.message);
  }

  return {
    smartsheet: smartsheetDisciplines,
    construflow: construflowDisciplines
  };
}

/**
 * Versão batch da análise cruzada de disciplinas.
 * Faz apenas 2 queries BigQuery (1 Smartsheet + 1 ConstruFlow) para todos os projetos.
 * @param {Array<{construflowId: string, smartsheetId: string}>} projects
 * @returns {{ smartsheetByProject: Object, construflowByProject: Object }}
 */
export async function queryDisciplinesCrossReferenceBatch(projects) {
  if (!projectId || projectId === 'seu-project-id') {
    throw new Error(`BIGQUERY_PROJECT_ID não está configurado. Valor atual: "${projectId}"`);
  }
  if (!bigquery) {
    throw new Error('Cliente BigQuery não foi inicializado corretamente');
  }

  const smartsheetProjectId = 'dadosindicadores';
  const smartsheetDataset = 'smartsheet';
  const smartsheetTable = 'smartsheet_data_projetos';
  const issuesDataset = 'construflow_data';

  const smartsheetByProject = {};
  const construflowByProject = {};

  // 1. Batch Smartsheet - todas as disciplinas de todos os projetos com smartsheetId
  const smartsheetIds = projects
    .map(p => p.smartsheetId)
    .filter(Boolean)
    .map(id => String(id));

  if (smartsheetIds.length > 0) {
    try {
      const inClause = smartsheetIds.map(id => `'${id.replace(/'/g, "''")}'`).join(',');
      const query = `
        SELECT ID_Projeto, Disciplina
        FROM \`${smartsheetProjectId}.${smartsheetDataset}.${smartsheetTable}\`
        WHERE ID_Projeto IN (${inClause})
          AND Disciplina IS NOT NULL
          AND TRIM(Disciplina) != ''
          AND Level = 5
        GROUP BY ID_Projeto, Disciplina
        ORDER BY ID_Projeto, Disciplina
      `;
      const rows = await executeQuery(query);
      rows.forEach(r => {
        const key = String(r.ID_Projeto);
        if (!smartsheetByProject[key]) smartsheetByProject[key] = [];
        smartsheetByProject[key].push(r.Disciplina);
      });
      console.log(`🔀 [batch] Smartsheet: ${rows.length} registros de ${Object.keys(smartsheetByProject).length} projetos`);
    } catch (err) {
      console.warn('⚠️ Erro batch Smartsheet (continuando):', err.message);
    }
  }

  // 2. Batch ConstruFlow - todas as disciplinas de todos os projetos com construflowId
  const construflowIds = projects
    .map(p => p.construflowId)
    .filter(Boolean)
    .map(id => String(id));

  if (construflowIds.length > 0) {
    try {
      const inClause = construflowIds.map(id => `'${id.replace(/'/g, "''")}'`).join(',');
      const query = `
        SELECT CAST(i.projectId AS STRING) AS proj, d.name AS disciplineName
        FROM \`${projectId}.${issuesDataset}.issues_disciplines\` id_dis
        LEFT JOIN \`${projectId}.${issuesDataset}.disciplines\` d
          ON CAST(d.id AS STRING) = CAST(id_dis.disciplineId AS STRING)
        LEFT JOIN \`${projectId}.${issuesDataset}.issues\` i
          ON CAST(i.id AS STRING) = CAST(id_dis.issueId AS STRING)
        WHERE CAST(i.projectId AS STRING) IN (${inClause})
          AND d.name IS NOT NULL
        GROUP BY proj, d.name
        ORDER BY proj, d.name
      `;
      const rows = await executeQuery(query);
      rows.forEach(r => {
        const key = String(r.proj);
        if (!construflowByProject[key]) construflowByProject[key] = [];
        construflowByProject[key].push(r.disciplineName);
      });
      console.log(`🔀 [batch] ConstruFlow: ${rows.length} registros de ${Object.keys(construflowByProject).length} projetos`);
    } catch (err) {
      console.warn('⚠️ Erro batch ConstruFlow (continuando):', err.message);
    }
  }

  return { smartsheetByProject, construflowByProject };
}

/**
 * Busca tarefas Level 5 para cálculo da Curva S de progresso físico.
 * Deriva a Fase (Level 2 parent) usando window function sobre rowNumber.
 *
 * @param {string} smartsheetId - ID do projeto no SmartSheet
 * @param {string} projectName - Nome do projeto (fallback para match normalizado)
 * @returns {Array} Tarefas Level 5 com fase_nome, Disciplina, Status, datas
 */
export async function queryCurvaSProgressoTasks(smartsheetId, projectName = null) {
  const smartsheetProjectId = 'dadosindicadores';
  const smartsheetDataset = 'smartsheet';
  const smartsheetTable = 'smartsheet_data_projetos';

  const baseQuery = `
    WITH tasks_with_hierarchy AS (
      SELECT
        ID_Projeto,
        NomeDaPlanilha,
        NomeDaTarefa,
        Disciplina,
        Level,
        Status,
        DataDeInicio,
        DataDeTermino,
        DataDeInicioBaselineOtus,
        DataDeFimBaselineOtus,
        VarianciaBaselineOtus,
        rowNumber,
        Duracao,
        LAST_VALUE(IF(CAST(Level AS INT64) = 2, NomeDaTarefa, NULL) IGNORE NULLS)
          OVER (
            PARTITION BY ID_Projeto
            ORDER BY CAST(rowNumber AS INT64)
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
          ) AS fase_nome
      FROM \`${smartsheetProjectId}.${smartsheetDataset}.${smartsheetTable}\`
      WHERE {{WHERE_CLAUSE}}
        AND NomeDaPlanilha NOT LIKE '%(Backup%'
        AND NomeDaPlanilha NOT LIKE '%Cópia%'
        AND NomeDaPlanilha NOT LIKE '%OBSOLETO%'
        AND NomeDaPlanilha NOT LIKE '%Copy%'
    )
    SELECT
      ID_Projeto,
      NomeDaPlanilha,
      NomeDaTarefa,
      Disciplina,
      Status,
      DataDeInicio,
      DataDeTermino,
      DataDeInicioBaselineOtus,
      DataDeFimBaselineOtus,
      VarianciaBaselineOtus,
      rowNumber,
      Duracao,
      fase_nome
    FROM tasks_with_hierarchy
    WHERE CAST(Level AS INT64) = 5
      AND Disciplina IS NOT NULL
      AND TRIM(Disciplina) != ''
    ORDER BY CAST(rowNumber AS INT64)
  `;

  try {
    let rows = [];

    // Estratégia 1: Buscar por smartsheetId
    if (smartsheetId) {
      const escapedId = String(smartsheetId).replace(/'/g, "''");
      const query = baseQuery.replace('{{WHERE_CLAUSE}}', `ID_Projeto = '${escapedId}'`);
      rows = await executeQuery(query);
    }

    // Estratégia 2: Match normalizado pelo nome
    if (rows.length === 0 && projectName) {
      const escapedName = String(projectName).replace(/'/g, "''");
      const whereClause = `LOWER(REGEXP_REPLACE(
        REGEXP_REPLACE(NomeDaPlanilha, r'^\\(.*?\\)\\s*', ''),
        r'[^a-zA-Z0-9]', ''
      )) LIKE CONCAT('%', LOWER(REGEXP_REPLACE('${escapedName}', r'[^a-zA-Z0-9]', '')), '%')`;
      const query = baseQuery.replace('{{WHERE_CLAUSE}}', whereClause);
      rows = await executeQuery(query);
    }

    console.log(`✅ [queryCurvaSProgressoTasks] ${rows.length} tarefas Level 5 encontradas`);
    return rows;
  } catch (error) {
    console.error('❌ Erro ao buscar tarefas para Curva S:', error.message);
    throw new Error(`Erro ao buscar tarefas para Curva S: ${error.message}`);
  }
}

export async function queryCurvaSSnapshotTasks(smartsheetId, projectName = null) {
  const snapshotProject = 'dadosindicadores';
  const snapshotDataset = 'smartsheet_atrasos';
  const snapshotTable = 'smartsheet_snapshot';

  // Schema da tabela smartsheet_snapshot: só Level 5, sem rowNumber, sem fases
  // Estratégia: JOIN com smartsheet_data_projetos para obter fase_nome e rowNumber
  const currentTable = 'smartsheet.smartsheet_data_projetos';

  // Colunas opcionais de metadados de atraso (podem não existir em tabelas antigas)
  const optionalCols = `,
      snap.Categoria_de_atraso,
      snap.Motivo_de_atraso,
      snap.ObservacaoOtus`;

  const buildBaseQuery = (includeOptionalCols = true) => `
    WITH current_hierarchy AS (
      SELECT
        ID_Projeto,
        NomeDaTarefa,
        CAST(Level AS INT64) AS Level,
        CAST(rowNumber AS INT64) AS rowNumber,
        LAST_VALUE(IF(CAST(Level AS INT64) = 2, NomeDaTarefa, NULL) IGNORE NULLS)
          OVER (
            PARTITION BY ID_Projeto
            ORDER BY CAST(rowNumber AS INT64)
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
          ) AS fase_nome
      FROM \`${snapshotProject}.${currentTable}\`
      WHERE {{WHERE_CLAUSE_CURR}}
    ),
    unique_fases AS (
      SELECT ID_Projeto, NomeDaTarefa, MIN(rowNumber) AS rowNumber, ANY_VALUE(fase_nome) AS fase_nome
      FROM current_hierarchy
      WHERE Level = 5
      GROUP BY ID_Projeto, NomeDaTarefa
    )
    SELECT
      snap.ID_Projeto,
      snap.NomeDaPlanilha,
      snap.NomeDaTarefa,
      snap.Disciplina,
      snap.Status,
      snap.DataDeInicio,
      snap.DataDeTermino,
      snap.Duracao,
      COALESCE(cf.rowNumber, ROW_NUMBER() OVER (
        PARTITION BY snap.snapshot_date, snap.ID_Projeto
        ORDER BY snap.DataDeInicio, snap.NomeDaTarefa
      )) AS rowNumber,
      cf.fase_nome,
      snap.snapshot_date${includeOptionalCols ? optionalCols : ''}
    FROM \`${snapshotProject}.${snapshotDataset}.${snapshotTable}\` snap
    LEFT JOIN unique_fases cf
      ON snap.ID_Projeto = cf.ID_Projeto
      AND snap.NomeDaTarefa = cf.NomeDaTarefa
    WHERE {{WHERE_CLAUSE_SNAP}}
      AND snap.Level = 5
      AND snap.Disciplina IS NOT NULL
      AND TRIM(snap.Disciplina) != ''
      AND snap.NomeDaPlanilha NOT LIKE '%(Backup%'
      AND snap.NomeDaPlanilha NOT LIKE '%Cópia%'
      AND snap.NomeDaPlanilha NOT LIKE '%OBSOLETO%'
      AND snap.NomeDaPlanilha NOT LIKE '%Copy%'
    ORDER BY snap.snapshot_date, rowNumber
  `;

  async function runQuery(includeOptionalCols) {
    const baseQuery = buildBaseQuery(includeOptionalCols);
    let rows = [];

    if (smartsheetId) {
      const escapedId = String(smartsheetId).replace(/'/g, "''");
      const idClause = `ID_Projeto = '${escapedId}'`;
      const query = baseQuery
        .replace('{{WHERE_CLAUSE_CURR}}', idClause)
        .replace('{{WHERE_CLAUSE_SNAP}}', `snap.${idClause}`);
      rows = await executeQuery(query);
    }

    if (rows.length === 0 && projectName) {
      const escapedName = String(projectName).replace(/'/g, "''");
      const namePattern = `LOWER(REGEXP_REPLACE('${escapedName}', r'[^a-zA-Z0-9]', ''))`;
      const currClause = `LOWER(REGEXP_REPLACE(
        REGEXP_REPLACE(NomeDaPlanilha, r'^\\(.*?\\)\\s*', ''),
        r'[^a-zA-Z0-9]', ''
      )) LIKE CONCAT('%', ${namePattern}, '%')`;
      const snapClause = `LOWER(REGEXP_REPLACE(
        REGEXP_REPLACE(snap.NomeDaPlanilha, r'^\\(.*?\\)\\s*', ''),
        r'[^a-zA-Z0-9]', ''
      )) LIKE CONCAT('%', ${namePattern}, '%')`;
      const query = baseQuery
        .replace('{{WHERE_CLAUSE_CURR}}', currClause)
        .replace('{{WHERE_CLAUSE_SNAP}}', snapClause);
      rows = await executeQuery(query);
    }

    return rows;
  }

  try {
    let rows;
    try {
      rows = await runQuery(true);
    } catch (colError) {
      if (colError.message && colError.message.includes('not found')) {
        console.warn('⚠️ [queryCurvaSSnapshotTasks] Colunas opcionais ausentes, re-executando sem elas...');
        rows = await runQuery(false);
      } else {
        throw colError;
      }
    }

    // Agrupar por snapshot_date
    const snapshots = new Map();
    for (const row of rows) {
      const rawDate = row.snapshot_date;
      const dateVal = typeof rawDate === 'object' && rawDate !== null && rawDate.value != null
        ? String(rawDate.value) : rawDate ? String(rawDate) : null;
      const date = dateVal ? dateVal.split('T')[0] : null;
      if (!date) continue;
      if (!snapshots.has(date)) snapshots.set(date, []);
      snapshots.get(date).push(row);
    }

    console.log(`✅ [queryCurvaSSnapshotTasks] ${rows.length} tarefas em ${snapshots.size} snapshots`);
    return { rows, snapshots };
  } catch (error) {
    console.error('❌ Erro ao buscar snapshots para Curva S:', error.message);
    return { rows: [], snapshots: new Map() };
  }
}

/**
 * Busca snapshots de TODOS os projetos para análise consolidada do portfolio.
 * Retorna dados agrupados por projeto e snapshot_date.
 */
export async function queryCurvaSAllSnapshotTasks() {
  const snapshotProject = 'dadosindicadores';
  const snapshotDataset = 'smartsheet_atrasos';
  const snapshotTable = 'smartsheet_snapshot';

  const buildQuery = (includeOptionalCols = true) => {
    const optionalCols = includeOptionalCols ? `,
      snap.Categoria_de_atraso,
      snap.Motivo_de_atraso,
      snap.ObservacaoOtus` : '';
    return `
    SELECT
      snap.ID_Projeto,
      snap.NomeDaPlanilha,
      snap.NomeDaTarefa,
      snap.Disciplina,
      snap.Status,
      snap.DataDeInicio,
      snap.DataDeTermino,
      snap.Duracao,
      snap.snapshot_date${optionalCols}
    FROM \`${snapshotProject}.${snapshotDataset}.${snapshotTable}\` snap
    WHERE snap.Level = 5
      AND snap.Disciplina IS NOT NULL
      AND TRIM(snap.Disciplina) != ''
      AND snap.NomeDaPlanilha NOT LIKE '%(Backup%'
      AND snap.NomeDaPlanilha NOT LIKE '%Cópia%'
      AND snap.NomeDaPlanilha NOT LIKE '%OBSOLETO%'
      AND snap.NomeDaPlanilha NOT LIKE '%Copy%'
    ORDER BY snap.ID_Projeto, snap.snapshot_date, snap.NomeDaTarefa
  `;
  };

  try {
    let rows;
    try {
      rows = await executeQuery(buildQuery(true));
    } catch (colError) {
      if (colError.message && colError.message.includes('not found')) {
        console.warn('⚠️ [queryCurvaSAllSnapshotTasks] Colunas opcionais ausentes, re-executando sem elas...');
        rows = await executeQuery(buildQuery(false));
      } else {
        throw colError;
      }
    }

    // Agrupar: ID_Projeto → snapshot_date → tasks[]
    const projectSnapshots = new Map();
    for (const row of rows) {
      const projectId = row.ID_Projeto ? String(row.ID_Projeto) : null;
      if (!projectId) continue;

      const rawDate = row.snapshot_date;
      const dateVal = typeof rawDate === 'object' && rawDate !== null && rawDate.value != null
        ? String(rawDate.value) : rawDate ? String(rawDate) : null;
      const date = dateVal ? dateVal.split('T')[0] : null;
      if (!date) continue;

      if (!projectSnapshots.has(projectId)) projectSnapshots.set(projectId, new Map());
      const snapMap = projectSnapshots.get(projectId);
      if (!snapMap.has(date)) snapMap.set(date, []);
      snapMap.get(date).push(row);
    }

    console.log(`✅ [queryCurvaSAllSnapshotTasks] ${rows.length} tarefas em ${projectSnapshots.size} projetos`);
    return { rows, projectSnapshots };
  } catch (error) {
    console.error('❌ Erro ao buscar todos os snapshots:', error.message);
    return { rows: [], projectSnapshots: new Map() };
  }
}

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

/**
 * Pre-aquece caches de schema no startup do servidor.
 * Evita que a primeira request pague o custo de 2 queries extras ao BigQuery.
 */
// =========================================================================
// WEEKLY REPORTS - Funções para Relatórios Semanais
// =========================================================================

/**
 * Verifica se existem dados no BigQuery para gerar relatório semanal
 * @param {string|null} construflowId - ID do projeto no Construflow
 * @param {string|null} smartsheetId - ID da planilha no Smartsheet
 * @returns {Promise<Object>} resultado dos checks
 */
/**
 * Conta issues ativos do ConstruFlow agrupados por disciplina
 * @param {string} construflowId - ID do projeto no ConstruFlow
 * @returns {Promise<Object>} { "Arquitetura": 5, "Elétrica": 3, ... }
 */
export async function queryConstruflowIssuesByDiscipline(construflowId) {
  if (!construflowId) return {};

  const escapedId = String(construflowId).replace(/'/g, "''");
  const query = `
    SELECT d.name AS discipline_name, COUNT(*) as count
    FROM \`${projectId}.construflow_data.issues\` i
    JOIN \`${projectId}.construflow_data.issues_disciplines\` id_dis
      ON CAST(i.id AS STRING) = CAST(id_dis.issueId AS STRING)
    JOIN \`${projectId}.construflow_data.disciplines\` d
      ON CAST(id_dis.disciplineId AS STRING) = CAST(d.id AS STRING)
    WHERE CAST(i.projectId AS STRING) = '${escapedId}'
      AND i.status = 'active'
    GROUP BY d.name
  `;

  try {
    const rows = await executeQuery(query);
    const result = {};
    for (const row of rows || []) {
      if (row.discipline_name) {
        result[row.discipline_name] = Number(row.count) || 0;
      }
    }
    return result;
  } catch (err) {
    console.warn('⚠️ [queryConstruflowIssuesByDiscipline] Erro:', err.message);
    return {};
  }
}

export async function checkWeeklyReportReadiness(construflowId, smartsheetId) {
  const result = {
    construflow: { ready: false, count: 0 },
    smartsheet: { ready: false, count: 0 },
  };

  // Check Construflow issues
  if (construflowId) {
    try {
      const escapedId = String(construflowId).replace(/'/g, "''");
      const query = `
        SELECT COUNT(*) as total
        FROM \`${projectId}.construflow_data.issues\`
        WHERE CAST(projectId AS STRING) = '${escapedId}'
          AND status = 'active'
      `;
      const rows = await executeQuery(query);
      const count = rows?.[0]?.total || 0;
      result.construflow = { ready: count > 0, count };
    } catch (err) {
      console.warn(`⚠️ [checkWeeklyReportReadiness] Erro ao verificar Construflow:`, err.message);
    }
  }

  // Check Smartsheet tasks
  if (smartsheetId) {
    try {
      const escapedId = String(smartsheetId).replace(/'/g, "''");
      const query = `
        SELECT COUNT(*) as total
        FROM \`${projectId}.${datasetId}.smartsheet_data_projetos\`
        WHERE CAST(ID_Projeto AS STRING) = '${escapedId}'
      `;
      const rows = await executeQuery(query);
      const count = rows?.[0]?.total || 0;
      result.smartsheet = { ready: count > 0, count };
    } catch (err) {
      console.warn(`⚠️ [checkWeeklyReportReadiness] Erro ao verificar Smartsheet:`, err.message);
    }
  }

  return result;
}

/**
 * Busca dados do BigQuery para gerar relatório semanal
 * Combina issues do Construflow com tarefas do Smartsheet
 * @param {string} construflowId - ID do projeto no Construflow
 * @param {string} smartsheetId - ID da planilha no Smartsheet
 * @param {Object} options - Opções
 * @param {number} options.scheduleDays - Dias para cronograma futuro (default: 15)
 * @returns {Promise<Object>} dados brutos para processamento
 */
/**
 * Busca snapshots de baseline para um projeto, agrupando por rowNumber.
 * Retorna objeto { rowNumber: { dataBaseline, dataReprog } }
 * dataBaseline = data_termino do primeiro baseline (menor baseline_id = R00)
 * dataReprog   = data_termino do último baseline (maior baseline_id = mais recente)
 */
async function queryBaselineSnapshots(projectCode) {
  const escaped = String(projectCode).replace(/'/g, "''");
  const query = `
    WITH all_snapshots AS (
      SELECT
        row_number,
        nome_tarefa,
        data_termino,
        baseline_id,
        ROW_NUMBER() OVER (PARTITION BY row_number ORDER BY baseline_id ASC)  AS rn_first,
        ROW_NUMBER() OVER (PARTITION BY row_number ORDER BY baseline_id DESC) AS rn_last
      FROM \`dadosindicadores.smartsheet_atrasos.baseline_task_snapshots\`
      WHERE project_code = '${escaped}'
    ),
    first_snap AS (SELECT row_number, data_termino FROM all_snapshots WHERE rn_first = 1),
    last_snap  AS (SELECT row_number, data_termino FROM all_snapshots WHERE rn_last  = 1)
    SELECT
      f.row_number,
      f.data_termino AS data_baseline,
      l.data_termino AS data_reprog
    FROM first_snap f
    LEFT JOIN last_snap l ON f.row_number = l.row_number
  `;
  try {
    const rows = await executeQuery(query);
    const map = {};
    for (const row of rows) {
      map[row.row_number] = {
        dataBaseline: row.data_baseline,
        dataReprog: row.data_reprog,
      };
    }
    return map;
  } catch (err) {
    console.warn('[queryBaselineSnapshots] Erro ao buscar baselines (não bloqueante):', err.message);
    return {};
  }
}

export async function queryWeeklyReportData(construflowId, smartsheetId, options = {}) {
  const { scheduleDays = 15, projectCode } = options;

  let issues = [];
  let tasks = [];
  let disciplines = [];

  // 1. Busca issues do Construflow com disciplinas
  if (construflowId) {
    const escapedCfId = String(construflowId).replace(/'/g, "''");

    // Issues com status ativo e suas disciplinas
    const issueQuery = `
      SELECT
        i.id,
        i.code,
        i.title,
        i.status AS status_x,
        i.priority,
        i.deadline,
        i.createdAt,
        i.updatedAt,
        id_dis.disciplineId,
        d.name AS name,
        id_dis.status AS status_y
      FROM \`${projectId}.construflow_data.issues\` i
      LEFT JOIN \`${projectId}.construflow_data.issues_disciplines\` id_dis
        ON CAST(i.id AS STRING) = CAST(id_dis.issueId AS STRING)
      LEFT JOIN \`${projectId}.construflow_data.disciplines\` d
        ON CAST(id_dis.disciplineId AS STRING) = CAST(d.id AS STRING)
      WHERE CAST(i.projectId AS STRING) = '${escapedCfId}'
      ORDER BY i.createdAt DESC
      LIMIT 2000
    `;
    issues = await executeQuery(issueQuery);

    // Lista de disciplinas únicas
    const discQuery = `
      SELECT DISTINCT d.name AS name, id_dis.disciplineId AS id
      FROM \`${projectId}.construflow_data.issues_disciplines\` id_dis
      LEFT JOIN \`${projectId}.construflow_data.disciplines\` d
        ON CAST(id_dis.disciplineId AS STRING) = CAST(d.id AS STRING)
      WHERE CAST(id_dis.issueId AS STRING) IN (
        SELECT CAST(id AS STRING) FROM \`${projectId}.construflow_data.issues\`
        WHERE CAST(projectId AS STRING) = '${escapedCfId}'
      )
        AND d.name IS NOT NULL
      ORDER BY d.name
    `;
    disciplines = await executeQuery(discQuery);
  }

  // 2. Busca tarefas do Smartsheet
  if (smartsheetId) {
    const escapedSsId = String(smartsheetId).replace(/'/g, "''");

    const taskQuery = `
      SELECT
        NomeDaTarefa AS \`Nome da Tarefa\`,
        Status,
        Disciplina,
        DataDeInicio AS \`Data de Inicio\`,
        DataDeTermino AS \`Data Termino\`,
        Level,
        rowNumber,
        CaminhoCriticoMarco,
        ObservacaoOtus AS \`Observacao Otus\`,
        Motivo_de_atraso AS \`Motivo de atraso\`,
        Categoria_de_atraso AS \`Categoria de atraso\`
      FROM \`dadosindicadores.smartsheet.smartsheet_data_projetos\`
      WHERE CAST(ID_Projeto AS STRING) = '${escapedSsId}'
        AND Level = 5
      ORDER BY rowNumber
    `;
    tasks = await executeQuery(taskQuery);
  }

  // 3. Busca snapshots de baseline da plataforma (para exibição nos cards de atraso)
  const baselines = projectCode ? await queryBaselineSnapshots(projectCode) : {};

  return { issues, tasks, disciplines, baselines };
}

/**
 * Busca projetos ativos com relatório semanal habilitado
 * @param {string|null} leaderName - Filtrar por líder (null = todos)
 * @returns {Promise<Array>} projetos ativos
 */
export async function queryActiveProjectsForWeeklyReports(nomeTime = null) {
  let query = `
    SELECT
      project_code_norm AS project_code,
      lider,
      nome_time,
      construflow_id,
      smartsheet_id,
      relatorio_semanal_status
    FROM \`${projectId}.${datasetId}.${tablePortfolio}\`
    WHERE relatorio_semanal_status = 'ativo'
  `;

  if (nomeTime) {
    const escaped = nomeTime.replace(/'/g, "''");
    query += ` AND LOWER(nome_time) = LOWER('${escaped}')`;
  }

  query += ` ORDER BY project_code_norm`;

  return await executeQuery(query);
}

/**
 * Busca TODOS os projetos ativos (independente de relatorio_semanal_status)
 * @param {string|null} nomeTime - Filtrar por nome_time (null = todos)
 * @returns {Promise<Array>} projetos ativos
 */
export async function queryAllActiveProjects(nomeTime = null) {
  let query = `
    SELECT
      project_code_norm AS project_code,
      lider,
      nome_time,
      status,
      relatorio_semanal_status
    FROM \`${projectId}.${datasetId}.${tablePortfolio}\`
    WHERE LOWER(status) IN ('planejamento', 'fase 01', 'fase 02', 'fase 03', 'fase 04')
  `;

  if (nomeTime) {
    const escaped = nomeTime.replace(/'/g, "''");
    query += ` AND LOWER(nome_time) = LOWER('${escaped}')`;
  }

  query += ` ORDER BY project_code_norm`;

  return await executeQuery(query);
}

/**
 * Resolve o valor exato de nome_time no BigQuery a partir do team_name do Supabase.
 * Usa LIKE para lidar com diferenças de formato (ex: "Time André" vs "1 - Time André").
 * @param {string|null} teamName - Nome do time no Supabase
 * @returns {Promise<string|null>} valor exato de nome_time no BigQuery
 */
export async function queryNomeTimeByTeamName(teamName) {
  if (!teamName) return null;
  const escaped = teamName.replace(/'/g, "''");
  const query = `
    SELECT DISTINCT nome_time
    FROM \`${projectId}.${datasetId}.${tablePortfolio}\`
    WHERE LOWER(nome_time) LIKE CONCAT('%', LOWER('${escaped}'), '%')
    AND nome_time IS NOT NULL
    LIMIT 1
  `;
  const rows = await executeQuery(query);
  return rows.length > 0 ? rows[0].nome_time : null;
}

export async function warmupSchemaCache() {
  try {
    await getPortfolioColumns();
    await getEntradasSchema();
    console.log('✅ Schema cache pre-aquecido (portfolio + entradas)');
  } catch (e) {
    console.warn('⚠️ Falha ao pre-aquecer schema cache:', e.message);
  }
}

// Status que indicam tarefa concluída (espelho de WeightCalculationService.js)
const PHASE_COMPLETED_STATUSES_SQL = [
  'concluída', 'concluida', 'completa', 'complete', 'done',
  '100%', 'finalizado', 'finalizada', 'entregue', 'feito',
].map(s => `'${s}'`).join(', ');

/**
 * Busca durações por fase do projeto atual usando as linhas de fase (Level 2).
 * A duração executada é o span real da linha da fase (DataDeInicio → DataDeTermino),
 * independente do status das tarefas filhas.
 * @param {string} smartsheetId
 * @param {string} projectName
 * @returns {Array} [{ fase_nome, executado_dias, fase_inicio }]
 */
export async function queryCurrentPhaseDurations(smartsheetId, projectName = null) {
  const project = 'dadosindicadores';
  const ds = 'smartsheet';
  const tbl = 'smartsheet_data_projetos';

  const baseQuery = `
    SELECT
      NomeDaTarefa AS fase_nome,
      DATE_DIFF(
        MAX(PARSE_DATE('%Y-%m-%d', SUBSTR(CAST(DataDeTermino AS STRING),1,10))),
        MIN(PARSE_DATE('%Y-%m-%d', SUBSTR(CAST(DataDeInicio AS STRING),1,10))),
        DAY) AS executado_dias,
      MIN(PARSE_DATE('%Y-%m-%d', SUBSTR(CAST(DataDeInicio AS STRING),1,10))) AS fase_inicio
    FROM \`${project}.${ds}.${tbl}\`
    WHERE {{WHERE_CLAUSE}}
      AND CAST(Level AS INT64) = 2
      AND DataDeInicio IS NOT NULL
      AND DataDeTermino IS NOT NULL
      AND NomeDaPlanilha NOT LIKE '%(Backup%'
      AND NomeDaPlanilha NOT LIKE '%Cópia%'
      AND NomeDaPlanilha NOT LIKE '%OBSOLETO%'
      AND NomeDaPlanilha NOT LIKE '%Copy%'
    GROUP BY NomeDaTarefa
    ORDER BY fase_inicio ASC
  `;

  try {
    let rows = [];
    if (smartsheetId) {
      const esc = String(smartsheetId).replace(/'/g, "''");
      rows = await executeQuery(baseQuery.replace('{{WHERE_CLAUSE}}', `ID_Projeto = '${esc}'`));
    }
    if (rows.length === 0 && projectName) {
      const esc = String(projectName).replace(/'/g, "''");
      const where = `LOWER(REGEXP_REPLACE(REGEXP_REPLACE(NomeDaPlanilha,r'^\\(.*?\\)\\s*',''),r'[^a-zA-Z0-9]','')) LIKE CONCAT('%',LOWER(REGEXP_REPLACE('${esc}',r'[^a-zA-Z0-9]','')), '%')`;
      rows = await executeQuery(baseQuery.replace('{{WHERE_CLAUSE}}', where));
    }
    console.log(`✅ [queryCurrentPhaseDurations] ${rows.length} fases`);
    return rows;
  } catch (error) {
    console.error('❌ [queryCurrentPhaseDurations]', error.message);
    throw new Error(`Erro ao buscar durações por fase: ${error.message}`);
  }
}

/**
 * Busca durações por fase a partir dos snapshots de baselines.
 * @param {string} projectCode
 * @param {number[]} baselineIds
 * @returns {Array} [{ baseline_id, fase_nome, duracao_dias }]
 */
export async function queryBaselinePhaseDurations(projectCode, baselineIds) {
  if (!baselineIds || baselineIds.length === 0) return [];

  const project = 'dadosindicadores';
  const ds = 'smartsheet_atrasos';
  const tbl = 'baseline_task_snapshots';
  const esc = String(projectCode).replace(/'/g, "''");
  const ids = baselineIds.map(Number).join(', ');

  const query = `
    SELECT
      baseline_id,
      fase_nome,
      DATE_DIFF(
        MAX(PARSE_DATE('%Y-%m-%d', SUBSTR(CAST(data_termino AS STRING),1,10))),
        MIN(PARSE_DATE('%Y-%m-%d', SUBSTR(CAST(data_inicio AS STRING),1,10))),
        DAY) AS duracao_dias,
      MIN(PARSE_DATE('%Y-%m-%d', SUBSTR(CAST(data_inicio AS STRING),1,10))) AS fase_inicio
    FROM \`${project}.${ds}.${tbl}\`
    WHERE project_code = '${esc}'
      AND baseline_id IN (${ids})
      AND data_inicio IS NOT NULL
      AND data_termino IS NOT NULL
      AND fase_nome IS NOT NULL
    GROUP BY baseline_id, fase_nome
    ORDER BY baseline_id ASC, fase_inicio ASC
  `;

  try {
    const rows = await executeQuery(query);
    console.log(`✅ [queryBaselinePhaseDurations] ${rows.length} linhas`);
    return rows;
  } catch (error) {
    console.error('❌ [queryBaselinePhaseDurations]', error.message);
    throw new Error(`Erro ao buscar durações de baselines: ${error.message}`);
  }
}
