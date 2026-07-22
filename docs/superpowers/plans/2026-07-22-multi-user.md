# 미요 플래너 다중 사용자 전환 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 단일 사용자 미요 플래너를, 한 배포 주소에서 여러 사용자가 구글 로그인으로 각자 캘린더·데이터를 쓰는 다중 사용자 앱으로 전환한다.

**Architecture:** 구글 OAuth를 신원+캘린더 권한으로 동시 사용. 세션 쿠키에 서명된 userId를 담아 사용자를 식별. 사용자별 구글 토큰·앱 데이터(To-Do·시간표·메모·설정)를 Supabase Postgres에 저장. 클라이언트는 localStorage 대신 `/api/data`로 서버 상태를 동기화.

**Tech Stack:** Node/Express(ESM), `pg`(node-postgres), `googleapis`, React+Vite+TS, Supabase Postgres, node:test / vitest.

## Global Constraints

- 서버는 ESM(`"type":"module"`). import 경로에 `.js` 확장자 필수.
- 토큰·시크릿은 절대 코드 하드코딩 금지. 환경변수(`.env`, Render env)만.
- 토큰은 저장 시 반드시 `server/lib/crypto.js`의 `encrypt`로 암호화.
- 세션 서명 비밀키는 `SESSION_SECRET` 환경변수(필수). `APP_PASSWORD`는 완전히 제거.
- 서버 테스트: `node --test server/lib/*.test.js`. 클라 테스트: `npm run test -w client`(vitest).
- DB 스키마 이름: 테이블 `users`, `google_tokens`, `app_state` (설계 문서와 동일).
- 커밋 메시지 말미: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

## File Structure

**서버 — 신규**
- `server/lib/appState.js` — 앱 상태 기본값·병합 순수 로직
- `server/lib/db.js` — pg.Pool + 사용자/토큰/앱상태 CRUD
- `server/db/schema.sql` — CREATE TABLE IF NOT EXISTS
- `server/routes/data.js` — `/api/data` GET/PUT

**서버 — 수정**
- `server/lib/auth.js` — 세션 토큰에 userId 포함
- `server/lib/google.js` — 사용자별 토큰(DB 기반)으로 전면 교체
- `server/routes/auth.js` — 구글 로그인이 user upsert + 세션 생성
- `server/routes/calendar.js` — `req.userId` 기반
- `server/routes/gemini.js` — requireAuth 유지(사용자 무관)
- `server/index.js` — DB 초기화, requireAuth가 req.userId 설정, /api/status에 user, APP_PASSWORD·정적서빙 유지, 세션 로그인/로그아웃 제거(구글 로그인으로 대체)

**서버 — 삭제**
- `server/lib/tokenStore.js` 및 `tokenStore.test.js`(파일 기반 토큰 제거)

**클라이언트 — 신규**
- `client/src/context/DataContext.tsx` — 서버 연동 앱 데이터 상태
- `client/src/lib/appData.ts` — AppData 타입·기본값·localStorage 이관 헬퍼

**클라이언트 — 수정**
- `client/src/lib/api.ts` — `getData`/`putData`, status의 user
- `client/src/types.ts` — ServerStatus에 user, AppData 타입
- `client/src/components/LoginScreen.tsx` — 비번 입력 → "Google로 로그인" 버튼
- `client/src/context/AppContext.tsx` — settings를 DataContext에서
- 각 뷰/카드(`DashboardView`,`TimetableView`,`MemoView`,`SettingsView`,`MonthlyView` 등) — `useLocalStorage` → DataContext 사용

---

## Task 1: 앱 상태 순수 로직 (appState.js)

**Files:**
- Create: `server/lib/appState.js`
- Test: `server/lib/appState.test.js`

**Interfaces:**
- Produces: `defaultAppState(): {todos:[],meetings:[],memos:[],timetable:{},settings:{...}}`, `mergeAppState(existing, patch): merged` (얕은 키 병합, patch의 키만 덮어씀; null/undefined patch면 existing 반환)

- [ ] **Step 1: 실패 테스트 작성** — `server/lib/appState.test.js`

