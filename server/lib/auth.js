import crypto from 'node:crypto';

const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30일

/** 비밀번호 게이트가 켜져 있는지(APP_PASSWORD 설정 여부). */
export function authEnabled() {
  return Boolean(process.env.APP_PASSWORD);
}

function secret() {
  return process.env.SESSION_SECRET || process.env.APP_PASSWORD || 'dev-secret';
}

function sign(payload) {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
}

/** 서명된 세션 토큰을 만든다(형식: base64url(payload).base64url(sig)). */
export function makeSessionToken(ttlMs = DEFAULT_TTL_MS) {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + ttlMs })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

/** 세션 토큰의 서명·만료를 검증한다. */
export function verifySessionToken(token) {
  if (typeof token !== 'string') return false;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
    return typeof exp === 'number' && exp > Date.now();
  } catch {
    return false;
  }
}

/** 입력 비밀번호가 APP_PASSWORD와 일치하는지(타이밍 안전 비교). */
export function checkPassword(input) {
  const pw = process.env.APP_PASSWORD || '';
  if (!pw) return false;
  const a = Buffer.from(String(input));
  const b = Buffer.from(pw);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Cookie 헤더 문자열을 { name: value } 로 파싱한다. */
export function parseCookies(header) {
  const out = {};
  if (typeof header !== 'string') return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

/** 요청이 인증되었는지(게이트가 꺼져 있으면 항상 true). */
export function isAuthed(req) {
  if (!authEnabled()) return true;
  return verifySessionToken(parseCookies(req.headers.cookie).session);
}
