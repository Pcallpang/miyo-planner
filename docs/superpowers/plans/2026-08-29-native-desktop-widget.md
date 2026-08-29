# 네이티브 데스크톱 위젯(Electron) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 오늘의 시간표를 완전 투명 배경의 항상-위 네이티브 창(Electron)으로 바탕화면에
띄우고, 앱 안에서 한 번 구글 로그인하면 이후 자동 로그인되며, 기존 `planner` 서버를
그대로 데이터 소스로 쓰는 Windows 프로그램을 만든다.

**Architecture:** `planner` 저장소 안에 새 npm workspace `native-widget/`를 만든다.
렌더러(`src/`)는 기존 `client`의 시간표 표시 로직(React + Tailwind v4)을 이식해
Vite로 빌드한다. Electron 메인 프로세스(`electron/`, CommonJS)가 투명·프레임 없는
창 생성, 트레이 아이콘, 자동 실행, 구글 데스크톱 OAuth 로그인(루프백 서버 + PKCE),
기존 서버 `/api/data` 폴링을 담당하고 IPC(`preload.js`)로 렌더러에 데이터를 넘긴다.
서버(`server/`)에는 데스크톱 로그인 교환용 엔드포인트 하나만 추가한다.

**Tech Stack:** Electron, React 19 + TypeScript + Vite(렌더러), Tailwind CSS v4,
electron-builder(NSIS 패키징), Node.js 내장 `fetch`/`http`/`crypto`, 기존 Express +
`googleapis` 서버.

## Global Constraints

- 블러 효과 없이 **완전 투명**(선명하게 비침)으로 구현한다. Windows 전용, macOS/Linux
  지원 없음.
- 코드서명 인증서를 쓰지 않는다 — 설치 시 SmartScreen 경고는 그대로 감수하고 설치
  안내 문서에 우회 방법만 안내한다.
- 네이티브 앱은 별도 DB를 두지 않는다 — 기존 `planner` 서버(`/api/data`,
  `/api/auth/native-login`)만 호출한다.
- 로그인 토큰은 쿠키가 아니라 JSON 응답 바디로 받아, Electron이
  `safeStorage.encryptString()`으로 암호화해 로컬 파일에 저장하고, 이후 API 호출마다
  `Cookie: session=<토큰>` 헤더를 직접 실어 보낸다.
- 시간표 렌더링에 쓰는 순수 함수(`schedule.ts`, `subjectProgress.ts`의 `effectiveSlot`/
  `toWeekday`, `subjectColors.ts`, `nonClassSubjects.ts`)는 `client`에서 복사해
  `native-widget`에 독립적으로 둔다(패키지 공유 안 함 — 두 프로젝트가 따로 배포되므로).
- Electron 메인 프로세스(창 생성, 트레이, IPC, 로그인 흐름)는 이 프로젝트에 자동화
  테스트 도구가 없으므로(기존 `client`도 컴포넌트/E2E 테스트가 없음) 자동화 테스트
  대신 각 태스크의 "수동 확인" 단계로 검증한다. 순수 로직(PKCE, 시간표 계산, 서버의
  데스크톱 OAuth 헬퍼)만 TDD로 테스트한다.
- 완성 후 기존 브라우저 팝업 위젯(`client/src/views/WidgetView.tsx` 등) 제거는 이
  계획의 범위 밖이다(별도 계획으로 진행).

---

### Task 1: 서버 — 데스크톱 로그인 엔드포인트

**Files:**
- Modify: `server/lib/google.js` (파일 끝에 함수 추가)
- Create: `server/lib/google.test.js`
- Modify: `server/routes/auth.js` (라우트 추가)
- Modify: `.env.example` (환경변수 안내 추가)

**Interfaces:**
- Produces: `isDesktopGoogleConfigured(): boolean`,
  `createDesktopOAuthClient(redirectUri: string): OAuth2Client` (둘 다
  `server/lib/google.js`에서 export). `POST /api/auth/native-login` —
  요청 바디 `{ code: string, redirectUri: string, codeVerifier: string }`,
  성공 응답 `{ token: string, user: { email: string|null, name: string|null } }`,
  실패 시 `{ error: string }` + 4xx/503.

- [ ] **Step 1: 실패하는 테스트 작성**

`server/lib/google.test.js` 새로 작성:

```js
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isDesktopGoogleConfigured, createDesktopOAuthClient } from './google.js';

test('GOOGLE_DESKTOP_CLIENT_ID/SECRET이 둘 다 있어야 설정된 것으로 본다', () => {
  const prevId = process.env.GOOGLE_DESKTOP_CLIENT_ID;
  const prevSecret = process.env.GOOGLE_DESKTOP_CLIENT_SECRET;
  delete process.env.GOOGLE_DESKTOP_CLIENT_ID;
  delete process.env.GOOGLE_DESKTOP_CLIENT_SECRET;
  assert.equal(isDesktopGoogleConfigured(), false);

  process.env.GOOGLE_DESKTOP_CLIENT_ID = 'id';
  assert.equal(isDesktopGoogleConfigured(), false); // 하나만 있으면 아직 미설정

  process.env.GOOGLE_DESKTOP_CLIENT_SECRET = 'secret';
  assert.equal(isDesktopGoogleConfigured(), true);

  if (prevId === undefined) delete process.env.GOOGLE_DESKTOP_CLIENT_ID;
  else process.env.GOOGLE_DESKTOP_CLIENT_ID = prevId;
  if (prevSecret === undefined) delete process.env.GOOGLE_DESKTOP_CLIENT_SECRET;
  else process.env.GOOGLE_DESKTOP_CLIENT_SECRET = prevSecret;
});

test('createDesktopOAuthClient는 code 교환이 가능한 OAuth2 클라이언트를 만든다', () => {
  process.env.GOOGLE_DESKTOP_CLIENT_ID = 'id';
  process.env.GOOGLE_DESKTOP_CLIENT_SECRET = 'secret';
  const client = createDesktopOAuthClient('http://127.0.0.1:12345/callback');
  assert.equal(typeof client.getToken, 'function');
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test server/lib/google.test.js`
Expected: FAIL — `isDesktopGoogleConfigured is not a function` (아직 정의 안 함)

- [ ] **Step 3: `server/lib/google.js` 끝에 함수 추가**

파일 맨 끝에 추가(기존 `createOAuthClient`는 그대로 둔다 — 웹앱용과 별개 함수):

```js
/** 데스크톱(네이티브) 앱용 구글 OAuth 클라이언트가 설정됐는지 */
export function isDesktopGoogleConfigured() {
  return Boolean(process.env.GOOGLE_DESKTOP_CLIENT_ID && process.env.GOOGLE_DESKTOP_CLIENT_SECRET);
}

/**
 * 데스크톱 앱 전용 OAuth 클라이언트. 웹앱과 다른 구글 클라이언트(리디렉션이
 * http://127.0.0.1:* 루프백인 "데스크톱 앱" 타입)를 쓰고, redirectUri는 매 로그인마다
 * Electron이 여는 임시 포트가 달라 호출 시점에 전달받는다.
 */
export function createDesktopOAuthClient(redirectUri) {
  return new google.auth.OAuth2(
    process.env.GOOGLE_DESKTOP_CLIENT_ID, process.env.GOOGLE_DESKTOP_CLIENT_SECRET, redirectUri);
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test server/lib/google.test.js`
Expected: PASS (2 tests)

- [ ] **Step 5: `POST /api/auth/native-login` 라우트 추가**

`server/routes/auth.js` 상단 import에 추가:

```js
import {
  isGoogleConfigured, createOAuthClient, SCOPES, profileFromIdToken, saveTokensForUser,
  isDesktopGoogleConfigured, createDesktopOAuthClient,
} from '../lib/google.js';
```

`router.post('/logout', ...)` 위(기존 `google/callback` 라우트 바로 다음)에 추가:

```js
router.post('/native-login', async (req, res) => {
  if (!isDesktopGoogleConfigured()) {
    return res.status(503).json({ error: '데스크톱 로그인이 설정되지 않았습니다.' });
  }
  const { code, redirectUri, codeVerifier } = req.body || {};
  if (typeof code !== 'string' || typeof redirectUri !== 'string' || typeof codeVerifier !== 'string') {
    return res.status(400).json({ error: '잘못된 요청입니다.' });
  }
  try {
    const client = createDesktopOAuthClient(redirectUri);
    const { tokens } = await client.getToken({ code, codeVerifier });
    const { sub, email, name } = profileFromIdToken(tokens.id_token);
    if (!sub) throw new Error('id_token 없음');
    const user = await upsertUser({ googleSub: sub, email, name });
    await saveTokensForUser(user.id, tokens);
    res.json({ token: makeSessionToken(user.id), user: { email, name } });
  } catch (e) {
    console.error('[auth] 데스크톱 로그인 실패:', e.message);
    res.status(400).json({ error: '로그인에 실패했습니다.' });
  }
});
```

`upsertUser`는 이미 이 파일 상단에서 `../lib/db.js`로부터 import돼 있는지 확인하고,
없으면 기존 import 줄에 추가한다(`import { upsertUser, deleteUserTokens } from '../lib/db.js';`
— `deleteUserTokens` 옆에 이미 있을 가능성이 높으니 실제 파일을 열어 확인 후 없는
이름만 추가할 것).

- [ ] **Step 6: `.env.example`에 안내 추가**

기존 `GOOGLE_REDIRECT_URI=...` 줄 바로 아래에 추가:

```
# ── 네이티브 데스크톱 위젯용 구글 OAuth (별도 "데스크톱 앱" 타입 클라이언트) ──────
# https://console.cloud.google.com → API 및 서비스 → 사용자 인증 정보 → 만들기
# → OAuth 클라이언트 ID → 애플리케이션 유형: "데스크톱 앱". 위 GOOGLE_CLIENT_ID와는
# 다른, 별도로 발급받는 클라이언트입니다(무료).
GOOGLE_DESKTOP_CLIENT_ID=
GOOGLE_DESKTOP_CLIENT_SECRET=
```

- [ ] **Step 7: 서버 전체 테스트 확인 + 커밋**

Run: `node --test server/lib/*.test.js`
Expected: 모든 테스트 PASS (기존 테스트 포함)

```bash
git add server/lib/google.js server/lib/google.test.js server/routes/auth.js .env.example
git commit -m "feat: 네이티브 위젯용 데스크톱 구글 로그인 서버 엔드포인트 추가"
```

---

### Task 2: native-widget 프로젝트 뼈대 + 완전 투명 기본 창

**Files:**
- Create: `native-widget/package.json`
- Create: `native-widget/vite.config.ts`
- Create: `native-widget/tsconfig.json`
- Create: `native-widget/index.html`
- Create: `native-widget/electron/main.js`
- Create: `native-widget/electron/preload.js`
- Create: `native-widget/electron/windowBounds.js`
- Create: `native-widget/src/main.tsx`
- Create: `native-widget/src/App.tsx` (임시 "안녕하세요" 화면 — Task 6에서 완성)
- Create: `native-widget/src/index.css`
- Modify: `package.json` (루트 — workspaces에 추가)

**Interfaces:**
- Produces: `loadWindowBounds(): {width,height,x?,y?}`, `saveWindowBounds(bounds)` in
  `electron/windowBounds.js` — Task 4/5에서 그대로 재사용.

- [ ] **Step 1: 루트 workspace에 등록**

`package.json`(루트)의 `"workspaces"` 배열을 수정:

```json
  "workspaces": [
    "client",
    "server",
    "native-widget"
  ],
```

같은 파일의 `"scripts"."test"`를 수정:

```json
    "test": "node --test server/lib/*.test.js && npm run test -w client && npm run test -w native-widget",
```

- [ ] **Step 2: `native-widget/package.json` 작성**

```json
{
  "name": "miyo-native-widget",
  "private": true,
  "version": "1.0.0",
  "main": "electron/main.js",
  "type": "commonjs",
  "scripts": {
    "dev:renderer": "vite",
    "dev": "concurrently -k -n renderer,electron -c green,blue \"npm run dev:renderer\" \"wait-on http://localhost:5174 && electron .\"",
    "build:renderer": "tsc --noEmit && vite build",
    "build": "npm run build:renderer && electron-builder",
    "test": "vitest run"
  },
  "dependencies": {
    "date-fns": "^4.1.0",
    "react": "^19.1.0",
    "react-dom": "^19.1.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.1.7",
    "@types/react": "^19.1.5",
    "@types/react-dom": "^19.1.5",
    "@vitejs/plugin-react": "^4.4.1",
    "concurrently": "^9.1.2",
    "electron": "^33.0.0",
    "electron-builder": "^25.1.8",
    "tailwindcss": "^4.1.7",
    "typescript": "^5.8.3",
    "vite": "^6.3.5",
    "vitest": "^3.2.7",
    "wait-on": "^8.0.1"
  }
}
```

- [ ] **Step 3: `native-widget/tsconfig.json` 작성**

`client/tsconfig.json`과 동일한 내용:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noEmit": true,
    "isolatedModules": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

- [ ] **Step 4: `native-widget/vite.config.ts` 작성**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  server: { port: 5174 },
});
```

`base: './'`는 패키징된 앱이 `file://` 경로로 `index.html`을 열 때 정적 자산 경로가
깨지지 않게 하기 위함이다(dev 서버에서는 영향 없음).

- [ ] **Step 5: `native-widget/index.html` 작성**

```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <title>미요 오늘의 시간표</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: `native-widget/src/index.css` 작성**

```css
@import 'tailwindcss';

@theme {
  --font-sans: 'Pretendard Variable', Pretendard, 'Noto Sans KR', system-ui, sans-serif;
  --color-mint-50: #f0fbf8;
  --color-mint-100: #d9f5ee;
  --color-mint-200: #b3ebdd;
  --color-mint-300: #7edcc5;
  --color-mint-400: #45c5a8;
  --color-mint-500: #23ab8e;
  --color-mint-600: #178a74;
  --color-mint-700: #146e5e;
  --color-mint-800: #14584d;
  --color-mint-900: #134940;
}

html, body, #root {
  height: 100%;
  background: transparent;
  font-family: var(--font-sans);
}
```

- [ ] **Step 7: `native-widget/src/main.tsx` 작성**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 8: `native-widget/src/App.tsx` 임시 화면 작성**

Task 6에서 실제 시간표 화면으로 교체한다. 지금은 투명 창이 뜨는지만 확인한다.

```tsx
export default function App() {
  return (
    <div
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      className="flex h-screen items-center justify-center rounded-2xl border border-white/40 bg-black/10 text-sm font-semibold text-white"
    >
      미요 위젯 (준비 중)
    </div>
  );
}
```

- [ ] **Step 9: `native-widget/electron/windowBounds.js` 작성**

```js
const fs = require('node:fs');
const path = require('node:path');
const { app } = require('electron');

const DEFAULT_BOUNDS = { width: 320, height: 420 };