```javascript
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defaultAppState, mergeAppState } from './appState.js';

test('defaultAppState는 5개 키를 가진다', () => {
  const s = defaultAppState();
  assert.deepEqual(Object.keys(s).sort(), ['meetings','memos','settings','timetable','todos']);
  assert.deepEqual(s.todos, []);
  assert.equal(s.settings.periodCount, 7);
});

test('mergeAppState는 patch의 키만 덮어쓴다', () => {
  const base = defaultAppState();
  const merged = mergeAppState(base, { todos: [{ id: '1' }] });
  assert.equal(merged.todos.length, 1);
  assert.equal(merged.memos, base.memos); // 안 건드린 키는 유지
});

test('mergeAppState는 빈 patch에 기존을 그대로 반환', () => {
  const base = defaultAppState();
  assert.equal(mergeAppState(base, null), base);
  assert.deepEqual(mergeAppState(base, {}), base);
});
```

- [ ] **Step 2: 실패 확인** — Run: `node --test server/lib/appState.test.js` → FAIL (모듈 없음)

- [ ] **Step 3: 구현** — `server/lib/appState.js`

```javascript
const DEFAULT_SETTINGS = {
  periodCount: 7,
  periodTimes: [
    { start: '09:00', end: '09:50' }, { start: '10:00', end: '10:50' },
    { start: '11:00', end: '11:50' }, { start: '12:00', end: '12:50' },
    { start: '13:50', end: '14:40' }, { start: '14:50', end: '15:40' },
    { start: '15:50', end: '16:40' },
  ],
  weekStartsOn: 0,
  calendarId: 'primary',
  reminderMinutes: 10,
};

export function defaultAppState() {
  return { todos: [], meetings: [], memos: [], timetable: {}, settings: { ...DEFAULT_SETTINGS } };
}

const KEYS = ['todos', 'meetings', 'memos', 'timetable', 'settings'];

export function mergeAppState(existing, patch) {
  if (!patch || typeof patch !== 'object' || Object.keys(patch).length === 0) return existing;
  const out = { ...existing };
  for (const k of KEYS) if (k in patch) out[k] = patch[k];
  return out;
}
```

- [ ] **Step 4: 통과 확인** — Run: `node --test server/lib/appState.test.js` → PASS

- [ ] **Step 5: 커밋**

```bash
git add server/lib/appState.js server/lib/appState.test.js
git commit -m "feat: app_state 기본값·병합 순수 로직"
```

---

## Task 2: 세션 토큰에 userId 포함 (auth.js 확장)

**Files:**
- Modify: `server/lib/auth.js`
- Test: `server/lib/auth.test.js` (교체)

**Interfaces:**
- Produces: `makeSessionToken(userId, ttlMs?)`, `verifySessionToken(token) → { userId } | null` (기존 boolean에서 변경), `parseCookies(header)`, `sessionUserId(req) → userId | null`
- 제거: `authEnabled`, `checkPassword`, `isAuthed`(비번 게이트 관련)

- [ ] **Step 1: 테스트 교체** — `server/lib/auth.test.js` 전체를 아래로 교체

```javascript
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeSessionToken, verifySessionToken, parseCookies } from './auth.js';

process.env.SESSION_SECRET = 'test-session-secret';

test('userId를 담은 토큰을 검증하면 userId가 나온다', () => {
  const tok = makeSessionToken('user-123');
  assert.deepEqual(verifySessionToken(tok), { userId: 'user-123' });
});

test('변조 토큰은 null', () => {
  const tok = makeSessionToken('u1');
  assert.equal(verifySessionToken(tok.slice(0, -3) + 'zzz'), null);
});

test('만료 토큰은 null', () => {
  assert.equal(verifySessionToken(makeSessionToken('u1', -1000)), null);
});

test('형식오류/빈 토큰은 null', () => {
  assert.equal(verifySessionToken(''), null);
  assert.equal(verifySessionToken('nodot'), null);
});

test('쿠키 파싱', () => {
  assert.deepEqual(parseCookies('session=abc; x=1'), { session: 'abc', x: '1' });
});
```

- [ ] **Step 2: 실패 확인** — Run: `node --test server/lib/auth.test.js` → FAIL

- [ ] **Step 3: 구현** — `server/lib/auth.js` 전체 교체

```javascript
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
```

- [ ] **Step 4: 통과 확인** — Run: `node --test server/lib/auth.test.js` → PASS

- [ ] **Step 5: 커밋**

```bash
git add server/lib/auth.js server/lib/auth.test.js
git commit -m "feat: 세션 토큰에 userId 포함, 비번 게이트 제거"
```

