/**
 * Configuração de Usuários e Roles
 *
 * Hierarquia: dev > ceo > director > admin > leader > user
 *
 * FONTE PRIMÁRIA: tabela users_otus no Supabase (gerenciada pela UI de admin)
 * FALLBACK: USER_ROLES abaixo (apenas devs hardcoded e usuários de teste)
 *
 * Todas as funções deste arquivo aceitam tanto um email (string) quanto
 * um user object (com .role e .email) — o user object tem prioridade.
 */

export const USER_ROLES = {
  // Dev mode - usuários de teste (para verificação local apenas)
  // Todos os usuários reais são gerenciados pela tabela users_otus no Supabase
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
  return LEADER_TO_ULTIMO_TIME[leaderName] ?? null;
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
 * Verifica se um usuário tem acesso ao sistema
 * @param {string|Object} emailOrUser - Email ou user object (com .role)
 * @returns {boolean}
 */
export function hasAccess(emailOrUser) {
  if (!emailOrUser) return false;
  if (typeof emailOrUser === 'object') {
    return !!emailOrUser.role;
  }
  return USER_ROLES.hasOwnProperty(emailOrUser.toLowerCase());
}

/**
 * Obtém o role de um usuário
 * @param {string|Object} emailOrUser - Email ou user object (com .role)
 * @returns {string|null}
 */
export function getUserRole(emailOrUser) {
  if (!emailOrUser) return null;
  // User object (do banco, via Passport) — fonte primária
  if (typeof emailOrUser === 'object' && emailOrUser.role) {
    return emailOrUser.role;
  }
  // Fallback: email string → hardcoded USER_ROLES
  const email = typeof emailOrUser === 'string' ? emailOrUser.toLowerCase() : null;
  if (!email) return null;
  return USER_ROLES[email] || null;
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
  return role === 'dev' || role === 'ceo' || role === 'director' || role === 'admin' || role === 'leader';
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
 * @param {string|Object} emailOrUser - Email ou user object
 * @returns {boolean}
 */
export function canAccessFormularioPassagem(emailOrUser) {
  const email = typeof emailOrUser === 'object' ? emailOrUser?.email : emailOrUser;
  return isPrivileged(emailOrUser) || isVendas(email);
}

/**
 * Verifica se um usuário pode acessar a área de Vendas
 * (Dev, Diretores, Admin, Líderes e Vendas)
 * @param {string|Object} emailOrUser - Email ou user object
 * @returns {boolean}
 */
export function canAccessVendas(emailOrUser) {
  const email = typeof emailOrUser === 'object' ? emailOrUser?.email : emailOrUser;
  return isPrivileged(emailOrUser) || isVendas(email);
}

/**
 * Verifica se um usuário tem acesso administrativo total
 * (Dev, Director ou Admin)
 * @param {string} email - Email do usuário
 * @returns {boolean}
 */
export function hasFullAccess(email) {
  const role = getUserRole(email);
  return role === 'dev' || role === 'ceo' || role === 'director' || role === 'admin';
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
  if (isPrivileged(user)) return true;
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
  if (isPrivileged(user)) return true;
  if (user.setor_name && ESTUDOS_CUSTOS_MANAGER_SECTORS.includes(user.setor_name)) return true;
  return false;
}

/**
 * Setores que podem gerenciar o Apoio de Projetos (editar ACD, IFC, Controle)
 */
const APOIO_PROJETOS_MANAGER_SECTORS = ['Tecnologia'];

/**
 * Verifica se um usuario pode gerenciar dados do Apoio de Projetos
 * (Privilegiados ou membros do setor Tecnologia)
 * @param {Object} user - Objeto do usuario com email e setor_name
 * @returns {boolean}
 */
export function canManageApoioProjetos(user) {
  if (!user) return false;
  if (isPrivileged(user)) return true;
  if (user.setor_name && APOIO_PROJETOS_MANAGER_SECTORS.includes(user.setor_name)) return true;
  return false;
}
