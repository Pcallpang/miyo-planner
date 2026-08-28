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
  // 기능 요청 완료 표시(관리자 전용). 기존 테이블에도 안전하게 추가.
  await pool.query('ALTER TABLE feature_requests ADD COLUMN IF NOT EXISTS completed boolean NOT NULL DEFAULT false');
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

/** 모든 사용자가 함께 보는 기능 요청 게시판 — 투표수 내림차순(동률은 오래된 순). */
export async function listFeatureRequests(userId) {
  const { rows } = await pool.query(
    `SELECT fr.id, fr.text,
            fr.created_at AS "createdAt",
            fr.completed,
            COUNT(v.user_id)::int AS votes,
            COALESCE(BOOL_OR(v.user_id = $1), false) AS voted,
            (fr.user_id = $1) AS "isMine"
       FROM feature_requests fr
       LEFT JOIN feature_request_votes v ON v.request_id = fr.id
      GROUP BY fr.id
      ORDER BY votes DESC, fr.created_at ASC`,
    [userId],
  );
  return rows;
}

export async function createFeatureRequest(userId, text) {
  const { rows } = await pool.query(
    `INSERT INTO feature_requests (user_id, text) VALUES ($1,$2)
     RETURNING id, text, created_at AS "createdAt", completed`,
    [userId, text],
  );
  return rows[0];
}

/** 작성자 본인일 때만 삭제한다. 삭제된 행 수(0이면 권한 없음/이미 삭제됨). */
export async function deleteFeatureRequest(id, userId) {
  const { rowCount } = await pool.query(
    'DELETE FROM feature_requests WHERE id=$1 AND user_id=$2', [id, userId],
  );
  return rowCount;
}

/** 관리자 전용 — 작성자와 무관하게 삭제한다. */
export async function deleteFeatureRequestAsAdmin(id) {
  const { rowCount } = await pool.query('DELETE FROM feature_requests WHERE id=$1', [id]);
  return rowCount;
}

/** 관리자 전용 — 완료 표시를 켜고/끈다. */
export async function setFeatureRequestCompleted(id, completed) {
  const { rowCount } = await pool.query(
    'UPDATE feature_requests SET completed=$2 WHERE id=$1', [id, completed],
  );
  return rowCount;
}

export async function voteFeatureRequest(requestId, userId) {
  await pool.query(
    `INSERT INTO feature_request_votes (request_id, user_id) VALUES ($1,$2)
     ON CONFLICT (request_id, user_id) DO NOTHING`,
    [requestId, userId],
  );
}

export async function unvoteFeatureRequest(requestId, userId) {
  await pool.query(
    'DELETE FROM feature_request_votes WHERE request_id=$1 AND user_id=$2',
    [requestId, userId],
  );
}