---

## Task 3: DB 계층 (db.js + schema.sql)

**Files:**
- Create: `server/db/schema.sql`, `server/lib/db.js`
- Modify: `server/package.json` (dependency `pg` 추가)

**Interfaces:**
- Produces (모두 async):
  - `initDb()` — 스키마 실행(부팅 시 1회)
  - `upsertUser({ googleSub, email, name }) → { id, email, name }`
  - `saveUserTokens(userId, encTokens, calendarId?)` / `getUserTokens(userId) → { encTokens, calendarId } | null` / `deleteUserTokens(userId)`
  - `getAppState(userId) → object | null` / `saveAppState(userId, stateObject)`
  - `pool` (pg.Pool) — 종료용

- [ ] **Step 1: `pg` 설치**

Run: `npm install pg@^8 -w server`
Expected: server/package.json dependencies에 `pg` 추가됨.

- [ ] **Step 2: 스키마 작성** — `server/db/schema.sql`

```sql
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  google_sub text UNIQUE NOT NULL,
  email text,
  name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS google_tokens (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  enc_tokens text NOT NULL,
  calendar_id text NOT NULL DEFAULT 'primary',
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS app_state (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

- [ ] **Step 3: 구현** — `server/lib/db.js`

```javascript
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
});

export async function initDb() {
  const schema = fs.readFileSync(path.resolve(__dirname, '../db/schema.sql'), 'utf-8');
  await pool.query(schema);
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
```

- [ ] **Step 4: 통합 스모크 테스트** — `DATABASE_URL`(Supabase 연결문자열)을 `.env`에 넣은 뒤:

Run:
```bash
node -e "import('dotenv').then(d=>d.config({path:'.env'})).then(async()=>{const db=await import('./server/lib/db.js');await db.initDb();const u=await db.upsertUser({googleSub:'test-sub',email:'a@b.com',name:'T'});console.log('user',u.id);await db.saveAppState(u.id,{todos:[{id:'1'}]});console.log('state',await db.getAppState(u.id));await db.pool.query('DELETE FROM users WHERE google_sub=$1',['test-sub']);await db.pool.end();console.log('OK');})"
```
Expected: `user <uuid>` / `state { todos: [ { id: '1' } ] }` / `OK` 출력, 에러 없음.

- [ ] **Step 5: 커밋**

```bash
git add server/db/schema.sql server/lib/db.js server/package.json package-lock.json
git commit -m "feat: Supabase Postgres DB 계층(users/google_tokens/app_state)"
```

---

## Task 4: 사용자별 구글 클라이언트 (google.js 재작성, tokenStore 제거)

**Files:**
- Modify: `server/lib/google.js` (전면 교체)
- Delete: `server/lib/tokenStore.js`, `server/lib/tokenStore.test.js`

**Interfaces:**
- Consumes: db.js의 `getUserTokens`,`saveUserTokens`; crypto.js의 `encrypt`,`decrypt`,`deriveKey`
- Produces: `isGoogleConfigured()`, `createOAuthClient()`, `SCOPES`, `profileFromIdToken(idToken)→{sub,email,name}`, `saveTokensForUser(userId, tokens)`, `getAuthedClient(userId)`, `getCalendarApi(userId)`, `hasTokensForUser(userId)`

- [ ] **Step 1: tokenStore 삭제**

```bash
git rm server/lib/tokenStore.js server/lib/tokenStore.test.js
```

- [ ] **Step 2: google.js 재작성** — `server/lib/google.js` 전체 교체

```javascript
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
  client.on('tokens', (t) => { void saveTokensForUser(userId, t); });
  return client;
}

