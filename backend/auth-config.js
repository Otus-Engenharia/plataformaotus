/**
 * Configuração de Usuários e Roles
 *
 * Define quais usuários têm acesso e seus respectivos roles:
 * - 'dev': Acesso total + permissões especiais de desenvolvedor (hardcoded)
 * - 'director': Acesso total a todos os projetos
 * - 'admin': Acesso total a todos os projetos
 * - 'leader': Acesso apenas aos projetos onde é líder
 * - 'user': Acesso básico (indicadores próprios)
 *
 * IMPORTANTE: Use o email do Google Account do usuário
 *
 * Hierarquia: dev > director > admin > leader > user
 */

export const USER_ROLES = {
  // DEV - Acesso total + permissões especiais (hardcoded, não gerenciável pela UI)
  'pedro.kupka@otusengenharia.com': 'dev',
  'felipe.simoni@otusengenharia.com': 'dev',

  // Acesso total (Diretora e equipe de gestão)
  'carla.bedin@otusengenharia.com': 'director',
  'arthur.oliveira@otusengenharia.com': 'director',
  'ana.reisdorfer@otusengenharia.com': 'admin',

  // Acesso de líder - apenas aos seus projetos
  'anna.bastos@otusengenharia.com': 'leader',
  'alicia.paim@otusengenharia.com': 'leader',
  'estevao.goulart@otusengenharia.com': 'leader',

  // Dev mode - usuários de teste (para verificação local)
  'dev-dev@otus.dev': 'dev',
  'dev-director@otus.dev': 'director',
  'dev-admin@otus.dev': 'admin',
  'dev-leader@otus.dev': 'leader',
  'dev-operacao@otus.dev': 'user',
};

/**
 * Mapeamento de emails para nomes na coluna 'lider' do BigQuery
 * 
 * A coluna 'lider' no BigQuery contém nomes, não emails.
 * Este mapeamento permite fazer a correspondência correta.
 */
export const EMAIL_TO_LEADER_NAME = {
  'estevao.goulart@otusengenharia.com': 'Estevao Goulart',
  'anna.bastos@otusengenharia.com': 'Anna Luiza Bastos',
  'alicia.paim@otusengenharia.com': 'Alicia Emanoele Paim',
  // Dev mode - usa dados da Anna Luiza Bastos para testes de filtragem de líder
  'dev-leader@otus.dev': 'Anna Luiza Bastos',
};

/**
 * Mapeamento de emails de dev para emails reais (para módulo de indicadores)
 * Usado para buscar setor/equipe de usuários reais durante testes
 */
export const DEV_EMAIL_TO_REAL_EMAIL = {
  'dev-leader@otus.dev': 'anna.bastos@otusengenharia.com',
  'dev-operacao@otus.dev': 'carla.bedin@otusengenharia.com',
};

/**
 * Obtém o email real para busca no módulo de indicadores
 * Se for dev user, retorna o email mapeado; senão retorna o próprio email
 * @param {string} email - Email do usuário
 * @returns {string} - Email real para busca
 */
export function getRealEmailForIndicadores(email) {
  if (!email) return null;
  const lowerEmail = email.toLowerCase();
  return DEV_EMAIL_TO_REAL_EMAIL[lowerEmail] || lowerEmail;
}

/**
 * Mapeamento líder → Ultimo_Time (port_clientes) para filtro NPS/CS.
 * Ajuste conforme os valores reais em port_clientes.Ultimo_Time.
 */
export const LEADER_TO_ULTIMO_TIME = {
  'Anna Luiza Bastos': 'TIME Anna',
  'Alicia Emanoele Paim': 'TIME Alicia',
  'Estevao Goulart': 'TIME Estevão',
};

export function getUltimoTimeForLeader(leaderName) {
  if (!leaderName) return null;
  return LEADER_TO_ULTIMO_TIME[leaderName] ?? leaderName;
}

/**
 * Obtém o nome do líder a partir do email
 * @param {string} email - Email do usuário
 * @returns {string|null} - Nome do líder no BigQuery ou null
 */
export function getLeaderNameFromEmail(email) {
  if (!email) return null;
  return EMAIL_TO_LEADER_NAME[email.toLowerCase()] || null;
}