function boundsFilePath() {
  return path.join(app.getPath('userData'), 'window-bounds.json');
}

function loadWindowBounds() {
  try {
    return { ...DEFAULT_BOUNDS, ...JSON.parse(fs.readFileSync(boundsFilePath(), 'utf-8')) };
  } catch {
    return DEFAULT_BOUNDS;
  }
}

function saveWindowBounds(bounds) {
  fs.writeFileSync(boundsFilePath(), JSON.stringify({
    width: bounds.width, height: bounds.height, x: bounds.x, y: bounds.y,
  }));
}

module.exports = { loadWindowBounds, saveWindowBounds };
```

- [ ] **Step 10: `native-widget/electron/preload.js` 작성(껍데기)**

Task 4/5에서 채운다. 지금은 빈 브릿지만 둔다.

```js
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('miyo', {});
```

- [ ] **Step 11: `native-widget/electron/main.js` 작성**

```js
const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const { loadWindowBounds, saveWindowBounds } = require('./windowBounds');

const isDev = !app.isPackaged;
const DEV_SERVER_URL = 'http://localhost:5174';

let mainWindow = null;

function createWindow() {
  const bounds = loadWindowBounds();
  mainWindow = new BrowserWindow({
    ...bounds,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    resizable: true,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) mainWindow.loadURL(DEV_SERVER_URL);
  else mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));

  const persistBounds = () => saveWindowBounds(mainWindow.getBounds());
  mainWindow.on('resize', persistBounds);
  mainWindow.on('move', persistBounds);
  mainWindow.on('close', persistBounds);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  // 트레이 상주 프로그램이라 창을 닫아도 앱을 종료하지 않는다(Task 7에서 트레이 추가).
  if (process.platform !== 'darwin' && !app.isPackaged) app.quit();
});
```

`window-all-closed`에서 개발 중(`!app.isPackaged`)에는 종료하게 해 둬야 `npm run dev`를
Ctrl+C 없이 창만 닫아도 편하게 끝낼 수 있다. Task 7에서 트레이가 생기면 이 창은
`close` 대신 `hide`로 동작하도록 바뀐다.

- [ ] **Step 12: 의존성 설치 + 수동 확인**

```bash
npm install
npm run dev -w native-widget
```

Expected: 반투명 검정 테두리의 작은 창이 화면에 뜨고 "미요 위젯 (준비 중)" 텍스트가
보인다. 창 배경 바깥(모서리 바깥쪽)으로는 바탕화면이 그대로 비쳐야 한다. 창을
드래그로 옮길 수 있는지, 모서리로 크기를 조절할 수 있는지 확인한다. 확인 후
`Ctrl+C`로 종료.

- [ ] **Step 13: 커밋**

```bash
git add package.json native-widget
git commit -m "feat: native-widget Electron 프로젝트 뼈대 + 완전 투명 기본 창"
```

---

### Task 3: 시간표 렌더링 로직 포팅

**Files:**
- Create: `native-widget/src/types.ts`
- Create: `native-widget/src/lib/schedule.ts`
- Create: `native-widget/src/lib/schedule.test.ts`
- Create: `native-widget/src/lib/scheduleSlot.ts`
- Create: `native-widget/src/lib/scheduleSlot.test.ts`
- Create: `native-widget/src/lib/nonClassSubjects.ts`
- Create: `native-widget/src/lib/subjectColors.ts`

**Interfaces:**
- Produces: `getDayPhase(now, periodTimes, periodCount): DayPhase` (`schedule.ts`),
  `effectiveSlot(timetable, swapOverrides, date, period): PeriodSlot` and
  `toWeekday(ymd): number|null` (`scheduleSlot.ts`), `buildSubjectColors(timetable,
  overrides): Map<string, SubjectColor>` and `classColorKey(subject, className): string`
  (`subjectColors.ts`). Task 6의 `App.tsx`가 그대로 소비한다.

- [ ] **Step 1: `native-widget/src/types.ts` 작성**

`client/src/types.ts`에서 위젯에 필요한 부분만 최소로 가져온다:

```ts
export interface PeriodTime {
  start: string; // HH:mm
  end: string; // HH:mm
}

export interface PeriodSlot {
  subject: string;
  room: string;
}

/** 요일(1=월 ~ 5=금) → 교시별 과목/반 */
export type Timetable = Record<number, PeriodSlot[]>;

export interface CanceledLesson {
  date: string; // YYYY-MM-DD
  period: number;
}

export interface SwapOverride {
  date: string; // YYYY-MM-DD
  period: number;
  subject: string;
  room: string;
}

export interface MakeupLesson {
  date: string; // YYYY-MM-DD
  period: number;
  subject: string;
  room: string;
}

/** 서버 /api/data가 돌려주는 state 중 이 위젯이 실제로 쓰는 부분만 뽑은 타입.
 *  서버 응답은 이보다 필드가 훨씬 많지만(AppData), 구조적으로 호환된다. */
export interface WidgetData {
  timetable: Timetable;
  settings: {
    periodCount: number;
    periodTimes: PeriodTime[];
  };
  canceledLessons: CanceledLesson[];
  swapOverrides: SwapOverride[];
  makeupLessons: MakeupLesson[];
  subjectColors: Record<string, number>;
}
```

- [ ] **Step 2: 실패하는 테스트 작성 — `schedule.test.ts`**

`client/src/lib/schedule.test.ts`를 그대로 포팅:

```ts
import { describe, expect, test } from 'vitest';
import { getDayPhase } from './schedule';
import type { PeriodTime } from '../types';

const times: PeriodTime[] = [
  { start: '09:00', end: '09:50' },
  { start: '10:00', end: '10:50' },
];

describe('getDayPhase', () => {
  test('토요일은 주말', () => {
    expect(getDayPhase(new Date('2026-07-25T10:00'), times, 2).kind).toBe('weekend');
  });

  test('첫 교시 전은 일과 전', () => {
    expect(getDayPhase(new Date('2026-07-22T08:30'), times, 2).kind).toBe('before');
  });

  test('교시 시간 안이면 해당 교시', () => {
    expect(getDayPhase(new Date('2026-07-22T09:30'), times, 2)).toEqual({ kind: 'period', index: 0 });
  });

  test('교시 사이는 쉬는 시간이고 다음 교시를 가리킨다', () => {
    expect(getDayPhase(new Date('2026-07-22T09:55'), times, 2)).toEqual({ kind: 'break', nextIndex: 1 });
  });

  test('마지막 교시 후는 일과 후', () => {
    expect(getDayPhase(new Date('2026-07-22T11:30'), times, 2).kind).toBe('after');
  });

  test('periodCount로 교시 수를 제한한다', () => {
    expect(getDayPhase(new Date('2026-07-22T10:30'), times, 1).kind).toBe('after');
  });
});
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `npx vitest run src/lib/schedule.test.ts --root native-widget`
Expected: FAIL — `Cannot find module './schedule'`

- [ ] **Step 4: `native-widget/src/lib/schedule.ts` 작성**

`client/src/lib/schedule.ts`를 그대로 포팅(경로만 상대 `../types` 유지):