export async function getCalendarApi(userId) {
  return google.calendar({ version: 'v3', auth: await getAuthedClient(userId) });
}
```

- [ ] **Step 3: 통과 확인(구문/구성)** — Run: `node --check server/lib/google.js` → 에러 없음. 기존 서버 테스트: `node --test server/lib/crypto.test.js server/lib/auth.test.js server/lib/appState.test.js server/lib/geminiErrors.test.js` → 전부 PASS.

- [ ] **Step 4: 커밋**

```bash
git add server/lib/google.js
git commit -m "feat: 사용자별 구글 토큰(DB) 기반 클라이언트, 파일 tokenStore 제거"
```

---

## Task 5: 인증 라우트·index.js (구글 로그인=세션 생성)

**Files:**
- Modify: `server/routes/auth.js`, `server/index.js`

**Interfaces:**
- Consumes: google.js(`createOAuthClient`,`SCOPES`,`profileFromIdToken`,`saveTokensForUser`,`isGoogleConfigured`,`hasTokensForUser`), db.js(`upsertUser`,`deleteUserTokens`), auth.js(`makeSessionToken`,`sessionUserId`), urls.js(`clientUrl`,`isSecureOrigin`)
- Produces: `requireAuth` 미들웨어(index.js에서 `req.userId` 설정), 라우트 `GET /api/auth/url`, `GET /api/auth/google/callback`, `POST /api/auth/logout`, `POST /api/auth/disconnect`

- [ ] **Step 1: routes/auth.js 재작성**

```javascript
import { Router } from 'express';
import {
  isGoogleConfigured, createOAuthClient, SCOPES, profileFromIdToken, saveTokensForUser,
} from '../lib/google.js';
import { upsertUser, deleteUserTokens } from '../lib/db.js';
import { makeSessionToken, sessionUserId } from '../lib/auth.js';
import { clientUrl, isSecureOrigin } from '../lib/urls.js';

const router = Router();

function setSessionCookie(res, userId) {
  const parts = [`session=${makeSessionToken(userId)}`, 'HttpOnly', 'Path=/', 'SameSite=Lax',
    `Max-Age=${30 * 24 * 60 * 60}`];
  if (isSecureOrigin()) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

router.get('/url', (req, res) => {
  if (!isGoogleConfigured()) return res.status(503).json({ error: '구글 OAuth 키가 설정되지 않았습니다.' });
  const url = createOAuthClient().generateAuthUrl({
    access_type: 'offline', prompt: 'consent', scope: SCOPES,
  });
  res.json({ url });
});

router.get('/google/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error || !code) return res.redirect(`${clientUrl()}/?auth=error`);
  try {
    const { tokens } = await createOAuthClient().getToken(String(code));
    const { sub, email, name } = profileFromIdToken(tokens.id_token);
    if (!sub) throw new Error('id_token 없음');
    const user = await upsertUser({ googleSub: sub, email, name });
    await saveTokensForUser(user.id, tokens);
    setSessionCookie(res, user.id);
    res.redirect(`${clientUrl()}/?auth=success`);
  } catch (e) {
    console.error('[auth] 로그인 실패:', e.message);
    res.redirect(`${clientUrl()}/?auth=error`);
  }
});

router.post('/logout', (req, res) => {
  res.setHeader('Set-Cookie', 'session=; HttpOnly; Path=/; Max-Age=0');
  res.json({ ok: true });
});

router.post('/disconnect', async (req, res) => {
  const userId = sessionUserId(req);
  if (userId) await deleteUserTokens(userId);
  res.setHeader('Set-Cookie', 'session=; HttpOnly; Path=/; Max-Age=0');
  res.json({ ok: true });
});

export default router;
```

- [ ] **Step 2: index.js 재작성** — `server/index.js` 전체 교체

```javascript
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express from 'express';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { initDb, getAppState } = await import('./lib/db.js');
const { isGoogleConfigured, hasTokensForUser } = await import('./lib/google.js');
const { sessionUserId } = await import('./lib/auth.js');
const { default: authRouter } = await import('./routes/auth.js');
const { default: calendarRouter } = await import('./routes/calendar.js');
const { default: geminiRouter } = await import('./routes/gemini.js');
const { default: dataRouter } = await import('./routes/data.js');

await initDb();

const app = express();
app.use(express.json({ limit: '1mb' }));

function requireAuth(req, res, next) {
  const userId = sessionUserId(req);
  if (!userId) return res.status(401).json({ error: '로그인이 필요합니다.' });
  req.userId = userId;
  next();
}

app.get('/api/status', async (req, res) => {
  const userId = sessionUserId(req);
  res.json({
    googleConfigured: isGoogleConfigured(),
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    authenticated: Boolean(userId),
    connected: userId ? await hasTokensForUser(userId) : false,
  });
});

