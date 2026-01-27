/**
 * Configuração de Autenticação Google OAuth
 * 
 * Usa Passport.js com estratégia Google OAuth 2.0
 */

// Carrega variáveis de ambiente antes de usar
import dotenv from 'dotenv';
dotenv.config();

import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { hasAccess, getUserRole } from './auth-config.js';

// Configuração do Google OAuth
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || 'https://app.otusengenharia.com/api/auth/google/callback';

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

        // Verifica se o usuário tem acesso
        if (!hasAccess(email)) {
          return done(new Error('Acesso negado. Entre em contato com o administrador.'), null);
        }

        // Retorna informações do usuário
        const user = {
          id: profile.id,
          email: email,
          name: profile.displayName || profile.name?.givenName || 'Usuário',
          picture: profile.photos?.[0]?.value || null,
          role: getUserRole(email),
        };

        return done(null, user);
      } catch (error) {
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
