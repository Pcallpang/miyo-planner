# 메신저 알리미 (planner 저장소) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** StretchPet(별도 프로젝트)이 브리티 쪽지 본문을 보내면, 기존 "쪽지 붙여넣기"의 Gemini
추출 파이프라인을 재사용해 "확인 대기" 카드로 저장하고, 웹 화면 사이드바 "쪽지 붙여넣기"
바로 아래 신설한 "메신저 알리미" 메뉴에서 선생님이 확인 후에만 캘린더/회의록/To-Do에
등록할 수 있게 한다.

**Architecture:** 새 인증된 API `POST /api/messenger-alert/ingest`가 전화번호 마스킹된
본문을 받아 (기존 `routes/gemini.js`의 추출 로직을 `lib/noteExtractor.js`로 뽑아 공유)
Gemini로 추출한 뒤 새 테이블 `messenger_alerts`에 저장한다(메시지 해시로 중복 방지).
`GET /api/messenger-alert`로 목록 조회, `DELETE /api/messenger-alert/:id`로 처리 완료/무시된
카드를 지운다. 웹 클라이언트는 이 목록을 폴링해 배지를 띄우고, 새 모달에서 기존 쪽지
붙여넣기 카드와 동일한 등록 UI로 확인시킨다. **자동 등록은 절대 하지 않는다.**

**Tech Stack:** Node.js/Express (ESM), `pg`(PostgreSQL), `@google/generative-ai`,
React + TypeScript + Tailwind, `node:test`(서버), `vitest`(클라이언트).

## Global Constraints

- 자동으로 캘린더/To-Do/회의록에 등록하는 로직을 절대 추가하지 않는다 — 반드시 선생님이
  버튼을 눌러야 반영된다 (설계 문서 4.4, 8절).
- 이 API를 호출하는 모든 클라이언트(StretchPet 포함)는 기존 세션 토큰 인증
  (`Cookie: session=<token>` 헤더, `server/lib/auth.js`의 `sessionUserId`)을 그대로 쓴다 —
  새 인증 방식을 만들지 않는다.
- 기존 "쪽지 붙여넣기"(`routes/gemini.js`, `NotePasteModal.tsx`)의 동작·응답 형식을
  바꾸지 않는다 — 리팩터링은 내부 구조만 옮기고 외부 동작은 그대로 유지한다.
- 이 저장소에는 컴포넌트(.tsx) 자동 테스트가 없다(관례) — UI 작업은 `npm run dev`로
  수동 확인하고, 순수 함수(lib)만 `node:test`/`vitest`로 테스트한다.
- 커밋마다 `npm test`(루트, server+client+native-widget 전체)가 통과해야 한다.

---

## 파일 구조 개요

| 파일 | 변경 |
|---|---|
| `server/db/schema.sql` | `messenger_alerts` 테이블 추가 |
| `server/lib/db.js` | `insertMessengerAlert`/`listMessengerAlerts`/`deleteMessengerAlert` 추가 |
| `server/lib/messengerAlerts.js` | 신규 — 전화번호 마스킹, 중복방지 해시 (순수 함수) |
| `server/lib/messengerAlerts.test.js` | 신규 |
| `server/lib/noteExtractor.js` | 신규 — `routes/gemini.js`에서 추출 로직 이동 |
| `server/lib/noteExtractor.test.js` | 신규 |
| `server/routes/gemini.js` | `noteExtractor.js`를 쓰도록 축소 |
| `server/routes/messengerAlerts.js` | 신규 — ingest/list/dismiss 라우트 |
| `server/app.js` | 새 라우터 마운트 |
| `client/src/types.ts` | `MessengerAlert` 타입 추가 |
| `client/src/lib/api.ts` | `listMessengerAlerts`/`dismissMessengerAlert` 추가 |
| `client/src/hooks/useMessengerAlerts.ts` | 신규 — 폴링 훅 |
| `client/src/components/MessengerAlertModal.tsx` | 신규 |
| `client/src/components/Sidebar.tsx` | "메신저 알리미" 버튼 + 배지 추가 |
| `client/src/components/MoreSheet.tsx` | 모바일 메뉴에도 동일 버튼 추가 |
| `client/src/App.tsx` | 모달 상태·훅 연결 |
| `client/src/data/devLog.ts` | 변경 이력 한 줄 추가 |

---

### Task 1: 전화번호 마스킹·중복방지 해시 (순수 함수)

**Files:**
- Create: `server/lib/messengerAlerts.js`
- Test: `server/lib/messengerAlerts.test.js`

**Interfaces:**
- Produces: `maskPhoneNumbers(text: string): string`, `messageHash({ sender, receivedAt, body }): string`
  — Task 4(라우트)가 이 두 함수를 그대로 가져다 쓴다.

- [ ] **Step 1: 실패하는 테스트 작성**

```js
// server/lib/messengerAlerts.test.js
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { maskPhoneNumbers, messageHash } from './messengerAlerts.js';

test('maskPhoneNumbers는 하이픈 있는 번호를 가린다', () => {
  assert.equal(maskPhoneNumbers('연락처 010-1234-5678 입니다'), '연락처 010-****-**78 입니다');
});

test('maskPhoneNumbers는 하이픈 없는 번호도 가린다', () => {
  assert.equal(maskPhoneNumbers('01012345678로 연락주세요'), '010-****-**78로 연락주세요');
});

test('maskPhoneNumbers는 번호가 없으면 그대로 반환한다', () => {
  assert.equal(maskPhoneNumbers('내일 회의 있습니다'), '내일 회의 있습니다');
});

test('messageHash는 동일 입력에 동일 해시를 낸다', () => {
  const a = messageHash({ sender: '교무실', receivedAt: '2026-09-16T09:00:00+09:00', body: '회의 안내' });
  const b = messageHash({ sender: '교무실', receivedAt: '2026-09-16T09:00:00+09:00', body: '회의 안내' });
  assert.equal(a, b);
});

test('messageHash는 본문이 다르면 다른 해시를 낸다', () => {
  const a = messageHash({ sender: '교무실', receivedAt: '2026-09-16T09:00:00+09:00', body: '회의 안내' });
  const b = messageHash({ sender: '교무실', receivedAt: '2026-09-16T09:00:00+09:00', body: '다른 내용' });
  assert.notEqual(a, b);
});
```

- [ ] **Step 2: 테스트 실행해 실패 확인**

Run: `node --test server/lib/messengerAlerts.test.js`
Expected: FAIL (`Cannot find module './messengerAlerts.js'`)

- [ ] **Step 3: 최소 구현**

