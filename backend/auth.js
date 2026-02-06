/**
 * Configuração de Autenticação Google OAuth
 *
 * Usa Passport.js com estratégia Google OAuth 2.0
 * Roles são buscados da tabela users_otus no Supabase
 */

// Carrega variáveis de ambiente antes de usar
import dotenv from 'dotenv';
dotenv.config();

import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { getSupabaseClient, updateUserAvatar } from './supabase.js';
// Mantém auth-config.js como fallback para compatibilidade
import { hasAccess as hasAccessLegacy, getUserRole as getUserRoleLegacy, isPrivileged as isPrivilegedLegacy, getLeaderNameFromEmail } from './auth-config.js';

// Configuração do Google OAuth
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || 'https://app.otusengenharia.com/api/auth/google/callback';

/**
 * Busca usuário na tabela users_otus pelo email (com dados do setor)
 * @param {string} email - Email do usuário
 * @returns {Promise<Object|null>} - Dados do usuário ou null
 */
async function getUserFromDatabase(email) {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('users_otus')
      .select(`
        id, name, email, role, status, team_id, setor_id,
        setor:setor_id(id, name, has_platform_access)
      `)
      .eq('email', email.toLowerCase())
      .single();

    if (error || !data) {
      return null;
    }

    return data;
  } catch (err) {
    console.error('Erro ao buscar usuário no banco:', err);
    return null;
  }
}

/**
 * Verifica se usuário tem acesso (existe na tabela e está ativo)
 * @param {string} email - Email do usuário
 * @returns {Promise<boolean>}
 */
async function hasAccessFromDB(email) {
  const user = await getUserFromDatabase(email);
  return user !== null && user.status === 'ativo';
}

/**
 * Verifica se usuário é privilegiado (dev, director, admin ou leader)
 * @param {Object} user - Dados do usuário
 * @returns {boolean}
 */
function isPrivilegedFromDB(user) {
  if (!user || !user.role) return false;
  return ['dev', 'director', 'admin', 'leader'].includes(user.role);
}

/**
 * Verifica se usuário tem acesso à plataforma baseado no setor
 * - Admins, directors e leaders sempre têm acesso
 * - Usuários comuns precisam que o setor tenha has_platform_access = true
 * @param {Object} user - Dados do usuário (com setor)
 * @returns {{ hasAccess: boolean, reason?: string }}
 */
function checkSectorAccess(user) {
  if (!user) return { hasAccess: false, reason: 'Usuário não encontrado' };

  // Admins, directors e leaders sempre têm acesso
  if (['dev', 'director', 'admin', 'leader'].includes(user.role)) {
    return { hasAccess: true };
  }

  // Usuários comuns precisam que o setor tenha acesso liberado
  if (!user.setor) {
    return { hasAccess: false, reason: 'Usuário não está vinculado a um setor' };
  }

  if (!user.setor.has_platform_access) {
    return {
      hasAccess: false,
      reason: `O setor ${user.setor.name} ainda não tem acesso à plataforma. Em breve será liberado!`
    };
  }

  return { hasAccess: true };
}

/**
 * Configura a estratégia Google OAuth do Passport
 * Só configura se as credenciais estiverem disponíveis
 */
if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: GOOGLE_CALLBACK_URL,
      },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;

        if (!email) {
          return done(new Error('Email não encontrado no perfil do Google'), null);
        }

        // Primeiro tenta buscar no banco de dados (users_otus)
        const dbUser = await getUserFromDatabase(email);

        if (dbUser) {
          // Usuário encontrado no banco
          if (dbUser.status !== 'ativo') {
            return done(new Error('Usuário desativado. Entre em contato com o administrador.'), null);
          }

          // Verifica acesso baseado no setor (líderes/admins sempre passam)
          const sectorAccess = checkSectorAccess(dbUser);
          if (!sectorAccess.hasAccess) {
            return done(new Error(sectorAccess.reason), null);
          }

          // Atualiza avatar do Google no banco (não bloqueia o login se falhar)
          const pictureUrl = profile.photos?.[0]?.value || null;
          if (pictureUrl) {
            updateUserAvatar(dbUser.id, pictureUrl).catch(err => {
              console.warn('Não foi possível atualizar avatar:', err.message);
            });
          }

          // Retorna informações do usuário do banco
          const user = {
            id: dbUser.id,
            email: email,
            name: dbUser.name || profile.displayName || profile.name?.givenName || 'Usuário',
            picture: pictureUrl,
            role: dbUser.role,
            team_id: dbUser.team_id,
          };

          return done(null, user);
        }

        // Fallback: verifica no auth-config.js (para compatibilidade)
        if (!hasAccessLegacy(email)) {
          return done(new Error('Acesso negado. Entre em contato com o administrador.'), null);
        }

        if (!isPrivilegedLegacy(email)) {
          return done(new Error('Acesso restrito. A plataforma está disponível apenas para líderes, admins e diretores.'), null);
        }

        // Retorna informações do usuário do auth-config
        const user = {
          id: profile.id,
          email: email,
          name: profile.displayName || profile.name?.givenName || 'Usuário',
          picture: profile.photos?.[0]?.value || null,
          role: getUserRoleLegacy(email),
        };

        return done(null, user);
      } catch (error) {
        console.error('Erro na autenticação:', error);
        return done(error, null);
      }
    }
  )
  );
} else {
  console.warn('⚠️ Google OAuth não configurado. Adicione GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no arquivo .env');
  console.warn('⚠️ A autenticação não funcionará até que as credenciais sejam configuradas.');
}

/**
 * Serializa o usuário para a sessão
 */
passport.serializeUser((user, done) => {
  done(null, user);
});

/**
 * Deserializa o usuário da sessão
 */
passport.deserializeUser((user, done) => {
  done(null, user);
});

export default passport;