app.use('/api/auth', authRouter);            // /url, /callback은 공개; 나머지 라우트는 내부에서 처리
app.use('/api/calendar', requireAuth, calendarRouter);
app.use('/api/gemini', requireAuth, geminiRouter);
app.use('/api/data', requireAuth, dataRouter);

app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: '서버 오류가 발생했습니다.' }); });

const DIST = path.resolve(__dirname, '../client/dist');
const INDEX_HTML = path.join(DIST, 'index.html');
if (fs.existsSync(INDEX_HTML)) {
  app.use(express.static(DIST));
  app.get(/^(?!\/api).*/, (req, res) => res.sendFile(INDEX_HTML));
}

const port = Number(process.env.PORT) || 3001;
app.listen(port, '0.0.0.0', () => console.log(`[server] 포트 ${port} 실행 중 (0.0.0.0)`));
```

참고: `/api/status`에 user email/name이 필요하면 후속으로 추가 가능하나, 최소 구현은 authenticated/connected로 충분.

- [ ] **Step 3: 확인** — Run: `node --check server/index.js server/routes/auth.js` → 에러 없음.

- [ ] **Step 4: 커밋**

```bash
git add server/index.js server/routes/auth.js
git commit -m "feat: 구글 로그인=세션 생성, requireAuth로 userId 주입"
```

---

## Task 6: calendar 라우트 사용자별 전환

**Files:**
- Modify: `server/routes/calendar.js`

**Interfaces:**
- Consumes: `req.userId`(requireAuth), google.js `getCalendarApi(userId)`
- Produces: 기존 엔드포인트 동일하나 내부에서 `await getCalendarApi(req.userId)` 사용

- [ ] **Step 1: import·호출부 수정** — `server/routes/calendar.js`에서:
  - import를 `import { getCalendarApi } from '../lib/google.js';` 유지.
  - 각 핸들러의 `const api = getCalendarApi();` → `const api = await getCalendarApi(req.userId);` (5곳: calendars, events GET, events POST, events PATCH, events DELETE).

- [ ] **Step 2: 확인** — Run: `node --check server/routes/calendar.js` → 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add server/routes/calendar.js
git commit -m "feat: calendar 라우트를 로그인 사용자 토큰 기준으로"
```

---

## Task 7: /api/data 라우트

**Files:**
- Create: `server/routes/data.js`

**Interfaces:**
- Consumes: `req.userId`, db.js(`getAppState`,`saveAppState`), appState.js(`defaultAppState`,`mergeAppState`)
- Produces: `GET /api/data → { state }`, `PUT /api/data { state } → { ok:true }`

- [ ] **Step 1: 구현** — `server/routes/data.js`

```javascript
import { Router } from 'express';
import { getAppState, saveAppState } from '../lib/db.js';
import { defaultAppState, mergeAppState } from '../lib/appState.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const stored = await getAppState(req.userId);
    res.json({ state: mergeAppState(defaultAppState(), stored) });
  } catch (e) { console.error('[data]', e.message); res.status(503).json({ error: '데이터를 불러오지 못했습니다.' }); }
});

router.put('/', async (req, res) => {
  const patch = req.body?.state;
  if (!patch || typeof patch !== 'object') return res.status(400).json({ error: '잘못된 요청입니다.' });
  try {
    const current = mergeAppState(defaultAppState(), await getAppState(req.userId));
    await saveAppState(req.userId, mergeAppState(current, patch));
    res.json({ ok: true });
  } catch (e) { console.error('[data]', e.message); res.status(503).json({ error: '저장하지 못했습니다.' }); }
});

export default router;
```

- [ ] **Step 2: 확인** — Run: `node --check server/routes/data.js` → 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add server/routes/data.js
git commit -m "feat: /api/data 사용자별 앱 상태 GET/PUT"
```

---

## Task 8: 클라이언트 API·타입

**Files:**
- Modify: `client/src/lib/api.ts`, `client/src/types.ts`
- Create: `client/src/lib/appData.ts`

**Interfaces:**
- Produces: `api.getData()→{state:AppData}`, `api.putData(patch:Partial<AppData>)→{ok:true}`; `AppData` 타입; `defaultAppData()`, `collectLocalStorage()`(이관용)

- [ ] **Step 1: types.ts에 AppData·ServerStatus 수정**

`ServerStatus`에서 `authRequired` 제거, `authenticated` 유지. 파일 하단에 추가:

```typescript
export interface AppData {
  todos: Todo[];
  meetings: Meeting[];
  memos: MemoNote[];
  timetable: Timetable;
  settings: Settings;
}
```

(`ServerStatus`는 `{ googleConfigured, geminiConfigured, authenticated, connected }`로 정리.)

- [ ] **Step 2: appData.ts 작성** — `client/src/lib/appData.ts`

```typescript
import { defaultSettings } from './storage';
import type { AppData } from '../types';

