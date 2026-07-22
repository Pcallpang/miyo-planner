import { google } from 'googleapis';
import { encrypt, decrypt, deriveKey } from './crypto.js';
import { getUserTokens, saveUserTokens } from './db.js';
import { redirectUri } from './urls.js';

export function isGoogleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function createOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, redirectUri());
}

export const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'openid', 'email', 'profile',
];

function key() { return deriveKey(process.env.TOKEN_ENC_KEY || 'dev-key'); }

/** id_token(JWT)에서 sub/email/name 추출 */
export function profileFromIdToken(idToken) {
  try {
    const p = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64url').toString('utf-8'));
    return { sub: p.sub, email: p.email || null, name: p.name || null };
  } catch { return { sub: null, email: null, name: null }; }
}

/** 사용자 토큰 저장(refresh_token은 기존 값 보존). */
export async function saveTokensForUser(userId, tokens) {
  const existing = await getUserTokens(userId);
  const prev = existing ? JSON.parse(decrypt(existing.encTokens, key())) : {};
  const merged = { ...prev, ...tokens };
  await saveUserTokens(userId, encrypt(JSON.stringify(merged), key()), existing?.calendarId);
}

export async function hasTokensForUser(userId) {
  const t = await getUserTokens(userId);
  if (!t) return false;
  try { const c = JSON.parse(decrypt(t.encTokens, key())); return Boolean(c.refresh_token || c.access_token); }
  catch { return false; }
}

/** 해당 사용자 토큰이 설정된 OAuth 클라이언트. 갱신분 자동 저장. */
export async function getAuthedClient(userId) {
  const rec = await getUserTokens(userId);
  if (!rec) { const e = new Error('구글 계정이 연동되어 있지 않습니다.'); e.status = 401; throw e; }
  const credentials = JSON.parse(decrypt(rec.encTokens, key()));
  const client = createOAuthClient();
  client.setCredentials(credentials);
  client.on('tokens', (t) => {
    saveTokensForUser(userId, t).catch((e) => console.error('[google] 토큰 저장 실패:', e.message));
  });
  return client;
}

export async function getCalendarApi(userId) {
  return google.calendar({ version: 'v3', auth: await getAuthedClient(userId) });
}