```ts
import type { PeriodTime } from '../types';

export type DayPhase =
  | { kind: 'weekend' }
  | { kind: 'before' }
  | { kind: 'period'; index: number }
  | { kind: 'break'; nextIndex: number }
  | { kind: 'after' };

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function getDayPhase(now: Date, periodTimes: PeriodTime[], periodCount: number): DayPhase {
  const day = now.getDay();
  if (day === 0 || day === 6) return { kind: 'weekend' };

  const times = periodTimes.slice(0, periodCount);
  if (times.length === 0) return { kind: 'after' };

  const nowMin = now.getHours() * 60 + now.getMinutes();
  if (nowMin < toMinutes(times[0].start)) return { kind: 'before' };

  for (let i = 0; i < times.length; i++) {
    if (nowMin >= toMinutes(times[i].start) && nowMin < toMinutes(times[i].end)) {
      return { kind: 'period', index: i };
    }
    const next = times[i + 1];
    if (next && nowMin >= toMinutes(times[i].end) && nowMin < toMinutes(next.start)) {
      return { kind: 'break', nextIndex: i + 1 };
    }
  }
  return { kind: 'after' };
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run src/lib/schedule.test.ts --root native-widget`
Expected: PASS (6 tests)

- [ ] **Step 6: 실패하는 테스트 작성 — `scheduleSlot.test.ts`**

```ts
import { describe, expect, test } from 'vitest';
import { effectiveSlot, toWeekday } from './scheduleSlot';
import type { SwapOverride, Timetable } from '../types';

const timetable: Timetable = {
  1: [{ subject: '수학', room: '3-1' }, { subject: '영어', room: '3-1' }],
};

describe('toWeekday', () => {
  test('평일은 1~5', () => {
    expect(toWeekday('2026-08-24')).toBe(1); // 월요일
  });
  test('주말은 null', () => {
    expect(toWeekday('2026-08-29')).toBe(null); // 토요일
  });
});

describe('effectiveSlot', () => {
  test('교환 기록이 없으면 반복 시간표를 그대로 돌려준다', () => {
    expect(effectiveSlot(timetable, [], '2026-08-24', 0)).toEqual({ subject: '수학', room: '3-1' });
  });

  test('그 날짜·교시에 교환 기록이 있으면 그것으로 덮어쓴다', () => {
    const overrides: SwapOverride[] = [{ date: '2026-08-24', period: 0, subject: '과학', room: '3-2' }];
    expect(effectiveSlot(timetable, overrides, '2026-08-24', 0)).toEqual({ subject: '과학', room: '3-2' });
  });

  test('주말 날짜는 빈 칸을 돌려준다', () => {
    expect(effectiveSlot(timetable, [], '2026-08-29', 0)).toEqual({ subject: '', room: '' });
  });
});
```

- [ ] **Step 7: 테스트 실패 확인**

Run: `npx vitest run src/lib/scheduleSlot.test.ts --root native-widget`
Expected: FAIL — `Cannot find module './scheduleSlot'`

- [ ] **Step 8: `native-widget/src/lib/scheduleSlot.ts` 작성**

`client/src/lib/subjectProgress.ts`에서 `toWeekday`/`effectiveSlot` 두 함수만 포팅한다
(위젯은 진도 계산이 필요 없어 나머지 함수는 가져오지 않는다):

```ts
import type { PeriodSlot, SwapOverride, Timetable } from '../types';

/** Date.getDay()(0=일~6=토)를 이 앱의 요일 표기(1=월~5=금)로. 주말이면 null. */
export function toWeekday(ymd: string): number | null {
  const dow = new Date(`${ymd}T00:00:00`).getDay();
  return dow >= 1 && dow <= 5 ? dow : null;
}

/** timetable(반복 패턴)과 swapOverrides(그 날짜만의 예외)를 합쳐, 특정 날짜·교시에
 *  실제로 보여줄 과목/반을 계산한다. */
export function effectiveSlot(
  timetable: Timetable,
  swapOverrides: SwapOverride[],
  date: string,
  period: number,
): PeriodSlot {
  const override = swapOverrides.find((o) => o.date === date && o.period === period);
  if (override) return { subject: override.subject, room: override.room };
  const weekday = toWeekday(date);
  if (weekday === null) return { subject: '', room: '' };
  return (timetable[weekday] ?? [])[period] ?? { subject: '', room: '' };
}
```

- [ ] **Step 9: 테스트 통과 확인**

Run: `npx vitest run src/lib/scheduleSlot.test.ts --root native-widget`
Expected: PASS (5 tests)

- [ ] **Step 10: `nonClassSubjects.ts`, `subjectColors.ts` 그대로 포팅(테스트 없음 — client에도 없음)**

`native-widget/src/lib/nonClassSubjects.ts`:

```ts
export const NON_CLASS_SUBJECTS = ['점심시간'];

export function isNonClassSubject(subject: string): boolean {
  return NON_CLASS_SUBJECTS.includes(subject.trim());
}
```

`native-widget/src/lib/subjectColors.ts`:

```ts
import type { Timetable } from '../types';
import { isNonClassSubject } from './nonClassSubjects';

export const SUBJECT_COLORS = [
  { bg: 'bg-mint-100', text: 'text-mint-800', dot: 'bg-mint-400', name: '민트' },
  { bg: 'bg-sky-100', text: 'text-sky-800', dot: 'bg-sky-400', name: '스카이' },
  { bg: 'bg-amber-100', text: 'text-amber-800', dot: 'bg-amber-400', name: '앰버' },
  { bg: 'bg-rose-100', text: 'text-rose-800', dot: 'bg-rose-400', name: '로즈' },
  { bg: 'bg-violet-100', text: 'text-violet-800', dot: 'bg-violet-400', name: '보라' },
  { bg: 'bg-teal-100', text: 'text-teal-800', dot: 'bg-teal-400', name: '틸' },
  { bg: 'bg-orange-100', text: 'text-orange-800', dot: 'bg-orange-400', name: '오렌지' },
  { bg: 'bg-fuchsia-100', text: 'text-fuchsia-800', dot: 'bg-fuchsia-400', name: '푸시아' },
] as const;

export interface SubjectColor {
  bg: string;
  text: string;
  dot: string;
  name: string;
}

export const NON_CLASS_COLOR: SubjectColor = {
  bg: 'bg-yellow-200',
  text: 'text-yellow-900',
  dot: 'bg-yellow-400',
  name: '점심',
};

export function classColorKey(subject: string, className: string): string {
  return `${subject.trim()}::${className.trim()}`;
}

export function buildSubjectColors(
  timetable: Timetable,
  overrides: Record<string, number> = {},
): Map<string, SubjectColor> {
  const map = new Map<string, SubjectColor>();
  const autoBySubject = new Map<string, SubjectColor>();
  let autoIndex = 0;
  for (const day of [1, 2, 3, 4, 5]) {
    for (const slot of timetable[day] ?? []) {
      const name = slot.subject.trim();
      if (!name) continue;
      const className = slot.room.trim();
      const key = classColorKey(name, className);
      if (map.has(key)) continue;

      if (isNonClassSubject(name)) {
        map.set(key, NON_CLASS_COLOR);
        continue;
      }

      const overrideIndex = overrides[key];
      if (overrideIndex !== undefined && SUBJECT_COLORS[overrideIndex]) {
        map.set(key, SUBJECT_COLORS[overrideIndex]);
        continue;
      }

      let autoColor = autoBySubject.get(name);
      if (!autoColor) {
        autoColor = SUBJECT_COLORS[autoIndex % SUBJECT_COLORS.length];
        autoBySubject.set(name, autoColor);
        autoIndex++;
      }
      map.set(key, autoColor);
    }
  }
  return map;
}
```

- [ ] **Step 11: 전체 native-widget 테스트 확인 + 커밋**

Run: `npm run test -w native-widget`
Expected: 모든 테스트 PASS (11 tests)

