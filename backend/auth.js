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
import { getSupabaseClient } from './supabase.js';
// Mantém auth-config.js como fallback para compatibilidade
import { hasAccess as hasAccessLegacy, getUserRole as getUserRoleLegacy, isPrivileged as isPrivilegedLegacy, getLeaderNameFromEmail } from './auth-config.js';

// Configuração do Google OAuth
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || 'https://app.otusengenharia.com/api/auth/google/callback';

/**
 * Busca usuário na tabela users_otus pelo email
 * @param {string} email - Email do usuário
 * @returns {Promise<Object|null>} - Dados do usuário ou null
 */
async function getUserFromDatabase(email) {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('users_otus')
      .select('id, name, email, role, status, team_id')
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
 * Verifica se usuário é privilegiado (admin ou leader)
 * @param {Object} user - Dados do usuário
 * @returns {boolean}
 */
function isPrivilegedFromDB(user) {
  if (!user || !user.role) return false;
  return ['director', 'admin', 'leader'].includes(user.role);
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

          // Verifica se é privilegiado (admin ou leader)
          if (!isPrivilegedFromDB(dbUser)) {
            return done(new Error('Acesso restrito. A plataforma está disponível apenas para líderes e admins.'), null);
          }

          // Retorna informações do usuário do banco
          const user = {
            id: dbUser.id,
            email: email,
            name: dbUser.name || profile.displayName || profile.name?.givenName || 'Usuário',
            picture: profile.photos?.[0]?.value || null,
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