```js
// server/lib/messengerAlerts.js
import crypto from 'node:crypto';

const PHONE_RE = /01([0-9])[-.\s]?(\d{3,4})[-.\s]?(\d{4})/g;

/** 010-1234-5678 / 01012345678 형태를 010-****-**78 로 가린다. */
export function maskPhoneNumbers(text) {
  if (typeof text !== 'string') return text;
  return text.replace(PHONE_RE, (_, carrier, mid, last) => `01${carrier}-${'*'.repeat(mid.length)}-**${last.slice(-2)}`);
}

/** (발신자, 수신시각, 본문)으로 중복 방지용 해시를 만든다. */
export function messageHash({ sender, receivedAt, body }) {
  return crypto
    .createHash('sha256')
    .update(`${sender ?? ''}|${receivedAt ?? ''}|${body ?? ''}`)
    .digest('hex');
}
```

- [ ] **Step 4: 테스트 실행해 통과 확인**

Run: `node --test server/lib/messengerAlerts.test.js`
Expected: PASS (5 tests)

- [ ] **Step 5: 커밋**

```bash
git add server/lib/messengerAlerts.js server/lib/messengerAlerts.test.js
git commit -m "feat: 브리티 쪽지 전화번호 마스킹·중복방지 해시 함수 추가"
```

---

### Task 2: Gemini 추출 로직을 공유 모듈로 분리 (리팩터링)

**Files:**
- Create: `server/lib/noteExtractor.js`
- Test: `server/lib/noteExtractor.test.js`
- Modify: `server/routes/gemini.js` (전체 교체 — 아래 최종본대로)

**Interfaces:**
- Produces: `export async function extractFromNote(userId: string, text: string): Promise<{ events, todos }>`
  — 실패 시 `Error`를 던지되, 사용자에게 그대로 보여줘도 되는 경우 `err.status`(400/502/503)를
  붙인다. `err.status`가 없으면 호출자가 `isQuotaError`로 429 여부를 따로 판별해야 한다
  (기존 `geminiErrors.js`의 `isQuotaError`/`parseRetryAfterSeconds` 그대로 사용).
  Task 4(메신저 알리미 라우트)와 `routes/gemini.js`가 함께 이 함수를 쓴다.
- Consumes: 기존 `server/lib/db.js`의 `getUserGeminiKeyEnc`, `server/lib/crypto.js`의
  `decrypt`/`deriveKey`.

- [ ] **Step 1: 실패하는 테스트 작성 (정규화 순수 함수만 — Gemini 호출 자체는 외부 API라 여기선 검증하지 않는다)**

```js
// server/lib/noteExtractor.test.js
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeEvent, normalizeTodo } from './noteExtractor.js';

test('normalizeEvent는 날짜가 없으면 null', () => {
  assert.equal(normalizeEvent({ title: '회의' }), null);
});

test('normalizeEvent는 유효한 입력을 정규화한다', () => {
  const ev = normalizeEvent({ title: '학년부 협의회', date: '2026-09-20', startTime: '15:0', endTime: '16:00' });
  assert.equal(ev.title, '학년부 협의회');
  assert.equal(ev.date, '2026-09-20');
  assert.equal(ev.startTime, null); // '15:0'은 HH:mm 형식이 아니므로 무효 처리
  assert.equal(ev.allDay, true); // startTime이 없으면 종일
});

test('normalizeTodo는 text가 없으면 null', () => {
  assert.equal(normalizeTodo({ category: '업무' }), null);
});

test('normalizeTodo는 category가 목록에 없으면 업무로 기본값 처리', () => {
  const t = normalizeTodo({ text: '평가계획 제출', category: '기타' });
  assert.equal(t.category, '업무');
});
```

- [ ] **Step 2: 테스트 실행해 실패 확인**

Run: `node --test server/lib/noteExtractor.test.js`
Expected: FAIL (`Cannot find module './noteExtractor.js'`)

- [ ] **Step 3: `server/routes/gemini.js`에 있던 추출 로직을 그대로 옮겨 구현**

```js
// server/lib/noteExtractor.js
import { GoogleGenerativeAI } from '@google/generative-ai';
import { decrypt, deriveKey } from './crypto.js';
import { getUserGeminiKeyEnc } from './db.js';

function encKey() {
  return deriveKey(process.env.TOKEN_ENC_KEY || 'dev-key');
}

/** 로그인 사용자의 Gemini 키(있으면) 또는 서버 기본 키를 반환. 없으면 null. */
async function resolveGeminiKey(userId) {
  const enc = await getUserGeminiKeyEnc(userId);
  if (enc) {
    try {
      return decrypt(enc, encKey());
    } catch {
      /* 복호화 실패 시 서버 키로 폴백 */
    }
  }
  return process.env.GEMINI_API_KEY || null;
}

function todayInSeoul() {
  const now = new Date();
  const date = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(now)
    .replace(/\. ?/g, '-')
    .replace(/-$/, '');
  const weekday = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', weekday: 'long' }).format(now);
  return { date, weekday };
}

function buildPrompt(text) {
  const { date, weekday } = todayInSeoul();
  return `당신은 학교 행정 쪽지·안내문을 분석해 (1)일정과 (2)해야 할 일(To-Do)을 추출하는 교사 비서입니다.
오늘 날짜는 ${date} (${weekday})입니다. '다음 주 화요일', '내일' 같은 상대적 표현은 이 날짜를 기준으로 실제 날짜로 변환하세요.

아래 쪽지 원문에서 일정과 할 일을 추출해 다음 JSON **객체**로만 응답하세요:
{
  "events": [ 일정 배열 ],
  "todos": [ 할 일 배열 ]
}

events 각 항목 스키마:
{
  "title": "간결한 일정 제목 (한국어)",
  "date": "YYYY-MM-DD",
  "startTime": "HH:mm 또는 null (본문에 시간이 없으면 null)",
  "endTime": "HH:mm 또는 null",
  "allDay": true/false (시간이 명시되지 않았으면 true),
  "location": "장소 또는 null",
  "memo": "원문 핵심 요약 (3줄 이내)",
  "needsConfirmation": true/false (날짜·시간을 추정했거나 애매하면 true)
}

todos 각 항목 스키마 (교사가 직접 준비·처리해야 하는 행동 항목):
{
  "text": "할 일 (한국어, 간결하게)",
  "category": "업무" | "교과" | "개인",
  "dueDate": "YYYY-MM-DD 또는 null (마감·기한이 있으면)"
}

