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

export async function createProcurementRequest(userId, header, items) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO procurement_requests (user_id, title, purpose, budget_item, requester, total_amount)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, created_at`,
      [userId, header.title, header.purpose || null, header.budgetItem || null, header.requester || null, header.totalAmount],
    );
    const requestId = rows[0].id;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      await client.query(
        `INSERT INTO procurement_items (request_id, name, spec, unit, qty, unit_price, amount, vendor, source_url, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [requestId, it.name, it.spec || null, it.unit || '개', it.qty, it.unitPrice, it.amount, it.vendor || null, it.sourceUrl || null, i],
      );
    }
    await client.query('COMMIT');
    return { id: requestId, createdAt: rows[0].created_at };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function getProcurementHistory(userId) {
  const { rows } = await pool.query(
    `SELECT id, title, purpose, budget_item, requester, total_amount, created_at
     FROM procurement_requests WHERE user_id=$1 ORDER BY created_at DESC`,
    [userId],
  );
  return rows;
}

export async function getProcurementRequestById(id, userId) {
  const { rows } = await pool.query(
    `SELECT id, title, purpose, budget_item, requester, total_amount, created_at
     FROM procurement_requests WHERE id=$1 AND user_id=$2`,
    [id, userId],
  );
  const request = rows[0];
  if (!request) return null;
  const { rows: items } = await pool.query(
    `SELECT name, spec, unit, qty, unit_price, amount, vendor, source_url
     FROM procurement_items WHERE request_id=$1 ORDER BY sort_order`,
    [id],
  );
  return { ...request, items };
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