```bash
git add native-widget/src
git commit -m "feat: 시간표 렌더링 순수 로직을 native-widget에 이식"
```

---

### Task 4: PKCE + 구글 데스크톱 로그인 흐름

**Files:**
- Create: `native-widget/electron/pkce.js`
- Create: `native-widget/electron/pkce.test.js`
- Create: `native-widget/electron/auth.js`
- Modify: `native-widget/electron/main.js` (로그인 IPC 핸들러 추가)
- Modify: `native-widget/electron/preload.js` (로그인 API 노출)
- Create: `native-widget/.env.example`

**Interfaces:**
- Consumes: 없음(이 태스크가 첫 로그인 관련 코드).
- Produces: `electron/pkce.js`의 `generateCodeVerifier(): string`,
  `codeChallengeFromVerifier(verifier: string): string`. `electron/auth.js`의
  `login(): Promise<{token,user}>`, `saveToken(token)`, `loadToken(): string|null`,
  `clearToken()`. `window.miyo.getAuthState()`, `window.miyo.login()`,
  `window.miyo.logout()` (렌더러에서 호출 — Task 6에서 사용).

- [ ] **Step 1: 실패하는 테스트 작성 — `pkce.test.js`**

```js
import { describe, expect, test } from 'vitest';
import { generateCodeVerifier, codeChallengeFromVerifier } from './pkce';

describe('pkce', () => {
  test('generateCodeVerifier는 43자 이상의 base64url 문자열을 만든다', () => {
    const v = generateCodeVerifier();
    expect(v.length).toBeGreaterThanOrEqual(43);
    expect(v).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  test('호출할 때마다 다른 verifier를 만든다', () => {
    expect(generateCodeVerifier()).not.toBe(generateCodeVerifier());
  });

  test('같은 verifier는 항상 같은 challenge를 만든다', () => {
    const v = generateCodeVerifier();
    expect(codeChallengeFromVerifier(v)).toBe(codeChallengeFromVerifier(v));
  });

  test('다른 verifier는 다른 challenge를 만든다', () => {
    expect(codeChallengeFromVerifier('aaaa')).not.toBe(codeChallengeFromVerifier('bbbb'));
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run electron/pkce.test.js --root native-widget`
Expected: FAIL — `Cannot find module './pkce'`

- [ ] **Step 3: `native-widget/electron/pkce.js` 작성**

```js
const crypto = require('node:crypto');

function base64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function generateCodeVerifier() {
  return base64url(crypto.randomBytes(64));
}

function codeChallengeFromVerifier(verifier) {
  return base64url(crypto.createHash('sha256').update(verifier).digest());
}

module.exports = { generateCodeVerifier, codeChallengeFromVerifier, base64url };
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run electron/pkce.test.js --root native-widget`
Expected: PASS (4 tests)

- [ ] **Step 5: `native-widget/.env.example` 작성**

로컬 개발 시 `native-widget/.env`로 복사해서 쓴다(Electron은 `dotenv`로 이 값을
읽는다 — Step 6에서 `main.js`에 로딩 코드 추가):

```
# planner 서버 주소(로컬 개발은 로컬 서버, 배포 후엔 실제 도메인으로 바꾼다)
MIYO_SERVER_URL=http://localhost:3001
# 서버의 .env에 등록한 GOOGLE_DESKTOP_CLIENT_ID와 반드시 같은 값이어야 한다.
MIYO_GOOGLE_DESKTOP_CLIENT_ID=
```

- [ ] **Step 6: `native-widget/electron/auth.js` 작성**

```js
const { app, shell, safeStorage } = require('electron');
const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { generateCodeVerifier, codeChallengeFromVerifier } = require('./pkce');

function serverUrl() {
  return process.env.MIYO_SERVER_URL || 'http://localhost:3001';
}
function desktopClientId() {
  return process.env.MIYO_GOOGLE_DESKTOP_CLIENT_ID || '';
}

function tokenFilePath() {
  return path.join(app.getPath('userData'), 'session.token');
}

function saveToken(token) {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('이 컴퓨터에서는 로그인 정보를 안전하게 저장할 수 없습니다.');
  fs.writeFileSync(tokenFilePath(), safeStorage.encryptString(token));
}

function loadToken() {
  try {
    return safeStorage.decryptString(fs.readFileSync(tokenFilePath()));
  } catch {
    return null;
  }
}

function clearToken() {
  try { fs.unlinkSync(tokenFilePath()); } catch { /* 이미 없으면 무시 */ }
}

/** 루프백 서버를 열어 구글 로그인 리디렉션을 받고, 성공하면 세션 토큰을 저장한다. */
function login() {
  return new Promise((resolve, reject) => {
    const verifier = generateCodeVerifier();
    const challenge = codeChallengeFromVerifier(verifier);
    const state = crypto.randomBytes(16).toString('hex');
    let settled = false;

    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1');
      if (url.pathname !== '/callback') { res.writeHead(404); res.end(); return; }

      const code = url.searchParams.get('code');
      const returnedState = url.searchParams.get('state');
      const err = url.searchParams.get('error');

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<html><body style="font-family:sans-serif;padding:40px"><h2>로그인 완료</h2><p>이 창은 닫아도 됩니다.</p></body></html>');

      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      server.close();

      if (err || !code || returnedState !== state) {
        reject(new Error('로그인이 취소되었거나 실패했습니다.'));
        return;
      }
      try {
        const redirectUri = `http://127.0.0.1:${port}/callback`;
        const resp = await fetch(`${serverUrl()}/api/auth/native-login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, redirectUri, codeVerifier: verifier }),
        });
        const body = await resp.json();
        if (!resp.ok) throw new Error(body.error || '로그인에 실패했습니다.');
        saveToken(body.token);
        resolve(body);
      } catch (e) {
        reject(e);
      }
    });

    let port;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      server.close();
      reject(new Error('로그인 시간이 초과되었습니다.'));
    }, 60_000);

    server.listen(0, '127.0.0.1', () => {
      port = server.address().port;
      const redirectUri = `http://127.0.0.1:${port}/callback`;
      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.searchParams.set('client_id', desktopClientId());
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', 'openid email profile');
      authUrl.searchParams.set('code_challenge', challenge);
      authUrl.searchParams.set('code_challenge_method', 'S256');
      authUrl.searchParams.set('state', state);
      authUrl.searchParams.set('access_type', 'offline');
      authUrl.searchParams.set('prompt', 'consent');
      shell.openExternal(authUrl.toString());
    });
  });
}