category 분류 기준:
- "업무": 공문·제출물·행정 처리·회의 준비·설문·명단 제출 등 학교 행정/업무
- "교과": 수업 준비·평가·채점·교재·수행평가·시험 출제 등 교과 수업 관련
- "개인": 위에 해당하지 않는 개인적인 준비·기타

규칙:
- 일정(날짜/행사)은 events로, 교사가 능동적으로 해야 하는 행동은 todos로 넣으세요. 하나의 문장이 둘 다에 해당하면 양쪽에 넣어도 됩니다.
- 해당 항목이 없으면 그 배열은 빈 배열 []로 두세요.
- events가 날짜를 추정했으면 needsConfirmation을 true로 하세요.
- JSON 객체 외의 다른 텍스트는 절대 출력하지 마세요.

쪽지 원문:
"""
${text}
"""`;
}

export function normalizeEvent(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const date = typeof raw.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.date) ? raw.date : null;
  if (!date) return null;
  const time = (v) => (typeof v === 'string' && /^\d{1,2}:\d{2}$/.test(v) ? v.padStart(5, '0') : null);
  const startTime = time(raw.startTime);
  return {
    title: typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : '(제목 없음)',
    date,
    startTime,
    endTime: time(raw.endTime),
    allDay: raw.allDay === true || !startTime,
    location: typeof raw.location === 'string' ? raw.location : null,
    memo: typeof raw.memo === 'string' ? raw.memo : '',
    needsConfirmation: raw.needsConfirmation === true,
  };
}

const TODO_CATEGORIES = ['업무', '교과', '개인'];

export function normalizeTodo(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const text = typeof raw.text === 'string' ? raw.text.trim() : '';
  if (!text) return null;
  const category = TODO_CATEGORIES.includes(raw.category) ? raw.category : '업무';
  const dueDate = typeof raw.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.dueDate) ? raw.dueDate : null;
  return { text, category, dueDate };
}

/**
 * 쪽지 원문에서 일정·할 일을 추출한다.
 * 사용자에게 그대로 보여줄 수 있는 실패는 err.status(400/502/503)를 붙여 던진다.
 * Gemini 호출 자체의 실패(쿼터 초과 등)는 status 없이 원래 에러를 그대로 던진다
 * — 호출자가 geminiErrors.js의 isQuotaError로 따로 판별한다.
 */
export async function extractFromNote(userId, text) {
  const geminiKey = await resolveGeminiKey(userId);
  if (!geminiKey) {
    const err = new Error('Gemini API 키가 없습니다. 환경 설정에서 본인의 Gemini API 키를 연결해 주세요.');
    err.status = 503;
    throw err;
  }
  if (!text || typeof text !== 'string' || !text.trim()) {
    const err = new Error('쪽지 내용을 입력해 주세요.');
    err.status = 400;
    throw err;
  }
  const genAI = new GoogleGenerativeAI(geminiKey);
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || 'gemini-flash-lite-latest',
    generationConfig: { responseMimeType: 'application/json' },
  });
  const result = await model.generateContent(buildPrompt(text));
  const rawText = result.response.text();

  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    const err = new Error('Gemini 응답을 해석하지 못했습니다. 다시 시도해 주세요.');
    err.status = 502;
    throw err;
  }
  const eventList = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.events) ? parsed.events : [];
  const todoList = Array.isArray(parsed?.todos) ? parsed.todos : [];
  return {
    events: eventList.map(normalizeEvent).filter(Boolean),
    todos: todoList.map(normalizeTodo).filter(Boolean),
  };
}
```

- [ ] **Step 4: 테스트 실행해 통과 확인**

Run: `node --test server/lib/noteExtractor.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: `server/routes/gemini.js`를 `extractFromNote`를 쓰도록 축소 (동작은 동일하게 유지)**

`server/routes/gemini.js` 파일 전체를 아래로 교체한다:

```js
import { Router } from 'express';
import { isQuotaError, parseRetryAfterSeconds } from '../lib/geminiErrors.js';
import { encrypt, decrypt, deriveKey } from '../lib/crypto.js';
import { saveUserGeminiKey, getUserGeminiKeyEnc, deleteUserGeminiKey } from '../lib/db.js';
import { extractFromNote } from '../lib/noteExtractor.js';

const router = Router();

function encKey() {
  return deriveKey(process.env.TOKEN_ENC_KEY || 'dev-key');
}

// 사용자 Gemini 키 저장(암호화)
router.post('/key', async (req, res) => {
  const key = typeof req.body?.key === 'string' ? req.body.key.trim() : '';
  if (!key) return res.status(400).json({ error: 'Gemini API 키를 입력해 주세요.' });
  try {
    await saveUserGeminiKey(req.userId, encrypt(key, encKey()));
    res.json({ ok: true });
  } catch (e) {
    console.error('[gemini] 키 저장 실패:', e.message);
    res.status(500).json({ error: '키 저장에 실패했습니다.' });
  }
});

// 사용자 Gemini 키 연결 해제
router.delete('/key', async (req, res) => {
  try {
    await deleteUserGeminiKey(req.userId);
    res.json({ ok: true });
  } catch (e) {
    console.error('[gemini] 키 삭제 실패:', e.message);
    res.status(500).json({ error: '키 삭제에 실패했습니다.' });
  }
});

router.post('/parse', async (req, res) => {
  const { text } = req.body || {};
  try {
    const { events, todos } = await extractFromNote(req.userId, text);
    res.json({ events, todos });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    console.error('[gemini]', e.message);
    if (isQuotaError(e)) {
      const retryAfter = parseRetryAfterSeconds(e.message);
      const when = retryAfter ? `약 ${retryAfter}초 후` : '잠시 후';
      return res.status(429).json({
        error: `Gemini 요청 한도를 초과했습니다. ${when} 다시 시도해 주세요.`,
        retryAfter,
      });
    }
    res.status(502).json({ error: 'Gemini 호출에 실패했습니다. API 키와 네트워크를 확인해 주세요.' });
  }
});

