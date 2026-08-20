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

/**
 * 저장된 토큰을 복호화한다. TOKEN_ENC_KEY가 바뀌어 읽을 수 없으면 null.
 * (토큰을 못 읽는 것과 토큰이 없는 것은 실질적으로 같은 상황이다 — 다시 연동하면 된다)
 */
function readTokens(record) {
  if (!record) return null;
  try {
    return JSON.parse(decrypt(record.encTokens, key()));
  } catch {
    return null;
  }
}

/** 사용자 토큰 저장(refresh_token은 기존 값 보존). */
export async function saveTokensForUser(userId, tokens) {
  const existing = await getUserTokens(userId);
  // 예전 TOKEN_ENC_KEY로 암호화돼 못 읽는 값이면 보존을 포기하고 새 토큰으로 갈아끼운다.
  // 여기서 예외를 던지면 새로 로그인하는 것조차 막혀 계정이 영영 잠긴다.
  const prev = readTokens(existing) ?? {};
  const merged = { ...prev, ...tokens };
  await saveUserTokens(userId, encrypt(JSON.stringify(merged), key()), existing?.calendarId);
}

export async function hasTokensForUser(userId) {
  const c = readTokens(await getUserTokens(userId));
  return Boolean(c?.refresh_token || c?.access_token);
}

/** 해당 사용자 토큰이 설정된 OAuth 클라이언트. 갱신분 자동 저장. */
export async function getAuthedClient(userId) {
  const credentials = readTokens(await getUserTokens(userId));
  // 토큰이 없거나 예전 키로 암호화돼 읽을 수 없으면 둘 다 '다시 연동해야 함'이다
  if (!credentials) { const e = new Error('구글 계정이 연동되어 있지 않습니다. 다시 연동해 주세요.'); e.status = 401; throw e; }
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