export function defaultAppData(): AppData {
  return { todos: [], meetings: [], memos: [], timetable: {}, settings: defaultSettings() };
}

/** 기존 localStorage 데이터를 모아 이관용 AppData로 만든다(없으면 null). */
export function collectLocalStorage(): Partial<AppData> | null {
  const read = <T>(k: string): T | undefined => {
    try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : undefined; } catch { return undefined; }
  };
  const todos = read('haru.todos'); const meetings = read('haru.meetings');
  const memos = read('haru.memos'); const timetable = read('haru.timetable');
  const settings = read('haru.settings');
  const out: Partial<AppData> = {};
  if (todos) out.todos = todos as AppData['todos'];
  if (meetings) out.meetings = meetings as AppData['meetings'];
  if (memos) out.memos = memos as AppData['memos'];
  if (timetable) out.timetable = timetable as AppData['timetable'];
  if (settings) out.settings = settings as AppData['settings'];
  return Object.keys(out).length ? out : null;
}
```

- [ ] **Step 3: api.ts에 getData/putData 추가** — `export const api` 안에 추가:

```typescript
  getData: () => request<{ state: import('../types').AppData }>('/api/data'),
  putData: (state: Partial<import('../types').AppData>) =>
    request<{ ok: true }>('/api/data', { method: 'PUT', body: JSON.stringify({ state }) }),
```

`sessionLogin`/`sessionLogout`은 제거(구글 로그인으로 대체). `logout`은 `/api/auth/logout` 유지.

- [ ] **Step 4: 확인** — Run: `npm run build -w client` (tsc 통과 여부만; DataContext 미완이면 임시로 컴파일 안 될 수 있어 이 단계는 타입 파일만 확인). 최소 `node --check`는 불가하므로 Task 10 이후 통합 빌드로 검증.

- [ ] **Step 5: 커밋**

```bash
git add client/src/lib/api.ts client/src/types.ts client/src/lib/appData.ts
git commit -m "feat: 클라 데이터 API·AppData 타입·localStorage 이관 헬퍼"
```

---

## Task 9: DataContext (서버 연동 상태)

**Files:**
- Create: `client/src/context/DataContext.tsx`

**Interfaces:**
- Consumes: api(`getData`,`putData`), appData(`defaultAppData`,`collectLocalStorage`)
- Produces: `useData() → { data:AppData, loading, update(patch:Partial<AppData>) }`. `update`는 즉시 로컬 상태 반영 + 디바운스(800ms) 서버 PUT.

- [ ] **Step 1: 구현** — `client/src/context/DataContext.tsx`

```tsx
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import { defaultAppData, collectLocalStorage } from '../lib/appData';
import { useApp } from './AppContext';
import type { AppData } from '../types';

interface DataValue { data: AppData; loading: boolean; update: (patch: Partial<AppData>) => void; }
const Ctx = createContext<DataValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const { status } = useApp();
  const [data, setData] = useState<AppData>(defaultAppData);
  const [loading, setLoading] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<Partial<AppData>>({});

  useEffect(() => {
    if (!status?.authenticated) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { state } = await api.getData();
        // 첫 로그인 이관: 서버가 기본값(빈 todos 등)이고 로컬에 데이터가 있으면 올림
        const local = collectLocalStorage();
        const serverEmpty = state.todos.length === 0 && state.memos.length === 0 &&
          Object.keys(state.timetable).length === 0 && state.meetings.length === 0;
        if (local && serverEmpty) {
          const migrated = { ...state, ...local };
          if (!cancelled) setData(migrated);
          await api.putData(local);
        } else if (!cancelled) {
          setData(state);
        }
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [status?.authenticated]);

  function update(patch: Partial<AppData>) {
    setData((prev) => ({ ...prev, ...patch }));
    pending.current = { ...pending.current, ...patch };
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const toSend = pending.current; pending.current = {};
      void api.putData(toSend);
    }, 800);
  }

  return <Ctx.Provider value={{ data, loading, update }}>{children}</Ctx.Provider>;
}