export default router;
```

- [ ] **Step 6: 전체 서버 테스트 실행해 회귀 없는지 확인**

Run: `node --test server/lib/*.test.js`
Expected: PASS (모든 파일 포함)

- [ ] **Step 7: 수동 확인 — 기존 쪽지 붙여넣기가 그대로 동작하는지**

```bash
npm run dev
```
브라우저에서 "쪽지 붙여넣기"로 안내문을 붙여넣고 "Gemini로 일정 추출"이 이전과 동일하게
동작하는지 확인한다 (리팩터링이므로 응답 형식이 절대 바뀌면 안 된다).

- [ ] **Step 8: 커밋**

```bash
git add server/lib/noteExtractor.js server/lib/noteExtractor.test.js server/routes/gemini.js
git commit -m "refactor: 쪽지 추출 로직을 noteExtractor.js로 분리 (메신저 알리미와 공유 예정)"
```

---

### Task 3: `messenger_alerts` 테이블과 DB 함수

**Files:**
- Modify: `server/db/schema.sql`
- Modify: `server/lib/db.js`

**Interfaces:**
- Produces:
  - `insertMessengerAlert(userId, { source?, dedupHash, sender, receivedAt, bodyExcerpt, events, todos }): Promise<Row | null>`
    (중복이면 `null`)
  - `listMessengerAlerts(userId): Promise<Row[]>`
  - `deleteMessengerAlert(id, userId): Promise<number>` (삭제된 행 수)
  - `Row` 형태: `{ id, source, sender, receivedAt, bodyExcerpt, events, todos, createdAt }`
- Consumes: 기존 `pool`(같은 파일 안).

이 테이블은 `pool`에 직접 SQL을 날리는 계층이라, 기존 `feature_requests`류 함수들과
동일하게 이 저장소 관례상 자동 테스트 없이(수동 확인) 진행한다.

- [ ] **Step 1: `server/db/schema.sql` 끝에 테이블 추가**

```sql
CREATE TABLE IF NOT EXISTS messenger_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'brity',
  dedup_hash text NOT NULL,
  sender text,
  received_at timestamptz,
  body_excerpt text NOT NULL,
  events jsonb NOT NULL DEFAULT '[]'::jsonb,
  todos jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, dedup_hash)
);
```

- [ ] **Step 2: `server/lib/db.js` 끝에 함수 추가**

```js
/** 신규 브리티 쪽지를 저장한다. 이미 있던 쪽지(동일 dedupHash)면 null을 반환한다. */
export async function insertMessengerAlert(userId, { source = 'brity', dedupHash, sender, receivedAt, bodyExcerpt, events, todos }) {
  const { rows } = await pool.query(
    `INSERT INTO messenger_alerts (user_id, source, dedup_hash, sender, received_at, body_excerpt, events, todos)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (user_id, dedup_hash) DO NOTHING
     RETURNING id, source, sender, received_at AS "receivedAt", body_excerpt AS "bodyExcerpt", events, todos,
               created_at AS "createdAt"`,
    [userId, source, dedupHash, sender ?? null, receivedAt ?? null, bodyExcerpt, JSON.stringify(events), JSON.stringify(todos)],
  );
  return rows[0] || null;
}

export async function listMessengerAlerts(userId) {
  const { rows } = await pool.query(
    `SELECT id, source, sender, received_at AS "receivedAt", body_excerpt AS "bodyExcerpt", events, todos,
            created_at AS "createdAt"
       FROM messenger_alerts WHERE user_id=$1 ORDER BY created_at DESC`,
    [userId],
  );
  return rows;
}

/** 본인 소유 카드만 지운다. 삭제된 행 수(0이면 이미 없었거나 권한 없음). */
export async function deleteMessengerAlert(id, userId) {
  const { rowCount } = await pool.query(
    'DELETE FROM messenger_alerts WHERE id=$1 AND user_id=$2', [id, userId],
  );
  return rowCount;
}
```

- [ ] **Step 3: 로컬 DB에 반영되는지 수동 확인**

```bash
npm run dev
```
서버 로그에 스키마 적용 에러가 없는지 확인한다(`initDb()`가 매 기동 시 `schema.sql`을 실행한다).
필요하면 `psql`로 `\d messenger_alerts` 실행해 테이블이 생겼는지 확인한다.

- [ ] **Step 4: 커밋**

```bash
git add server/db/schema.sql server/lib/db.js
git commit -m "feat: messenger_alerts 테이블·DB 함수 추가"
```

---

### Task 4: 메신저 알리미 API 라우트

**Files:**
- Create: `server/routes/messengerAlerts.js`
- Modify: `server/app.js`

**Interfaces:**
- Consumes: Task 1의 `maskPhoneNumbers`/`messageHash`, Task 2의 `extractFromNote`,
  Task 3의 `insertMessengerAlert`/`listMessengerAlerts`/`deleteMessengerAlert`.
- Produces: `POST /api/messenger-alert/ingest`, `GET /api/messenger-alert`,
  `DELETE /api/messenger-alert/:id` (모두 `requireAuth` 통과 필요 — `req.userId` 사용).

- [ ] **Step 1: 라우트 파일 작성**

```js
// server/routes/messengerAlerts.js
import { Router } from 'express';
import { extractFromNote } from '../lib/noteExtractor.js';
import { maskPhoneNumbers, messageHash } from '../lib/messengerAlerts.js';
import { insertMessengerAlert, listMessengerAlerts, deleteMessengerAlert } from '../lib/db.js';

const router = Router();

// StretchPet 등 로컬 감시 프로그램이 브리티 새 쪽지를 보내는 엔드포인트.
// 여기서 곧바로 캘린더/To-Do에 등록하지 않는다 — "확인 대기" 카드로만 저장한다.
router.post('/ingest', async (req, res) => {
  const { sender, receivedAt, body } = req.body || {};
  if (typeof body !== 'string' || !body.trim()) {
    return res.status(400).json({ error: '쪽지 본문이 없습니다.' });
  }
  const maskedBody = maskPhoneNumbers(body);
  const dedupHash = messageHash({ sender: sender ?? '', receivedAt: receivedAt ?? '', body: maskedBody });
  try {
    const { events, todos } = await extractFromNote(req.userId, maskedBody);
    if (events.length === 0 && todos.length === 0) {
      return res.json({ stored: false, reason: 'no-schedule-found' });
    }
    const saved = await insertMessengerAlert(req.userId, {
      dedupHash,
      sender: typeof sender === 'string' ? sender : null,
      receivedAt: typeof receivedAt === 'string' ? receivedAt : null,
      bodyExcerpt: maskedBody.slice(0, 500),
      events,
      todos,
    });
    res.json({ stored: Boolean(saved) });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    console.error('[messenger-alert] ingest 실패:', e.message);
    res.status(502).json({ error: 'Gemini 호출에 실패했습니다.' });
  }
});

router.get('/', async (req, res) => {
  const alerts = await listMessengerAlerts(req.userId);
  res.json({ alerts });
});

// 등록을 마쳤거나 무시하기로 한 카드를 지운다.
router.delete('/:id', async (req, res) => {
  const rowCount = await deleteMessengerAlert(req.params.id, req.userId);
  res.json({ ok: rowCount > 0 });
});