module.exports = { login, saveToken, loadToken, clearToken };
```

- [ ] **Step 7: `main.js`에 `dotenv` 로딩 + 로그인 IPC 핸들러 추가**

`native-widget/electron/main.js` 최상단(`const { app, BrowserWindow } = ...` 위)에 추가:

```js
require('dotenv').config({ path: require('node:path').join(__dirname, '../.env') });
```

`native-widget/package.json`의 `dependencies`에 `dotenv` 추가: `"dotenv": "^16.4.7"`.

`main.js`의 import 목록을 수정:

```js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const { loadWindowBounds, saveWindowBounds } = require('./windowBounds');
const auth = require('./auth');
```

`createWindow()` 함수 아래, `app.whenReady().then(createWindow);` 줄을 아래로 교체:

```js
async function handleLogin() {
  try {
    const result = await auth.login();
    return { ok: true, user: result.user };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

ipcMain.handle('miyo:getAuthState', () => ({ loggedIn: Boolean(auth.loadToken()) }));
ipcMain.handle('miyo:login', handleLogin);
ipcMain.handle('miyo:logout', () => {
  auth.clearToken();
  return { ok: true };
});

app.whenReady().then(createWindow);
```

- [ ] **Step 8: `preload.js`에 로그인 API 노출**

`native-widget/electron/preload.js` 전체를 교체:

```js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('miyo', {
  getAuthState: () => ipcRenderer.invoke('miyo:getAuthState'),
  login: () => ipcRenderer.invoke('miyo:login'),
  logout: () => ipcRenderer.invoke('miyo:logout'),
});
```

- [ ] **Step 9: 전체 native-widget 테스트 확인**

Run: `npm run test -w native-widget`
Expected: 모든 테스트 PASS (15 tests)

- [ ] **Step 10: 수동 확인**

`native-widget/.env.example`을 `native-widget/.env`로 복사하고
`MIYO_GOOGLE_DESKTOP_CLIENT_ID`를 채운다(구글 클라우드 콘솔에서 "데스크톱 앱" 타입
클라이언트를 새로 만들어야 함 — 이 단계는 실제 착수 시 사용자에게 단계별로 안내).
서버 `.env`에도 `GOOGLE_DESKTOP_CLIENT_ID`/`GOOGLE_DESKTOP_CLIENT_SECRET`을 채운다.

```bash
npm run dev -w server   # 로컬 서버 실행
npm run dev -w native-widget
```

개발자 도구(Electron 창에서 `Ctrl+Shift+I`)의 콘솔에서 직접 실행:
`await window.miyo.login()` → 기본 브라우저가 열리고 구글 로그인 → 로그인 후
"로그인 완료" 안내 페이지가 뜨는지, 콘솔에 `{ ok: true, user: {...} }`가 찍히는지,
`await window.miyo.getAuthState()`가 `{ loggedIn: true }`를 돌려주는지 확인한다.

- [ ] **Step 11: 커밋**

```bash
git add native-widget package.json package-lock.json
git commit -m "feat: native-widget에 구글 데스크톱 로그인(PKCE 루프백) 흐름 추가"
```

---

### Task 5: 시간표 데이터 가져오기 + IPC

**Files:**
- Create: `native-widget/electron/dataFetch.js`
- Modify: `native-widget/electron/main.js` (폴링 + IPC 추가)
- Modify: `native-widget/electron/preload.js` (getAppData/onAppDataUpdated 추가)

**Interfaces:**
- Consumes: `auth.loadToken()` (Task 4).
- Produces: `dataFetch.js`의 `fetchAppData(token): Promise<{ok,offline,data,error?}>`.
  `window.miyo.getAppData(): Promise<AppDataResult>`,
  `window.miyo.onAppDataUpdated(cb): () => void` (Task 6에서 사용).

- [ ] **Step 1: `native-widget/electron/dataFetch.js` 작성**

```js
const fs = require('node:fs');
const path = require('node:path');
const { app } = require('electron');

function serverUrl() {
  return process.env.MIYO_SERVER_URL || 'http://localhost:3001';
}

function cacheFilePath() {
  return path.join(app.getPath('userData'), 'last-data.json');
}

function saveCache(data) {
  fs.writeFileSync(cacheFilePath(), JSON.stringify(data));
}

function loadCache() {
  try {
    return JSON.parse(fs.readFileSync(cacheFilePath(), 'utf-8'));
  } catch {
    return null;
  }
}

/** 서버에서 오늘의 시간표 데이터를 가져온다. 실패하면 마지막 캐시를 돌려준다. */
async function fetchAppData(token) {
  try {
    const res = await fetch(`${serverUrl()}/api/data`, {
      headers: { Cookie: `session=${token}` },
    });
    if (!res.ok) throw new Error(`서버 응답 오류: ${res.status}`);
    const body = await res.json();
    saveCache(body.state);
    return { ok: true, offline: false, data: body.state };
  } catch (e) {
    const cached = loadCache();
    return { ok: Boolean(cached), offline: true, data: cached, error: e.message };
  }
}

module.exports = { fetchAppData };
```

- [ ] **Step 2: `main.js`에 폴링 + IPC 추가**

import 줄에 추가:

```js
const { fetchAppData } = require('./dataFetch');
```

`handleLogin`/IPC 핸들러들 근처(같은 블록)에 추가:

```js
let pollTimer = null;

async function refreshAppData() {
  const token = auth.loadToken();
  if (!token) return { ok: false, offline: true, data: null, error: '로그인이 필요합니다.' };
  const result = await fetchAppData(token);
  if (mainWindow) mainWindow.webContents.send('miyo:appDataUpdated', result);
  return result;
}

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(refreshAppData, 5 * 60 * 1000);
}

ipcMain.handle('miyo:getAppData', () => refreshAppData());
```

`handleLogin` 함수를 수정해 로그인 성공 시 폴링을 시작하고 즉시 한 번 데이터를
가져오게 한다:

```js
async function handleLogin() {
  try {
    const result = await auth.login();
    startPolling();
    await refreshAppData();
    return { ok: true, user: result.user };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
```

`createWindow()` 함수 안, `if (isDev) mainWindow.loadURL(...)` 다음 줄에 포커스 시
새로고침을 추가:

```js
  mainWindow.on('focus', () => { if (auth.loadToken()) void refreshAppData(); });
```

`app.whenReady().then(createWindow);`를 아래로 교체해, 앱을 켤 때 이미 로그인돼
있으면 곧바로 폴링을 시작한다:

```js
app.whenReady().then(async () => {
  createWindow();
  if (auth.loadToken()) {
    startPolling();
    await refreshAppData();
  }
});
```

- [ ] **Step 3: `preload.js`에 데이터 API 추가**

`native-widget/electron/preload.js`의 `contextBridge.exposeInMainWorld('miyo', {...})`
객체에 추가:

```js
  getAppData: () => ipcRenderer.invoke('miyo:getAppData'),
  onAppDataUpdated: (callback) => {
    const listener = (_event, result) => callback(result);
    ipcRenderer.on('miyo:appDataUpdated', listener);
    return () => ipcRenderer.removeListener('miyo:appDataUpdated', listener);
  },
```

- [ ] **Step 4: 수동 확인**

```bash
npm run dev -w server
npm run dev -w native-widget
```

개발자 도구 콘솔에서 로그인 후(Task 4 방식) `await window.miyo.getAppData()`를 호출해
`{ ok: true, offline: false, data: { timetable: {...}, settings: {...}, ... } }` 형태가
나오는지 확인한다. 서버를 잠깐 끄고(`Ctrl+C`) 다시 호출해 `{ ok: true, offline: true,
data: <직전 캐시> }`가 나오는지도 확인한다.

- [ ] **Step 5: 커밋**

```bash
git add native-widget
git commit -m "feat: native-widget이 서버 시간표 데이터를 폴링해 가져오게 함"
```

---

### Task 6: 위젯 화면 완성 (로그인 화면 + 오늘의 시간표)

**Files:**
- Create: `native-widget/src/miyo.d.ts`
- Modify: `native-widget/src/App.tsx` (전체 교체)

**Interfaces:**
- Consumes: `window.miyo.getAuthState/login/logout/getAppData/onAppDataUpdated`
  (Task 4, 5), `getDayPhase`(Task 3 `schedule.ts`), `effectiveSlot`(Task 3
  `scheduleSlot.ts`), `buildSubjectColors`/`classColorKey`(Task 3 `subjectColors.ts`),
  `WidgetData`(Task 3 `types.ts`).

- [ ] **Step 1: `native-widget/src/miyo.d.ts` 작성**

```ts
import type { WidgetData } from './types';

export interface AuthState {
  loggedIn: boolean;
}

export interface LoginResult {
  ok: boolean;
  user?: { email: string | null; name: string | null };
  error?: string;
}

export interface AppDataResult {
  ok: boolean;
  offline: boolean;
  data: WidgetData | null;
  error?: string;
}

declare global {
  interface Window {
    miyo: {
      getAuthState: () => Promise<AuthState>;
      login: () => Promise<LoginResult>;
      logout: () => Promise<{ ok: boolean }>;
      getAppData: () => Promise<AppDataResult>;
      onAppDataUpdated: (callback: (result: AppDataResult) => void) => () => void;
    };
  }
}

export {};
```

- [ ] **Step 2: `native-widget/src/App.tsx` 전체 교체**

```tsx
import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { getDayPhase } from './lib/schedule';
import { effectiveSlot } from './lib/scheduleSlot';
import { buildSubjectColors, classColorKey } from './lib/subjectColors';
import type { AppDataResult } from './miyo';

const dragStyle = { WebkitAppRegion: 'drag' } as React.CSSProperties;
const noDragStyle = { WebkitAppRegion: 'no-drag' } as React.CSSProperties;

export default function App() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [loginError, setLoginError] = useState('');
  const [result, setResult] = useState<AppDataResult | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    void window.miyo.getAuthState().then((s) => setLoggedIn(s.loggedIn));
  }, []);

  useEffect(() => {
    if (!loggedIn) return;
    void window.miyo.getAppData().then(setResult);
    return window.miyo.onAppDataUpdated(setResult);
  }, [loggedIn]);

  async function handleLogin() {
    setLoginError('');
    const res = await window.miyo.login();
    if (res.ok) setLoggedIn(true);
    else setLoginError(res.error || '로그인에 실패했어요.');
  }

  if (loggedIn === null) {
    return (
      <div style={dragStyle} className="flex h-screen items-center justify-center text-xs text-white/70">
        불러오는 중...
      </div>
    );
  }

  if (!loggedIn) {
    return (
      <div style={dragStyle} className="flex h-screen flex-col items-center justify-center gap-3 rounded-2xl bg-black/30 p-4 text-center">
        <p className="text-sm font-semibold text-white drop-shadow">로그인이 필요해요</p>
        <button
          type="button"
          style={noDragStyle}
          onClick={handleLogin}
          className="rounded-xl bg-mint-500 px-4 py-2 text-xs font-semibold text-white hover:bg-mint-600"
        >
          구글로 로그인
        </button>
        {loginError && <p className="text-[11px] text-rose-200">{loginError}</p>}
      </div>
    );
  }

  const data = result?.data;
  if (!data) {
    return (
      <div style={dragStyle} className="flex h-screen items-center justify-center text-xs text-white/70 drop-shadow">
        데이터를 불러오는 중...
      </div>
    );
  }

  const { settings, timetable, swapOverrides, canceledLessons, makeupLessons, subjectColors } = data;
  const phase = getDayPhase(now, settings.periodTimes, settings.periodCount);
  const todayKey = format(now, 'yyyy-MM-dd');
  const colors = buildSubjectColors(timetable, subjectColors);

  let shortMessage = '';
  if (phase.kind === 'weekend') shortMessage = '주말이에요. 편안한 하루 보내세요.';
  else if (phase.kind === 'before') shortMessage = `아직 일과 전이에요. ${settings.periodTimes[0]?.start ?? ''}에 시작해요.`;
  else if (phase.kind === 'after') shortMessage = '오늘 일과가 끝났어요. 수고하셨어요!';

  return (
    <div className="flex h-screen flex-col p-1 text-white">
      <div style={dragStyle} className="mb-1 flex shrink-0 items-center justify-between px-2 py-1">
        <p className="text-sm font-bold drop-shadow">{format(now, 'M월 d일 (EEE)', { locale: ko })}</p>
        {result?.offline && <span className="text-[10px] text-amber-300">● 오프라인</span>}
      </div>

      {shortMessage ? (
        <p className="flex flex-1 items-center justify-center text-center text-sm text-white/90 drop-shadow">
          {shortMessage}
        </p>
      ) : (
        <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto px-1">
          {Array.from({ length: settings.periodCount }, (_, i) => {
            const slot = effectiveSlot(timetable, swapOverrides, todayKey, i);
            const isCanceled = canceledLessons.some((c) => c.date === todayKey && c.period === i);
            const makeup = makeupLessons.find((m) => m.date === todayKey && m.period === i);
            const isCurrent = phase.kind === 'period' && phase.index === i;
            const time = settings.periodTimes[i];
            const color = slot.subject.trim() ? colors.get(classColorKey(slot.subject, slot.room)) : undefined;
            return (
              <li
                key={i}
                className={`flex items-center gap-2 rounded-xl px-2 py-1.5 ${isCurrent ? 'bg-white/25 ring-1 ring-white/40' : ''}`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold ${
                    isCurrent ? 'bg-mint-500 text-white' : 'bg-white/20 text-white/80'
                  }`}
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className={`truncate text-sm font-medium drop-shadow ${
                      isCanceled ? 'text-white/50 line-through' : color ? color.text : 'text-white'
                    }`}
                  >
                    {slot.subject || '미배정'}
                    {slot.room ? ` · ${slot.room}` : ''}
                  </p>
                  {makeup && (
                    <p className="truncate text-[11px] font-medium text-violet-200">
                      보강 · {makeup.subject}
                      {makeup.room ? ` ${makeup.room}` : ''}
                    </p>
                  )}
                </div>
                <span className="shrink-0 text-[11px] text-white/70">
                  {time?.start}~{time?.end}
                </span>
                {isCanceled && (
                  <span className="shrink-0 rounded bg-white/30 px-1 text-[9px] font-bold text-white">휴강</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
```

`color.text`(예: `text-mint-800`)는 원래 밝은 카드 배경 위에서 쓰던 어두운 글자색이라
완전 투명 배경 위에서는 `drop-shadow`와 함께라도 읽기 불편할 수 있다 — Task 6
수동 확인 단계에서 실제 바탕화면 위에 띄워보고, 너무 안 읽히면 `subjectColors.ts`의
`text` 값들을 밝은 톤(`text-*-100`~`text-*-200`)으로 조정한다(이 판단은 실제 화면을
보고 하므로 지금 코드로 확정하지 않는다).

- [ ] **Step 3: 타입 체크**

Run: `npx tsc --noEmit -p native-widget`
Expected: 에러 없음

- [ ] **Step 4: 수동 확인**

```bash
npm run dev -w server
npm run dev -w native-widget
```

로그인 전: "로그인이 필요해요" + 버튼이 투명 배경 위에 보이는지. 로그인 버튼 클릭 →
로그인 흐름(Task 4) → 로그인 후 자동으로 오늘의 시간표가 표시되는지. 창을 다른
프로그램(메모장, 브라우저 등) 위로 옮겨서 뒤 배경이 실제로 비치는지, 글자가
읽을만한지 확인한다. 서버를 껐다 켜서 5분 폴링과 "● 오프라인" 표시가 동작하는지도
(5분은 오래 걸리므로, `main.js`의 `5 * 60 * 1000`을 잠깐 `5000`으로 바꿔 확인한 뒤
원복해도 된다).

- [ ] **Step 5: 커밋**

```bash
git add native-widget
git commit -m "feat: native-widget 로그인 화면과 오늘의 시간표 화면 완성"
```

---

### Task 7: 트레이 아이콘 + 자동 실행

**Files:**
- Create: `native-widget/electron/assets/tray-icon.png`
- Modify: `native-widget/electron/main.js`

**Interfaces:**
- Consumes: `auth.loadToken/clearToken`(Task 4), `refreshAppData`/`startPolling`(Task 5).

- [ ] **Step 1: 트레이 아이콘 placeholder 생성**

```bash
mkdir -p native-widget/electron/assets
node -e "require('fs').writeFileSync('native-widget/electron/assets/tray-icon.png', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAG0lEQVR4AWP4z8DwHwOZ0AqDmZWQAcFxYP8HANLKxN4G6R5XAAAAAElFTkSuQmCC', 'base64'))"
```

Expected: `native-widget/electron/assets/tray-icon.png` 파일이 생성됨(16x16 아이콘
placeholder — 나중에 실제 아이콘으로 교체 가능).

- [ ] **Step 2: `main.js`에 트레이 + 자동 실행 추가**

import 줄을 수정:

```js
const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require('electron');
```

`createWindow()` 함수의 `mainWindow.on('close', persistBounds);` 다음 줄을 아래로
교체(창을 닫아도 종료하지 않고 숨긴다):

```js
  mainWindow.on('close', (e) => {
    persistBounds();
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
```

파일 하단, `app.whenReady().then(async () => {...})` 블록을 아래로 교체:

```js
let tray = null;

function updateTrayMenu() {
  const loggedIn = Boolean(auth.loadToken());
  const openAtLogin = app.getLoginItemSettings().openAtLogin;
  tray.setContextMenu(Menu.buildFromTemplate([
    {
      label: mainWindow?.isVisible() ? '위젯 숨기기' : '위젯 보이기',
      click: () => mainWindow && (mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show()),
    },
    { type: 'separator' },
    loggedIn
      ? { label: '로그아웃', click: () => { auth.clearToken(); updateTrayMenu(); } }
      : { label: '로그인', click: () => void handleLogin().then(updateTrayMenu) },
    {
      label: '윈도우 시작 시 자동 실행',
      type: 'checkbox',
      checked: openAtLogin,
      click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }),
    },
    { type: 'separator' },
    { label: '종료', click: () => { app.isQuitting = true; app.quit(); } },
  ]));
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'assets/tray-icon.png'));
  tray = new Tray(icon);
  tray.setToolTip('미요 오늘의 시간표');
  tray.on('click', () => {
    if (!mainWindow) return;
    mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
  });
  updateTrayMenu();
}

app.whenReady().then(async () => {
  createWindow();
  createTray();
  if (auth.loadToken()) {
    app.setLoginItemSettings({ openAtLogin: true });
    startPolling();
    await refreshAppData();
  }
});
```

`handleLogin` 함수도 로그인 성공 시 트레이 메뉴를 갱신하고 처음 로그인이면 자동
실행을 켜도록 수정:

```js
async function handleLogin() {
  try {
    const result = await auth.login();
    app.setLoginItemSettings({ openAtLogin: true });
    startPolling();
    await refreshAppData();
    if (tray) updateTrayMenu();
    return { ok: true, user: result.user };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
```

기존 `app.on('window-all-closed', ...)` 블록은 이제 트레이가 창을 관리하므로
전체를 삭제한다(창을 닫아도 트레이에 상주해야 하므로 더 이상 필요 없음).

- [ ] **Step 3: 수동 확인**

```bash
npm run dev -w native-widget
```

트레이 아이콘이 작업표시줄 알림영역에 나타나는지, 좌클릭으로 위젯이 숨겨졌다
보였다 하는지, 우클릭 메뉴에서 "위젯 숨기기/보이기", "로그인/로그아웃", "윈도우
시작 시 자동 실행", "종료"가 모두 동작하는지 확인한다. 위젯 창의 X 버튼이 따로
없으므로(frame:false) 트레이의 "종료"로만 완전히 끌 수 있는지도 확인한다.

- [ ] **Step 4: 커밋**

```bash
git add native-widget
git commit -m "feat: native-widget에 트레이 아이콘과 윈도우 자동 실행 추가"
```

---

### Task 8: 패키징 (electron-builder) + 설치 안내

**Files:**
- Create: `native-widget/electron-builder.yml`
- Create: `native-widget/README.md`

**Interfaces:**
- Consumes: Task 1~7의 완성된 `native-widget/` 전체.

- [ ] **Step 1: `native-widget/electron-builder.yml` 작성**

```yaml
appId: com.miyo.native-widget
productName: 미요 오늘의 시간표
directories:
  output: release
files:
  - dist/**
  - electron/**
  - package.json
  - '!electron/*.test.js'
win:
  target: nsis
nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  perMachine: false
```

`!electron/*.test.js`로 테스트 파일은 패키지에서 제외한다. 아이콘은 지정하지 않아
electron-builder 기본 아이콘을 쓴다(추후 실제 아이콘으로 교체 가능 — 이번 범위 밖).

- [ ] **Step 2: `native-widget/README.md` 작성**

```markdown
# 미요 오늘의 시간표 (네이티브 위젯)

바탕화면에 완전 투명 배경으로 오늘의 시간표를 띄워주는 Windows 프로그램입니다.

## 설치

1. `release/` 폴더의 설치 파일(.exe)을 실행합니다.
2. "Windows에서 PC를 보호했습니다"라는 파란 경고창이 뜰 수 있습니다 — 저희가 만든
   프로그램이 맞으니 **"추가 정보" 클릭 → "실행" 클릭**으로 넘어가면 됩니다(유료
   인증서를 구매하지 않아 뜨는 안내이며, 프로그램 자체에는 문제가 없습니다).
3. 설치가 끝나면 프로그램이 자동으로 실행되고, 작업표시줄 알림영역(트레이)에
   아이콘이 나타납니다.
4. 위젯의 "구글로 로그인" 버튼을 눌러 로그인하면 오늘의 시간표가 보입니다. 다음부터는
   자동으로 로그인된 채로 실행됩니다.

## 사용법

- 위젯을 마우스로 드래그하면 위치를 옮길 수 있고, 모서리를 드래그하면 크기를 조절할
  수 있습니다.
- 트레이 아이콘을 좌클릭하면 위젯을 숨기거나 다시 보이게 할 수 있습니다.
- 트레이 아이콘을 우클릭하면 로그아웃, 자동 실행 끄기/켜기, 종료를 할 수 있습니다.

## 개발자용: 빌드 방법

```bash
cd native-widget
npm install
npm run build
```

`release/` 폴더에 설치 파일이 생성됩니다.
```

- [ ] **Step 3: 빌드 확인**

```bash
cd native-widget
npm run build
```

Expected: 타입 체크·빌드 통과 후 `native-widget/release/` 폴더에 `.exe` 설치 파일이
생성됨. 파일 탐색기에서 이 설치 파일을 더블클릭해 실제로 설치가 진행되는지,
SmartScreen 경고가 README 안내대로 뜨는지 확인한다.

- [ ] **Step 4: 커밋**

```bash
git add native-widget/electron-builder.yml native-widget/README.md native-widget/package.json native-widget/package-lock.json
git commit -m "feat: native-widget electron-builder 패키징 설정과 설치 안내 추가"
```

`native-widget/release/`, `native-widget/dist/`, `native-widget/node_modules/`는 빌드
산출물/의존성이므로 저장소 루트 `.gitignore`에 이미 있는 `dist/`·`node_modules/`
패턴에 걸리는지 확인하고, 걸리지 않으면 루트 `.gitignore`에
`native-widget/release/`를 추가한다.