export function useData() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useData는 DataProvider 안에서만');
  return c;
}
```

- [ ] **Step 2: main.tsx에 DataProvider 추가** — `<AppProvider>` 안, `<App/>` 바깥을 `<DataProvider>`로 감싼다.

```tsx
<AppProvider>
  <DataProvider>
    <App />
  </DataProvider>
</AppProvider>
```

- [ ] **Step 3: 커밋**

```bash
git add client/src/context/DataContext.tsx client/src/main.tsx
git commit -m "feat: DataContext 서버 연동 상태(이관·디바운스 저장)"
```

---

## Task 10: 로그인 화면·뷰 배선 (localStorage → DataContext)

**Files:**
- Modify: `client/src/components/LoginScreen.tsx`, `client/src/App.tsx`, `client/src/context/AppContext.tsx`, `client/src/views/DashboardView.tsx`, `client/src/views/TimetableView.tsx`, `client/src/views/MemoView.tsx`, `client/src/views/SettingsView.tsx`, `client/src/components/dashboard/LiveStatusCard.tsx`, `client/src/components/Header.tsx`

**Interfaces:**
- Consumes: `useData()`
- Produces: 앱 데이터가 서버 상태로 흐름. settings는 AppContext가 useData에서 읽음.

- [ ] **Step 1: LoginScreen을 구글 버튼으로 교체** — 비밀번호 폼 제거, `connectGoogle`(AppContext) 호출 버튼:

```tsx
import { LogIn, Sun } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function LoginScreen() {
  const { connectGoogle } = useApp();
  return (
    <div className="grid min-h-screen place-items-center bg-[#f5f8f7] p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-100">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-2xl bg-mint-100 text-mint-600"><Sun size={20} /></span>
          <span className="text-lg font-bold text-mint-700">미요 플래너</span>
        </div>
        <p className="mb-5 text-sm text-slate-500">구글 계정으로 로그인해 시작하세요.</p>
        <button onClick={() => void connectGoogle()}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-mint-500 py-2.5 text-sm font-semibold text-white transition hover:bg-mint-600">
          <LogIn size={16} /> Google로 로그인
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: App.tsx 게이트 조건 변경** — `status?.authRequired && !status.authenticated` → `status && !status.authenticated`:

```tsx
if (status && !status.authenticated) return <LoginScreen />;
```

- [ ] **Step 3: AppContext settings를 useData로** — `useLocalStorage`/`normalizeSettings` 기반 settings 제거하고, settings와 setSettings를 useData의 data.settings/update로 대체. (AppContext는 DataProvider 바깥이므로, settings 접근이 필요한 부분은 useData를 쓰도록 이동하거나, DataProvider를 AppProvider 바깥으로 재배치.) **재배치 지침:** main.tsx에서 `<DataProvider>`를 `<AppProvider>` **바깥**에 두고, DataContext는 status를 별도 `api.status()` 호출로 자체 확인하도록 변경. → 순환 의존 방지.

  실제 변경: DataContext가 useApp 대신 자체적으로 `api.status()`를 호출해 authenticated를 판단(useEffect 내). main.tsx 순서: `<DataProvider><AppProvider><App/></AppProvider></DataProvider>`. AppContext는 `useData()`로 settings를 읽어 사용.

- [ ] **Step 4: 각 뷰의 useLocalStorage 교체**
  - `DashboardView`: `useLocalStorage(todos)`,`(meetings)` → `const { data, update } = useData();` `data.todos`/`data.meetings`, setter는 `update({ todos: ... })`.
  - `TimetableView`: timetable/settings → useData.
  - `MemoView`: memos → useData.
  - `SettingsView`: settings → useData(update).
  - `LiveStatusCard`,`Header`: `loadFromStorage(timetable)` → `useData().data.timetable`.
  - `TodoCard`,`MeetingsCard`는 props로 배열+setter를 받으므로, 부모(DashboardView)에서 `data.todos`와 `(next)=>update({todos:next})` 형태 setter를 만들어 전달.

- [ ] **Step 5: 통합 빌드** — Run: `npm run build -w client`
Expected: tsc + vite build PASS. (타입 오류 남으면 해당 파일 수정 후 재빌드.)

- [ ] **Step 6: 클라 테스트** — Run: `npm run test -w client`
Expected: 기존 23개 PASS(순수 로직 테스트는 영향 없음).

- [ ] **Step 7: 커밋**

```bash
git add client/src
git commit -m "feat: 로그인=구글 버튼, 앱 데이터를 DataContext(서버)로 전환"
```

---

## Task 11: 배포 설정·문서

**Files:**
- Modify: `render.yaml`, `.env.example`, `DEPLOY.md`, `README.md`

**Interfaces:** 없음(구성/문서)

- [ ] **Step 1: render.yaml envVars 수정** — `APP_PASSWORD`,`GOOGLE_REFRESH_TOKEN` 제거, 추가:

```yaml
      - key: DATABASE_URL
        sync: false
      - key: TOKEN_ENC_KEY
        generateValue: true
```

- [ ] **Step 2: .env.example 갱신** — `APP_PASSWORD`,`GOOGLE_REFRESH_TOKEN` 관련 줄 제거, 추가:

```dotenv
# Supabase 연결 문자열(프로젝트 → Settings → Database → Connection string)
DATABASE_URL=
# 토큰 암호화 키(길고 랜덤). 배포 시 반드시 고정.
TOKEN_ENC_KEY=
```

- [ ] **Step 3: DEPLOY.md에 Supabase 섹션 추가** — Supabase 프로젝트에서 연결 문자열 복사 → Render `DATABASE_URL`에 입력, `TOKEN_ENC_KEY` 설정, `APP_PASSWORD` 삭제 안내. 구글 로그인으로 바뀐 점 명시.

- [ ] **Step 4: README 사용법 갱신** — "비밀번호 로그인" → "구글 로그인", 데이터가 서버(Supabase)에 사용자별 저장됨 명시.

- [ ] **Step 5: 커밋**

```bash
git add render.yaml .env.example DEPLOY.md README.md
git commit -m "docs: 다중 사용자 배포 설정(Supabase DATABASE_URL, 구글 로그인)"
```

---

## Task 12: 로컬 통합 검증 + 배포

**Files:** 없음(검증)

- [ ] **Step 1: 로컬 서버 기동** — `.env`에 `DATABASE_URL`(Supabase), `TOKEN_ENC_KEY`, 구글/제미니 키 설정 후 `npm run dev`. `/api/status` → `authenticated:false` 확인.
- [ ] **Step 2: 브라우저에서 구글 로그인** — http://localhost:5173 → "Google로 로그인" → 동의 → 대시보드 진입. To-Do 추가 후 새로고침 시 유지되는지(서버 저장) 확인.
- [ ] **Step 3: 전체 테스트** — Run: `npm test` → 서버+클라 전부 PASS.
- [ ] **Step 4: 푸시 → Render 자동 재배포** — `git push origin main`. Render Environment에 `DATABASE_URL`,`TOKEN_ENC_KEY` 추가하고 `APP_PASSWORD` 삭제. 재배포 후 공개 URL에서 구글 로그인·데이터 동기화 확인.

---

## Self-Review

- **Spec coverage:** 구글 로그인(Task5,10) ✓, 누구나 가입(별도 제약 없음) ✓, 서버 DB 데이터(Task3,7,9) ✓, Supabase Postgres(Task3,11) ✓, 사용자별 토큰 격리(Task4) ✓, 첫 로그인 이관(Task9) ✓, APP_PASSWORD 제거(Task2,5,11) ✓, 암호화 토큰(Task4) ✓, 테스트(Task1,2,3,10) ✓, 배포(Task11,12) ✓.
- **Placeholder scan:** 각 신규 모듈에 실제 코드 포함. 뷰 배선(Task10 Step4)은 반복 패턴이라 파일별 지침으로 기술(코드는 동일 패턴 `useData()`).
- **Type consistency:** `getCalendarApi(userId)`(async), `getAuthedClient(userId)`, `saveTokensForUser`, `AppData`, `useData().update(patch)` — 태스크 간 일치.
- **주의(구현 시 확정):** Task10의 Provider 순서 재배치(DataProvider가 AppProvider 바깥, DataContext가 자체 status 확인)로 순환 의존을 피한다. AppContext의 settings는 useData에서 읽는다. 이 부분은 실제 구현에서 컴파일로 검증.