/**
 * Verifica se um email tem acesso ao sistema
 * @param {string} email - Email do usuário
 * @returns {boolean} - true se o usuário tem acesso
 */
export function hasAccess(email) {
  return email && USER_ROLES.hasOwnProperty(email.toLowerCase());
}

/**
 * Obtém o role de um usuário
 * @param {string} email - Email do usuário
 * @returns {string|null} - 'director', 'admin', 'leader' ou null
 */
export function getUserRole(email) {
  if (!email) return null;
  return USER_ROLES[email.toLowerCase()] || null;
}

/**
 * Verifica se um usuário é dev (permissão máxima)
 * Devs têm bypass de todas as verificações de acesso
 * @param {string} email - Email do usuário
 * @returns {boolean}
 */
export function isDev(email) {
  return getUserRole(email) === 'dev';
}

/**
 * Verifica se um usuário é diretora
 * @param {string} email - Email do usuário
 * @returns {boolean}
 */
export function isDirector(email) {
  return getUserRole(email) === 'director';
}

/**
 * Verifica se um usuário é admin
 * @param {string} email - Email do usuário
 * @returns {boolean}
 */
export function isAdmin(email) {
  return getUserRole(email) === 'admin';
}

/**
 * Verifica se um usuário é dev, diretora, admin ou líder
 * @param {string} email - Email do usuário
 * @returns {boolean}
 */
export function isPrivileged(email) {
  const role = getUserRole(email);
  return role === 'dev' || role === 'director' || role === 'admin' || role === 'leader';
}

/**
 * Verifica se um usuário é líder
 * @param {string} email - Email do usuário
 * @returns {boolean}
 */
export function isLeader(email) {
  return getUserRole(email) === 'leader';
}

/**
 * Lista de emails do setor de vendas
 * TODO: Implementar controle de cadastros depois
 */
export const VENDAS_EMAILS = [
  // Adicione aqui os emails do setor de vendas
  // Exemplo: 'vendas@otusengenharia.com',
];

/**
 * Verifica se um usuário pertence ao setor de vendas
 * @param {string} email - Email do usuário
 * @returns {boolean}
 */
export function isVendas(email) {
  if (!email) return false;
  return VENDAS_EMAILS.includes(email.toLowerCase());
}

/**
 * Verifica se um usuário pode acessar o Formulário de Passagem
 * (Dev, Diretores, Admin, Líderes e Vendas)
 * @param {string} email - Email do usuário
 * @returns {boolean}
 */
export function canAccessFormularioPassagem(email) {
  return isPrivileged(email) || isVendas(email);
}

/**
 * Verifica se um usuário tem acesso administrativo total
 * (Dev, Director ou Admin)
 * @param {string} email - Email do usuário
 * @returns {boolean}
 */
export function hasFullAccess(email) {
  const role = getUserRole(email);
  return role === 'dev' || role === 'director' || role === 'admin';
}

/**
 * Setores que podem gerenciar demandas (editar status, prioridade, etc.)
 */
const DEMANDAS_MANAGER_SECTORS = ['Tecnologia'];

/**
 * Verifica se um usuário pode gerenciar demandas
 * (Privilegiados ou membros do setor Tecnologia)
 * @param {Object} user - Objeto do usuário com email e setor_name
 * @returns {boolean}
 */
export function canManageDemandas(user) {
  if (!user) return false;
  if (isPrivileged(user.email)) return true;
  if (user.setor_name && DEMANDAS_MANAGER_SECTORS.includes(user.setor_name)) return true;
  return false;
}

/**
 * Setores que podem gerenciar solicitacoes de estudo de custos
 */
const ESTUDOS_CUSTOS_MANAGER_SECTORS = ['CS'];

/**
 * Verifica se um usuario pode gerenciar solicitacoes de estudo de custos
 * (Privilegiados ou membros do setor CS)
 * @param {Object} user - Objeto do usuario com email e setor_name
 * @returns {boolean}
 */
export function canManageEstudosCustos(user) {
  if (!user) return false;
  if (isPrivileged(user.email)) return true;
  if (user.setor_name && ESTUDOS_CUSTOS_MANAGER_SECTORS.includes(user.setor_name)) return true;
  return false;
}
