import { google } from 'googleapis';
import { loadStore, saveStore, updateTokens, clearStore } from './tokenStore.js';
import { redirectUri } from './urls.js';

export function isGoogleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function hasTokens() {
  const store = loadStore();
  return Boolean(
    store?.tokens?.refresh_token || store?.tokens?.access_token || process.env.GOOGLE_REFRESH_TOKEN,
  );
}

export function getSavedEmail() {
  return loadStore()?.email || null;
}

export function createOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri(),
  );
}

export const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'openid',
  'email',
];

/** id_token(JWT)에서 이메일 추출 */
export function emailFromIdToken(idToken) {
  try {
    const payload = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64url').toString('utf-8'));
    return payload.email || null;
  } catch {
    return null;
  }
}

export function saveTokens(tokens) {
  const store = loadStore() || {};
  const email = tokens.id_token ? emailFromIdToken(tokens.id_token) : store.email;
  // refresh_token은 최초 동의 때만 내려오므로 기존 값을 보존한다.
  saveStore({ email, tokens: { ...(store.tokens || {}), ...tokens } });
}

export function disconnect() {
  clearStore();
}

/** 저장된 토큰이 설정된 OAuth 클라이언트. 갱신된 토큰은 자동 저장. */
export function getAuthedClient() {
  const store = loadStore();
  // 저장된 토큰이 없으면, 환경변수의 refresh_token으로 폴백(임시 디스크 호스트 대응).
  const credentials =
    store?.tokens ||
    (process.env.GOOGLE_REFRESH_TOKEN ? { refresh_token: process.env.GOOGLE_REFRESH_TOKEN } : null);
  if (!credentials) {
    const err = new Error('구글 계정이 연동되어 있지 않습니다.');
    err.status = 401;
    throw err;
  }
  const client = createOAuthClient();
  client.setCredentials(credentials);
  client.on('tokens', (t) => updateTokens(t));
  return client;
}

export function getCalendarApi() {
  return google.calendar({ version: 'v3', auth: getAuthedClient() });
}
