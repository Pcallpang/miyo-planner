import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decrypt, deriveKey, encrypt } from './crypto.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../data');
const TOKEN_FILE = path.join(DATA_DIR, 'tokens.json');
const KEY_FILE = path.join(DATA_DIR, '.enckey');

/**
 * 암호화 키를 얻는다. TOKEN_ENC_KEY가 있으면 그것을, 없으면 data/.enckey에
 * 자동 생성해 둔 로컬 비밀을 사용한다(설정 없이도 저장을 암호화하기 위함).
 */
function getKey() {
  if (process.env.TOKEN_ENC_KEY) return deriveKey(process.env.TOKEN_ENC_KEY);
  try {
    return deriveKey(fs.readFileSync(KEY_FILE, 'utf-8'));
  } catch {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const secret = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(KEY_FILE, secret, { mode: 0o600 });
    return deriveKey(secret);
  }
}

export function loadStore() {
  let raw;
  try {
    raw = fs.readFileSync(TOKEN_FILE, 'utf-8').trim();
  } catch {
    return null;
  }
  if (!raw) return null;
  // 레거시(평문 JSON) 저장본 호환 — 다음 저장 때 자동으로 암호화된다.
  if (raw.startsWith('{')) {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  try {
    return JSON.parse(decrypt(raw, getKey()));
  } catch {
    return null;
  }
}

export function saveStore(store) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(TOKEN_FILE, encrypt(JSON.stringify(store), getKey()), 'utf-8');
}

export function updateTokens(partialTokens) {
  const store = loadStore() || {};
  store.tokens = { ...(store.tokens || {}), ...partialTokens };
  saveStore(store);
}

export function clearStore() {
  try {
    fs.rmSync(TOKEN_FILE);
  } catch {
    /* 이미 없으면 무시 */
  }
}
