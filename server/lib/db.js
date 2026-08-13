import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
  // 서버리스에서는 함수 인스턴스가 여럿 뜨고 각자 풀을 갖는다. 인스턴스당 1개로
  // 묶어야 Supabase 커넥션 한도를 넘기지 않는다. DATABASE_URL은 Transaction
  // pooler(6543)를 쓴다 — node-pg는 prepared statement를 기본으로 쓰지 않아 호환된다.
  max: 1,
});

export async function initDb() {
  const schema = fs.readFileSync(path.resolve(__dirname, '../db/schema.sql'), 'utf-8');
  await pool.query(schema);
  // 사용자별 Gemini API 키 저장용 컬럼(암호화). 기존 테이블에도 안전하게 추가.
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS gemini_key_enc text');
}

export async function upsertUser({ googleSub, email, name }) {
  const { rows } = await pool.query(
    `INSERT INTO users (google_sub, email, name) VALUES ($1,$2,$3)
     ON CONFLICT (google_sub) DO UPDATE SET email=EXCLUDED.email, name=EXCLUDED.name
     RETURNING id, email, name`,
    [googleSub, email, name],
  );
  return rows[0];
}

export async function saveUserTokens(userId, encTokens, calendarId) {
  await pool.query(
    `INSERT INTO google_tokens (user_id, enc_tokens, calendar_id, updated_at)
     VALUES ($1,$2,COALESCE($3,'primary'),now())
     ON CONFLICT (user_id) DO UPDATE SET enc_tokens=EXCLUDED.enc_tokens,
       calendar_id=COALESCE($3, google_tokens.calendar_id), updated_at=now()`,
    [userId, encTokens, calendarId ?? null],
  );
}

export async function getUserTokens(userId) {
  const { rows } = await pool.query(
    'SELECT enc_tokens, calendar_id FROM google_tokens WHERE user_id=$1', [userId]);
  return rows[0] ? { encTokens: rows[0].enc_tokens, calendarId: rows[0].calendar_id } : null;
}

export async function deleteUserTokens(userId) {
  await pool.query('DELETE FROM google_tokens WHERE user_id=$1', [userId]);
}

export async function getUserById(userId) {
  const { rows } = await pool.query('SELECT id, email, name FROM users WHERE id=$1', [userId]);
  return rows[0] || null;
}

export async function saveUserGeminiKey(userId, encKey) {
  await pool.query('UPDATE users SET gemini_key_enc=$2 WHERE id=$1', [userId, encKey]);
}

export async function getUserGeminiKeyEnc(userId) {
  const { rows } = await pool.query('SELECT gemini_key_enc FROM users WHERE id=$1', [userId]);
  return rows[0]?.gemini_key_enc || null;
}

export async function deleteUserGeminiKey(userId) {
  await pool.query('UPDATE users SET gemini_key_enc=NULL WHERE id=$1', [userId]);
}

export async function getAppState(userId) {
  const { rows } = await pool.query('SELECT state FROM app_state WHERE user_id=$1', [userId]);
  return rows[0] ? rows[0].state : null;
}

export async function saveAppState(userId, state) {
  await pool.query(
    `INSERT INTO app_state (user_id, state, updated_at) VALUES ($1,$2,now())
     ON CONFLICT (user_id) DO UPDATE SET state=EXCLUDED.state, updated_at=now()`,
    [userId, state],
  );
}
