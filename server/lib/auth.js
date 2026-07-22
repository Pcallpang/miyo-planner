import crypto from 'node:crypto';

const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function secret() {
  return process.env.SESSION_SECRET || 'dev-secret';
}
function sign(payload) {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
}

export function makeSessionToken(userId, ttlMs = DEFAULT_TTL_MS) {
  const payload = Buffer.from(JSON.stringify({ userId, exp: Date.now() + ttlMs })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

/** 유효하면 { userId } 반환, 아니면 null */
export function verifySessionToken(token) {
  if (typeof token !== 'string') return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(payload));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const { userId, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
    if (typeof exp !== 'number' || exp <= Date.now() || !userId) return null;
    return { userId };
  } catch {
    return null;
  }
}

export function parseCookies(header) {
  const out = {};
  if (typeof header !== 'string') return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

/** 요청에서 인증된 userId를 얻는다(없으면 null) */
export function sessionUserId(req) {
  const session = verifySessionToken(parseCookies(req.headers.cookie).session);
  return session ? session.userId : null;
}