export default router;
```

- [ ] **Step 2: `server/app.js`에 마운트**

`server/app.js`의 라우터 import 블록에 추가:
```js
const { default: messengerAlertsRouter } = await import('./routes/messengerAlerts.js');
```
(`boardRouter` import 바로 아래 줄에 추가)

`app.use` 블록에 추가:
```js
app.use('/api/messenger-alert', requireAuth, messengerAlertsRouter);
```
(`app.use('/api/board', requireAuth, boardRouter);` 바로 아래 줄에 추가)

- [ ] **Step 3: 수동 확인 (curl, 로컬 서버 기동 상태에서 브라우저로 먼저 로그인해 세션 쿠키를 얻은 뒤)**

```bash
npm run dev
# 브라우저 devtools > Application > Cookies에서 session 쿠키 값을 복사해 아래 <TOKEN>에 대입
curl -s -X POST http://localhost:3001/api/messenger-alert/ingest \
  -H "Content-Type: application/json" \
  -H "Cookie: session=<TOKEN>" \
  -d '{"sender":"교무실","receivedAt":"2026-09-16T09:00:00+09:00","body":"다음 주 화요일 15시 3층 회의실에서 학년부 협의회가 있습니다. 010-1234-5678로 문의."}'
```
Expected: `{"stored":true}` (Gemini 키가 연결돼 있어야 함). 이어서:
```bash
curl -s http://localhost:3001/api/messenger-alert -H "Cookie: session=<TOKEN>"
```
Expected: 방금 저장한 카드가 `alerts` 배열에 보이고, `bodyExcerpt`의 전화번호가
`010-****-**78`로 가려져 있어야 한다.

- [ ] **Step 4: 커밋**

```bash
git add server/routes/messengerAlerts.js server/app.js
git commit -m "feat: 메신저 알리미 ingest/list/dismiss API 추가"
```

---

### Task 5: 클라이언트 타입·API 함수

**Files:**
- Modify: `client/src/types.ts`
- Modify: `client/src/lib/api.ts`

**Interfaces:**
- Produces: `MessengerAlert` 타입, `api.listMessengerAlerts()`, `api.dismissMessengerAlert(id)`.
- Consumes: 기존 `ParsedEvent`, `ParsedTodo` 타입(같은 파일).

- [ ] **Step 1: `client/src/types.ts`의 `ParsedTodo` 인터페이스 바로 아래에 추가**

```ts
export interface MessengerAlert {
  id: string;
  source: string;
  sender: string | null;
  receivedAt: string | null;
  bodyExcerpt: string;
  events: ParsedEvent[];
  todos: ParsedTodo[];
  createdAt: string;
}
```

- [ ] **Step 2: `client/src/lib/api.ts` 상단 import에 `MessengerAlert` 추가**

`import type { ... } from '../types';` 블록의 알파벳 순서에 맞춰 `MessengerAlert`를 끼워 넣는다.

- [ ] **Step 3: `api.parseNote` 바로 아래에 함수 추가**

```ts
  listMessengerAlerts: () => request<{ alerts: MessengerAlert[] }>('/api/messenger-alert'),

  dismissMessengerAlert: (id: string) =>
    request<{ ok: boolean }>(`/api/messenger-alert/${encodeURIComponent(id)}`, { method: 'DELETE' }),
```

- [ ] **Step 4: 타입 체크로 확인**

Run: `npm run build -w client` (또는 `cd client && npx tsc --noEmit`)
Expected: 에러 없음

- [ ] **Step 5: 커밋**

```bash
git add client/src/types.ts client/src/lib/api.ts
git commit -m "feat: 메신저 알리미 클라이언트 타입·API 함수 추가"
```

---

### Task 6: 폴링 훅

**Files:**
- Create: `client/src/hooks/useMessengerAlerts.ts`

**Interfaces:**
- Produces: `useMessengerAlerts(enabled: boolean): { alerts: MessengerAlert[]; refresh: () => Promise<void> }`
- Consumes: Task 5의 `api.listMessengerAlerts`.
- 이 저장소는 훅에 대한 자동 테스트 관례가 없다(다른 훅들도 테스트 없음) — 수동 확인으로 검증한다.

- [ ] **Step 1: 훅 작성**

```ts
// client/src/hooks/useMessengerAlerts.ts
import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { MessengerAlert } from '../types';

const POLL_MS = 60_000;

/** 로그인 상태일 때만(enabled) 60초마다 메신저 알리미 대기 카드를 폴링한다. */
export function useMessengerAlerts(enabled: boolean) {
  const [alerts, setAlerts] = useState<MessengerAlert[]>([]);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const { alerts } = await api.listMessengerAlerts();
      setAlerts(alerts);
    } catch {
      /* 폴링 실패는 조용히 무시하고 다음 주기에 재시도한다. */
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setAlerts([]);
      return;
    }
    void refresh();
    const id = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(id);
  }, [enabled, refresh]);

  return { alerts, refresh };
}
```

- [ ] **Step 2: 타입 체크**

Run: `cd client && npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add client/src/hooks/useMessengerAlerts.ts
git commit -m "feat: 메신저 알리미 폴링 훅 추가"
```

---

### Task 7: 메신저 알리미 모달 (확인·등록 UI)

**Files:**
- Create: `client/src/components/MessengerAlertModal.tsx`

**Interfaces:**
- Consumes: Task 5 (`api.listMessengerAlerts`, `api.dismissMessengerAlert`, `api.createEvent`),
  Task 6은 쓰지 않고(모달 열릴 때 자체적으로 한 번 더 최신 목록을 불러온다) `AppContext`의
  `useApp()`(`status`, `settings`, `showToast`, `refreshEvents`), `DataContext`의 `useData()`(`update`).
- Produces: `<MessengerAlertModal onClose={() => void} />` — `App.tsx`가 렌더링한다.

**주의:** `NotePasteModal.tsx`의 카드 UI·등록 로직(`registerOne` 패턴)을 그대로 재사용하되,
그 컴포넌트와 달리 **"오늘 할 일 자동 추가"를 하지 않는다** — 모든 항목은 선생님이 버튼을
눌러야 등록된다(설계 문서 4절 "자동 등록 없음" 원칙).

- [ ] **Step 1: 컴포넌트 작성**

```tsx
// client/src/components/MessengerAlertModal.tsx
import { useEffect, useState } from 'react';
import {
  AlertTriangle, CalendarPlus, CheckCircle2, ClipboardList, Inbox, ListChecks, Loader2, MessageCircle, X,
} from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useApp } from '../context/AppContext';
import { useData } from '../context/DataContext';
import { useEscapeKey } from '../hooks/useEscapeKey';
import DateField from './DateField';
import type { MessengerAlert, ParsedEvent, TodoCategory } from '../types';

