/**
 * Gmail API Integration
 *
 * Cria rascunhos no Gmail usando tokens OAuth armazenados.
 * Refresh automático de tokens via googleapis client.
 */
import { google } from 'googleapis';
import { getUserOAuthTokens, storeUserOAuthTokens } from './supabase.js';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL ||
  'https://app.otusengenharia.com/api/auth/google/callback';

/**
 * Cria um OAuth2 client autenticado para um usuário
 * @param {string} userId - ID do users_otus
 * @returns {Promise<OAuth2Client>}
 */
async function getAuthenticatedClient(userId) {
  const tokens = await getUserOAuthTokens(userId);
  if (!tokens) {
    throw new Error('GMAIL_NOT_AUTHORIZED');
  }

  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_CALLBACK_URL
  );

  oauth2Client.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
  });

  // Persiste tokens novos quando o googleapis faz refresh automaticamente
  oauth2Client.on('tokens', async (newTokens) => {
    try {
      await storeUserOAuthTokens(userId, {
        accessToken: newTokens.access_token,
        refreshToken: newTokens.refresh_token || tokens.refresh_token,
        scopes: tokens.scopes,
      });
    } catch (err) {
      console.error('Falha ao persistir tokens renovados:', err.message);
    }
  });

  return oauth2Client;
}

/**
 * Cria um rascunho no Gmail do usuário
 * @param {string} userId - ID do users_otus
 * @param {Object} params - { to, subject, body }
 * @param {string[]} params.to - Array de emails destinatários
 * @param {string} params.subject - Assunto do email
 * @param {string} params.body - Corpo do email (texto simples)
 * @returns {Promise<{draftId: string, messageId: string}>}
 */
export async function createGmailDraft(userId, { to, subject, body }) {
  const auth = await getAuthenticatedClient(userId);
  const gmail = google.gmail({ version: 'v1', auth });

  // Monta mensagem RFC 2822
  const toHeader = Array.isArray(to) ? to.join(', ') : to;
  const emailLines = [
    `To: ${toHeader}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
    '',
    body,
  ];
  const rawEmail = emailLines.join('\r\n');

  // Base64url encode
  const encodedMessage = Buffer.from(rawEmail)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const response = await gmail.users.drafts.create({
    userId: 'me',
    requestBody: {
      message: {
        raw: encodedMessage,
      },
    },
  });

  return {
    draftId: response.data.id,
    messageId: response.data.message?.id,
  };
}