type CardStatus = { state: 'idle' | 'saving' | 'done' } | { state: 'error'; message: string };

interface EventCard {
  alertId: string;
  index: number; // 같은 alert 안에서 몇 번째 이벤트인지
  event: ParsedEvent;
  status: CardStatus;
  toCalendar: boolean;
  toMeeting: boolean;
  toTodo: boolean;
  todoCategory: TodoCategory;
}

const TODO_BADGE: Record<TodoCategory, string> = {
  업무: 'bg-mint-100 text-mint-700',
  교과: 'bg-emerald-100 text-emerald-700',
  개인: 'bg-amber-100 text-amber-700',
};

export default function MessengerAlertModal({ onClose }: { onClose: () => void }) {
  const { status, settings, showToast, refreshEvents } = useApp();
  const { update } = useData();
  useEscapeKey(onClose);

  const [alerts, setAlerts] = useState<MessengerAlert[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cards, setCards] = useState<EventCard[]>([]);
  const [addedTodoKeys, setAddedTodoKeys] = useState<Set<string>>(new Set());

  const connected = Boolean(status?.connected);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { alerts } = await api.listMessengerAlerts();
        if (cancelled) return;
        setAlerts(alerts);
        setCards(
          alerts.flatMap((a) =>
            a.events.map((event, index) => ({
              alertId: a.id,
              index,
              event,
              status: { state: 'idle' } as CardStatus,
              toCalendar: true,
              toMeeting: false,
              toTodo: false,
              todoCategory: '업무' as TodoCategory,
            })),
          ),
        );
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : '불러오기에 실패했습니다.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function remainingCount(alertId: string): number {
    const alert = alerts?.find((a) => a.id === alertId);
    if (!alert) return 0;
    const pendingEvents = cards.filter((c) => c.alertId === alertId && c.status.state !== 'done').length;
    const pendingTodos = alert.todos.filter((_, i) => !addedTodoKeys.has(`${alertId}:${i}`)).length;
    return pendingEvents + pendingTodos;
  }

  async function dismissIfDone(alertId: string) {
    if (remainingCount(alertId) > 0) return;
    try {
      await api.dismissMessengerAlert(alertId);
    } catch {
      /* 실패해도 다음에 열 때 다시 시도하면 된다 — 사용자를 막지 않는다. */
    }
    setAlerts((prev) => (prev ? prev.filter((a) => a.id !== alertId) : prev));
  }

  async function ignoreAlert(alertId: string) {
    try {
      await api.dismissMessengerAlert(alertId);
    } catch {
      /* noop */
    }
    setAlerts((prev) => (prev ? prev.filter((a) => a.id !== alertId) : prev));
    setCards((prev) => prev.filter((c) => c.alertId !== alertId));
  }

  function updateCard(key: string, patch: Partial<EventCard>) {
    setCards((prev) =>
      prev.map((c) => (`${c.alertId}:${c.index}` === key ? { ...c, ...patch, status: { state: 'idle' } } : c)),
    );
  }

  async function registerCard(key: string) {
    const card = cards.find((c) => `${c.alertId}:${c.index}` === key);
    if (!card || card.status.state === 'done') return;
    const ev = card.event;
    if (!card.toCalendar && !card.toMeeting && !card.toTodo) {
      setCards((prev) =>
        prev.map((c) =>
          `${c.alertId}:${c.index}` === key
            ? { ...c, status: { state: 'error', message: '캘린더·회의록&일정·TO-DO 중 하나를 선택해 주세요.' } }
            : c,
        ),
      );
      return;
    }
    setCards((prev) => prev.map((c) => (`${c.alertId}:${c.index}` === key ? { ...c, status: { state: 'saving' } } : c)));
    try {
      if (card.toCalendar) {
        await api.createEvent({
          title: ev.title.trim(),
          date: ev.date,
          allDay: ev.allDay || !ev.startTime,
          startTime: ev.allDay ? null : ev.startTime,
          endTime: ev.allDay ? null : ev.endTime,
          location: ev.location ?? '',
          description: ev.memo,
          calendarId: settings.calendarId,
        });
      }
      if (card.toMeeting) {
        update((prev) => ({
          meetings: [
            ...prev.meetings,
            {
              id: crypto.randomUUID(),
              title: ev.title.trim(),
              date: ev.date,
              time: ev.allDay ? undefined : (ev.startTime ?? undefined),
              memo: ev.memo,
              link: undefined,
            },
          ],
        }));
      }
      if (card.toTodo) {
        update((prev) => ({
          todos: [
            ...prev.todos,
            {
              id: crypto.randomUUID(),
              text: ev.title.trim(),
              category: card.todoCategory,
              done: false,
              dueDate: ev.date,
              createdAt: new Date().toISOString(),
            },
          ],
        }));
      }
      setCards((prev) => prev.map((c) => (`${c.alertId}:${c.index}` === key ? { ...c, status: { state: 'done' } } : c)));
      if (card.toCalendar) await refreshEvents();
      await dismissIfDone(card.alertId);
    } catch (e) {
      setCards((prev) =>
        prev.map((c) =>
          `${c.alertId}:${c.index}` === key
            ? { ...c, status: { state: 'error', message: e instanceof Error ? e.message : '등록 실패' } }
            : c,
        ),
      );
    }
  }

  function addTodo(alertId: string, todoIndex: number, todo: MessengerAlert['todos'][number]) {
    update((prev) => ({
      todos: [
        ...prev.todos,
        {
          id: crypto.randomUUID(),
          text: todo.text,
          category: todo.category,
          done: false,
          dueDate: todo.dueDate ?? undefined,
          createdAt: new Date().toISOString(),
        },
      ],
    }));
    setAddedTodoKeys((prev) => new Set(prev).add(`${alertId}:${todoIndex}`));
    void dismissIfDone(alertId);
  }

  const inputCls =
    'rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none transition focus:border-mint-400 focus:ring-2 focus:ring-mint-100';

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-slate-900/30 p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800">
            <MessageCircle size={18} className="text-mint-500" />
            메신저 알리미
          </h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <p className="text-sm text-slate-500">
            브리티 메신저에서 자동으로 감지된 쪽지입니다. 확인·수정 후 직접 등록 버튼을 눌러야
            반영됩니다.
          </p>
          {loadError && (
            <div className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-rose-500">
              <AlertTriangle size={15} />
              <span>{loadError}</span>
            </div>
          )}
          {alerts && alerts.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-10 text-slate-400">
              <Inbox size={28} />
              <p className="text-sm">확인 대기 중인 쪽지가 없습니다.</p>
            </div>
          )}
          {!connected && alerts && alerts.length > 0 && (
            <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
              구글 계정이 연동되어 있지 않아 캘린더에는 등록할 수 없습니다. 먼저 상단의 &lsquo;구글 계정
              연동&rsquo;을 진행해 주세요.
            </p>
          )}

          {alerts?.map((alert) => {
            const alertCards = cards.filter((c) => c.alertId === alert.id);
            return (
              <div key={alert.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                      브리티
                    </span>
                    {alert.sender && <span className="text-xs text-slate-400">{alert.sender}</span>}
                  </div>
                  <button
                    onClick={() => void ignoreAlert(alert.id)}
                    className="text-xs font-medium text-slate-400 underline-offset-2 hover:underline"
                  >
                    무시
                  </button>
                </div>
                <p className="mb-3 whitespace-pre-wrap text-xs leading-relaxed text-slate-500">
                  {alert.bodyExcerpt}
                </p>

                <div className="space-y-3">
                  {alertCards.map(({ alertId, index, event: ev, status: st, toCalendar, toMeeting, toTodo, todoCategory }) => {
                    const key = `${alertId}:${index}`;
                    return (
                      <div
                        key={key}
                        className={`rounded-xl border p-3 ${st.state === 'done' ? 'border-mint-200 bg-mint-50/60' : 'border-slate-200'}`}
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <input
                            className={`${inputCls} flex-1 font-semibold`}
                            value={ev.title}
                            onChange={(e) => updateCard(key, { event: { ...ev, title: e.target.value } })}
                          />
                          {ev.needsConfirmation && st.state !== 'done' && (
                            <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                              <AlertTriangle size={12} /> 날짜·시간 확인 필요
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <DateField
                            className={inputCls}
                            value={ev.date}
                            onChange={(v) => updateCard(key, { event: { ...ev, date: v } })}
                          />
                          <label className="flex items-center gap-1.5 text-sm text-slate-600">
                            <input
                              type="checkbox"
                              checked={ev.allDay}
                              onChange={(e) => updateCard(key, { event: { ...ev, allDay: e.target.checked } })}
                              className="h-4 w-4 accent-mint-500"
                            />
                            종일
                          </label>
                          {!ev.allDay && (
                            <>
                              <input
                                type="time"
                                className={inputCls}
                                value={ev.startTime ?? ''}
                                onChange={(e) => updateCard(key, { event: { ...ev, startTime: e.target.value || null } })}
                              />
                              <span className="text-slate-400">~</span>
                              <input
                                type="time"
                                className={inputCls}
                                value={ev.endTime ?? ''}
                                onChange={(e) => updateCard(key, { event: { ...ev, endTime: e.target.value || null } })}
                              />
                            </>
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
                          <label className="flex items-center gap-1.5 text-sm text-slate-600">
                            <input
                              type="checkbox"
                              checked={toCalendar}
                              onChange={(e) => updateCard(key, { toCalendar: e.target.checked })}
                              disabled={st.state === 'done'}
                              className="h-4 w-4 accent-mint-500"
                            />
                            <CalendarPlus size={14} className="text-slate-400" />
                            캘린더
                          </label>
                          <label className="flex items-center gap-1.5 text-sm text-slate-600">
                            <input
                              type="checkbox"
                              checked={toMeeting}
                              onChange={(e) => updateCard(key, { toMeeting: e.target.checked })}
                              disabled={st.state === 'done'}
                              className="h-4 w-4 accent-mint-500"
                            />
                            <ClipboardList size={14} className="text-slate-400" />
                            회의록&amp;일정
                          </label>
                          <label className="flex items-center gap-1.5 text-sm text-slate-600">
                            <input
                              type="checkbox"
                              checked={toTodo}
                              onChange={(e) => updateCard(key, { toTodo: e.target.checked })}
                              disabled={st.state === 'done'}
                              className="h-4 w-4 accent-mint-500"
                            />
                            <ListChecks size={14} className="text-slate-400" />
                            TO-DO
                          </label>
                        </div>
                        <div className="mt-2 flex items-center justify-end gap-2">
                          {st.state === 'error' && <span className="text-xs text-rose-500">{st.message}</span>}
                          {st.state === 'done' ? (
                            <span className="flex items-center gap-1.5 text-sm font-medium text-mint-600">
                              <CheckCircle2 size={16} /> 등록 완료
                            </span>
                          ) : (
                            <button
                              onClick={() => void registerCard(key)}
                              disabled={(!connected && toCalendar) || st.state === 'saving'}
                              className="flex items-center gap-1.5 rounded-xl bg-mint-500 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-mint-600 disabled:opacity-40"
                            >
                              {st.state === 'saving' ? <Loader2 size={14} className="animate-spin" /> : <CalendarPlus size={14} />}
                              등록
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {alert.todos.map((todo, i) =>
                    addedTodoKeys.has(`${alert.id}:${i}`) ? null : (
                      <div key={i} className="flex items-center gap-2 rounded-xl border border-slate-200 p-3">
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${TODO_BADGE[todo.category]}`}>
                          {todo.category}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{todo.text}</span>
                        {todo.dueDate && <span className="shrink-0 text-xs text-slate-400">{todo.dueDate.slice(5).replace('-', '/')}</span>}
                        <button
                          onClick={() => addTodo(alert.id, i, todo)}
                          className="flex shrink-0 items-center gap-1 rounded-lg bg-mint-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-mint-600"
                        >
                          <ListChecks size={12} />
                          TO-DO 추가
                        </button>
                      </div>
                    ),
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 타입 체크**

Run: `cd client && npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add client/src/components/MessengerAlertModal.tsx
git commit -m "feat: 메신저 알리미 확인·등록 모달 추가"
```

---

### Task 8: 사이드바·모바일 메뉴·App.tsx 연결

**Files:**
- Modify: `client/src/components/Sidebar.tsx`
- Modify: `client/src/components/MoreSheet.tsx`
- Modify: `client/src/App.tsx`

**Interfaces:**
- Consumes: Task 6 `useMessengerAlerts`, Task 7 `MessengerAlertModal`.
- `Sidebar` props에 `onOpenMessengerAlerts: () => void`, `messengerAlertCount: number` 추가.
- `MoreSheet` props에 동일하게 추가.

- [ ] **Step 1: `client/src/components/Sidebar.tsx` — import에 `MessageCircle` 추가, `ClipboardPaste` 옆에**

```ts
import {
  Armchair,
  ClipboardPaste,
  FileSpreadsheet,
  GripVertical,
  History,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  MessageCircle,
  NotebookPen,
  School,
  Settings,
  Sparkles,
  Table,
} from 'lucide-react';
```

- [ ] **Step 2: `Props` 인터페이스와 함수 시그니처에 추가**

```ts
interface Props {
  view: ViewId;
  onNavigate: (v: ViewId) => void;
  onOpenNote: () => void;
  onOpenMessengerAlerts: () => void;
  messengerAlertCount: number;
}
```
```ts
export default function Sidebar({ view, onNavigate, onOpenNote, onOpenMessengerAlerts, messengerAlertCount }: Props) {
```

- [ ] **Step 3: "쪽지 붙여넣기" 버튼 바로 아래에 새 버튼 추가**

기존:
```tsx
      <div className="px-4">
        <button
          onClick={onOpenNote}
          className="mb-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-mint-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-mint-600"
        >
          <ClipboardPaste size={16} />
          쪽지 붙여넣기
        </button>
      </div>
```
다음으로 교체:
```tsx
      <div className="px-4">
        <button
          onClick={onOpenNote}
          className="mb-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-mint-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-mint-600"
        >
          <ClipboardPaste size={16} />
          쪽지 붙여넣기
        </button>
        <button
          onClick={onOpenMessengerAlerts}
          className="relative mb-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-mint-200 bg-white px-4 py-2.5 text-sm font-semibold text-mint-700 shadow-sm transition hover:bg-mint-50"
        >
          <MessageCircle size={16} />
          메신저 알리미
          {messengerAlertCount > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-bold text-white">
              {messengerAlertCount}
            </span>
          )}
        </button>
      </div>
```

- [ ] **Step 4: `client/src/components/MoreSheet.tsx`에도 동일 버튼 추가**

`MoreSheet.tsx`에서 "쪽지 붙여넣기" 버튼(102번째 줄 부근)을 찾아, 그 버튼과 같은 스타일로
바로 아래에 "메신저 알리미" 버튼을 추가한다. `MoreSheet` props에도 `onOpenMessengerAlerts`와
`messengerAlertCount`를 추가하고, 버튼 클릭 시 `onOpenMessengerAlerts()`를 호출하도록 배선한다
(기존 "쪽지 붙여넣기" 버튼이 `onOpenNote()`를 호출하는 것과 동일한 패턴).

- [ ] **Step 5: `client/src/App.tsx` 연결**

`noteOpen` state 옆에 추가:
```ts
const [alertsOpen, setAlertsOpen] = useState(false);
```
`import NotePasteModal from './components/NotePasteModal';` 아래에 추가:
```ts
import MessengerAlertModal from './components/MessengerAlertModal';
import { useMessengerAlerts } from './hooks/useMessengerAlerts';
```
컴포넌트 본문에서 `status`를 이미 쓰고 있는 지점(예: `useApp()` 호출부) 근처에 추가:
```ts
const { alerts: messengerAlerts } = useMessengerAlerts(Boolean(status?.authenticated));
```
`<Sidebar view={view} onNavigate={setView} onOpenNote={() => setNoteOpen(true)} />`를 교체:
```tsx
<Sidebar
  view={view}
  onNavigate={setView}
  onOpenNote={() => setNoteOpen(true)}
  onOpenMessengerAlerts={() => setAlertsOpen(true)}
  messengerAlertCount={messengerAlerts.length}
/>
```
`{noteOpen && <NotePasteModal onClose={() => setNoteOpen(false)} />}` 바로 아래에 추가:
```tsx
{alertsOpen && <MessengerAlertModal onClose={() => setAlertsOpen(false)} />}
```
`<MoreSheet onNavigate={setView} onClose={() => setMoreOpen(false)} onOpenNote={() => setNoteOpen(true)} />`도
같은 방식으로 `onOpenMessengerAlerts`/`messengerAlertCount` prop을 추가해 교체한다.

(`status?.authenticated` 필드는 `server/app.js`의 `/api/status`가 이미 내려주고 있다 —
`client/src/context/AppContext.tsx`에서 `status`를 가져오는 방식을 그대로 따른다.)

- [ ] **Step 6: 타입 체크 + 수동 확인**

```bash
cd client && npx tsc --noEmit
npm run dev   # 저장소 루트에서
```
브라우저에서 로그인 후 사이드바에 "메신저 알리미" 버튼이 보이는지, Task 4의 curl로
카드를 하나 만들어 둔 상태에서 60초 이내 배지 숫자가 뜨는지, 버튼을 눌러 모달에서
카드가 보이고 "등록"을 누르면 캘린더/회의록/TO-DO에 반영되며 카드가 사라지는지,
"무시"를 누르면 즉시 사라지는지 확인한다.

- [ ] **Step 7: 커밋**

```bash
git add client/src/components/Sidebar.tsx client/src/components/MoreSheet.tsx client/src/App.tsx
git commit -m "feat: 사이드바·모바일 메뉴에 메신저 알리미 연결"
```

---

### Task 9: 변경 이력 기록

**Files:**
- Modify: `client/src/data/devLog.ts`

- [ ] **Step 1: 맨 위(최신)에 항목 추가**

`devLog.ts`의 기존 항목 형식(`{ date, title, ... }` 등 — 파일 상단 기존 항목을 참고해
동일한 필드 구성으로) 그대로 따라 아래 내용의 항목을 배열 맨 앞에 추가한다:
"추가 — 브리티 메신저 쪽지를 자동 감지해 확인 후 등록하는 '메신저 알리미' 메뉴 추가
(StretchPet 설치 필요)".

- [ ] **Step 2: 커밋**

```bash
git add client/src/data/devLog.ts
git commit -m "docs: 변경 이력에 메신저 알리미 추가"
```

---

## Self-Review 결과

- **스펙 커버리지:** 설계 문서 4.3(서버 API)·4.4(웹 화면)를 Task 1~9가 모두 구현한다.
  4.1(브리티리더)·4.2(StretchPet 통합)·5절(트레이 배지)은 StretchPet 저장소 쪽 별도
  계획에서 다룬다(설계 문서 10절).
- **플레이스홀더 없음:** 모든 스텝에 실제 코드/명령어가 있다.
- **타입 일관성:** `MessengerAlert`(Task 5) → `useMessengerAlerts`(Task 6) →
  `MessengerAlertModal`(Task 7) → `Sidebar`/`App.tsx`(Task 8)까지 필드명이 동일하게
  이어진다(`alerts`, `events`, `todos`, `bodyExcerpt` 등).
