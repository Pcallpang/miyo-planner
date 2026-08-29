# 오늘의 시간표 — 바탕화면 위젯(팝업 미니 창) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 환경 설정에서 "위젯 열기"를 누르면 오늘의 시간표만 담긴 작은 팝업 창이 뜨고,
크기는 드래그로, 배경 진하기는 위젯 안 슬라이더로 조절할 수 있게 만든다.

**Architecture:** 새 라우터 없이 URL 쿼리 `?widget=1`로 위젯 모드를 구분한다. 팝업 창도
같은 오리진을 열어 기존 로그인 세션(`DataProvider`/`AppProvider`)을 그대로 공유하므로
별도 인증이 필요 없다. `App.tsx`가 위젯 모드면 `Sidebar`/`Header` 없이 `WidgetView` 하나만
렌더한다.

**Tech Stack:** React 19 + TypeScript(Vite), Tailwind CSS v4, Vitest(클라이언트 순수 함수
단위 테스트 — `client/src/lib/*.test.ts` 관례를 따른다).

## Global Constraints

- 참조 스펙: `docs/superpowers/specs/2026-08-29-desktop-widget-design.md`
- "투명도"는 위젯 카드 배경의 진하기일 뿐, 실제 창 투명도가 아니다(이미 사용자와 합의됨).
- 위젯 내용은 오늘의 시간표만(달력 제외), 학사일정 기반 자동 휴강은 이번 범위 제외(수동
  휴강만 반영).
- 클라이언트 순수 함수는 `client/src/lib/*.test.ts`(Vitest)로 테스트한다 — 이 저장소에는
  `vitest.config`가 따로 없고 jsdom도 설치돼 있지 않으므로, `localStorage`가 필요한
  테스트는 파일 안에서 직접 메모리 스토리지를 만들어 `globalThis.localStorage`에
  주입한다(새 devDependency 추가하지 않는다).
- 컴포넌트(뷰) 자체는 이 프로젝트 관례상 자동 테스트가 없다 — `npx tsc --noEmit` +
  `npm run build` + 개발 서버에서 직접 확인으로 검증한다.
- `client/`에서 명령을 실행할 때는 그 디렉터리로 이동한 뒤 실행한다.

---

### Task 1: `widgetPrefs.ts` — 위젯 크기·배경 진하기 저장/조회

**Files:**
- Create: `client/src/lib/widgetPrefs.ts`
- Test: `client/src/lib/widgetPrefs.test.ts`

**Interfaces:**
- Produces: `WidgetSize { width: number; height: number }`, `getWidgetOpacity(): number`,
  `setWidgetOpacity(value: number): void`, `getWidgetSize(): WidgetSize`,
  `setWidgetSize(size: WidgetSize): void`. Task 3(`WidgetView.tsx`)과 Task 5
  (`SettingsView.tsx`)이 이 4개 함수와 `WidgetSize` 타입을 그대로 가져다 쓴다.

- [ ] **Step 1: 실패하는 테스트 작성**

`client/src/lib/widgetPrefs.test.ts`:

```ts
import { beforeEach, describe, expect, test } from 'vitest';
import { getWidgetOpacity, getWidgetSize, setWidgetOpacity, setWidgetSize } from './widgetPrefs';

/** 이 저장소는 jsdom을 안 쓰므로, localStorage를 흉내 내는 메모리 저장소를 직접 만든다. */
function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
}

beforeEach(() => {
  (globalThis as unknown as { localStorage: Storage }).localStorage = createMemoryStorage();
});

describe('getWidgetOpacity / setWidgetOpacity', () => {
  test('저장된 값이 없으면 기본값 100을 반환한다', () => {
    expect(getWidgetOpacity()).toBe(100);
  });

  test('저장한 값을 그대로 돌려준다', () => {
    setWidgetOpacity(40);
    expect(getWidgetOpacity()).toBe(40);
  });

  test('0~100 범위를 벗어나면 반올림·경계값으로 자른다', () => {
    setWidgetOpacity(150);
    expect(getWidgetOpacity()).toBe(100);
    setWidgetOpacity(-20);
    expect(getWidgetOpacity()).toBe(0);
    setWidgetOpacity(55.6);
    expect(getWidgetOpacity()).toBe(56);
  });

  test('저장된 값이 깨져 있으면 기본값으로 되돌아간다', () => {
    localStorage.setItem('haru.widget.opacity', 'not-a-number');
    expect(getWidgetOpacity()).toBe(100);
  });
});

describe('getWidgetSize / setWidgetSize', () => {
  test('저장된 값이 없으면 기본 크기(320x420)를 반환한다', () => {
    expect(getWidgetSize()).toEqual({ width: 320, height: 420 });
  });

  test('저장한 크기를 그대로 돌려준다', () => {
    setWidgetSize({ width: 400, height: 500 });
    expect(getWidgetSize()).toEqual({ width: 400, height: 500 });
  });

  test('저장된 값이 깨져 있으면 기본 크기로 되돌아간다', () => {
    localStorage.setItem('haru.widget.size', '{ broken json');
    expect(getWidgetSize()).toEqual({ width: 320, height: 420 });
  });
});
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `cd client && npx vitest run src/lib/widgetPrefs.test.ts`
Expected: FAIL — `widgetPrefs.ts` 파일이 없어서 import 에러.

- [ ] **Step 3: 최소 구현 작성**

`client/src/lib/widgetPrefs.ts`:

```ts
/** 위젯 창의 배경 진하기(0~100)와 마지막으로 조절한 창 크기를 localStorage에
 *  기억해 뒀다가, 다음에 위젯을 열 때 그대로 되살린다. */

const OPACITY_KEY = 'haru.widget.opacity';
const SIZE_KEY = 'haru.widget.size';

const DEFAULT_OPACITY = 100;
const DEFAULT_SIZE: WidgetSize = { width: 320, height: 420 };

export interface WidgetSize {
  width: number;
  height: number;
}

export function getWidgetOpacity(): number {
  const raw = localStorage.getItem(OPACITY_KEY);
  const n = raw === null ? NaN : Number(raw);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : DEFAULT_OPACITY;
}

export function setWidgetOpacity(value: number): void {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  localStorage.setItem(OPACITY_KEY, String(clamped));
}

export function getWidgetSize(): WidgetSize {
  const raw = localStorage.getItem(SIZE_KEY);
  if (!raw) return DEFAULT_SIZE;
  try {
    const parsed = JSON.parse(raw) as Partial<WidgetSize>;
    if (
      typeof parsed.width === 'number' &&
      typeof parsed.height === 'number' &&
      parsed.width > 0 &&
      parsed.height > 0
    ) {
      return { width: parsed.width, height: parsed.height };
    }
  } catch {
    /* 깨진 JSON이면 기본값으로 */
  }
  return DEFAULT_SIZE;
}

export function setWidgetSize(size: WidgetSize): void {
  localStorage.setItem(SIZE_KEY, JSON.stringify(size));
}
```

- [ ] **Step 4: 테스트 실행해서 통과 확인**

Run: `cd client && npx vitest run src/lib/widgetPrefs.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/widgetPrefs.ts client/src/lib/widgetPrefs.test.ts
git commit -m "feat: 위젯 배경 진하기·창 크기 기억용 widgetPrefs 유틸 추가"
```

---

### Task 2: `DataContext`에 `refetch()` 추가

**Files:**
- Modify: `client/src/context/DataContext.tsx`

**Interfaces:**
- Consumes: 없음(기존 파일 리팩터링).
- Produces: `DataValue.refetch: () => Promise<void>` — `useData()`로 어디서든 호출 가능.
  Task 3(`WidgetView.tsx`)가 이 함수를 소비한다.

기존 마운트 이펙트 안에 있던 로드 로직을 함수로 뽑아 재사용한다. 실제로 불러오는
데이터와 저장 로직은 그대로다. 다만 원래 있던 `cancelled` 취소 플래그(언마운트 후
`setData` 호출을 막던 것)는 뺀다 — `DataProvider`는 앱 최상위에서 한 번만 마운트되고
실제로 언마운트되지 않으므로(React StrictMode의 개발 모드 이중 마운트 정도가 유일한
예외이고, 그 경우도 같은 데이터를 다시 받아오는 것뿐이라 무해하다), 이 가드가 막던
문제는 실질적으로 일어나지 않는다. `refetch()`처럼 여러 번 호출될 함수에 매번 새
취소 플래그를 만드는 복잡도를 들이는 것보다, 뺀 채로 단순하게 두는 쪽을 택한다.

- [ ] **Step 1: 로드 로직을 `loadFromServer` 함수로 추출하고 `refetch`를 노출**

`client/src/context/DataContext.tsx`에서 아래 블록(현재 파일의 70~116번째 줄 부근,
`useEffect(() => { let cancelled = false; ( async () => { ... } )(); return () => { cancelled = true; }; }, []);`)을 통째로 아래로 교체:

```tsx
  const loadFromServer = useCallback(async () => {
    setLoading(true);
    try {
      const { state } = await api.getData();
      // 첫 로그인 이관: 서버가 기본값(빈 todos 등)이고 로컬에 데이터가 있으면 올림
      const local = collectLocalStorage();
      const serverEmpty =
        state.todos.length === 0 &&
        state.memos.length === 0 &&
        Object.keys(state.timetable).length === 0 &&
        state.meetings.length === 0;
      if (local && serverEmpty) {
        const migrated = {
          ...state,
          ...local,
          settings: normalizeSettings({ ...state.settings, ...(local.settings ?? {}) }),
          overtimeLogs: state.overtimeLogs ?? [],
          overtimePunches: state.overtimePunches ?? [],
        };
        setData(migrated);
        await api.putData({ ...local, settings: migrated.settings });
      } else {
        setData({
          ...state,
          settings: normalizeSettings(state.settings),
          overtimeLogs: state.overtimeLogs ?? [],
          overtimePunches: state.overtimePunches ?? [],
        });
      }
    } catch (e) {
      // 미인증(401)이면 기본값으로 두고 조용히 넘어간다. 로그인 후 재마운트되어 다시 로드된다.
      if (e instanceof ApiError && e.status === 401) {
        setData(defaultAppData());
      }
      // 그 외 오류도 기본값 유지(토스트 없음).
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFromServer();
  }, [loadFromServer]);
```

같은 파일에서 `const update = useCallback(...)` 정의 바로 아래에 `refetch`를 추가:

```tsx
  const refetch = useCallback(() => loadFromServer(), [loadFromServer]);
```

`DataValue` 인터페이스에 필드 추가:

```ts
interface DataValue {
  data: AppData;
  loading: boolean;
  update: (patch: Partial<AppData> | ((prev: AppData) => Partial<AppData>)) => void;
  refetch: () => Promise<void>;
}
```

`value`를 만드는 `useMemo`와 그 의존성 배열 양쪽에 `refetch` 추가:

```tsx
  const value = useMemo<DataValue>(
    () => ({ data, loading, update, refetch }),
    [data, loading, update, refetch],
  );
```

- [ ] **Step 2: 타입 체크**

Run: `cd client && npx tsc --noEmit`
Expected: 에러 없이 종료.

- [ ] **Step 3: 개발 서버에서 회귀 확인**

Run: `cd client && npm run dev` (이미 떠 있다면 생략)

브라우저에서 앱을 새로고침해 평소처럼 로그인·데이터 로드가 되는지 확인(리팩터링만
했으므로 동작이 그대로여야 한다).

- [ ] **Step 4: Commit**

```bash
git add client/src/context/DataContext.tsx
git commit -m "refactor: DataContext에 refetch() 추가(로드 로직 재사용 가능하게 추출)"
```

---

### Task 3: `WidgetView.tsx` — 위젯 화면

**Files:**
- Create: `client/src/views/WidgetView.tsx`

**Interfaces:**
- Consumes: `useData()`(`data`, `refetch`), `useApp()`(`settings`), Task 1의
  `getWidgetOpacity`/`setWidgetOpacity`, `lib/schedule.ts`의 `getDayPhase`,
  `lib/subjectProgress.ts`의 `effectiveSlot`, `lib/subjectColors.ts`의
  `buildSubjectColors`/`classColorKey`.
- Produces: `export default function WidgetView()` — Task 4(`App.tsx`)가 이 컴포넌트를
  렌더한다.

- [ ] **Step 1: 컴포넌트 작성**

`client/src/views/WidgetView.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Settings as SettingsIcon } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useData } from '../context/DataContext';
import { getDayPhase } from '../lib/schedule';
import { effectiveSlot } from '../lib/subjectProgress';
import { buildSubjectColors, classColorKey } from '../lib/subjectColors';
import { getWidgetOpacity, setWidgetOpacity, setWidgetSize } from '../lib/widgetPrefs';

/** "?widget=1"로 열린 팝업 창에서 보여주는 오늘의 시간표 미니 위젯. Sidebar/Header
 *  없이 이것만 렌더된다(App.tsx 참고). */
export default function WidgetView() {
  const { settings } = useApp();
  const { data, refetch } = useData();
  const [now, setNow] = useState(() => new Date());
  const [opacity, setOpacity] = useState(() => getWidgetOpacity());
  const [showSettings, setShowSettings] = useState(false);

  // 시계 갱신(1분마다) — 지금 진행 중인 교시 강조에 쓴다.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  // 창에 다시 포커스가 갈 때 + 5분마다, 메인 탭에서 바뀐 시간표를 다시 불러온다.
  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') void refetch();
    }
    document.addEventListener('visibilitychange', onVisibilityChange);
    const id = setInterval(() => void refetch(), 5 * 60_000);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      clearInterval(id);
    };
  }, [refetch]);

  // 창을 닫는 순간의 크기를 기억해 뒀다가, 다음에 열 때 그 크기로 연다.
  useEffect(() => {
    function handleBeforeUnload() {
      setWidgetSize({ width: window.outerWidth, height: window.outerHeight });
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  function handleOpacityChange(value: number) {
    setOpacity(value);
    setWidgetOpacity(value);
  }

  const phase = getDayPhase(now, settings.periodTimes, settings.periodCount);
  const todayKey = format(now, 'yyyy-MM-dd');
  const subjectColors = buildSubjectColors(data.timetable, data.subjectColors);

  let shortMessage = '';
  if (phase.kind === 'weekend') shortMessage = '주말이에요. 편안한 하루 보내세요.';
  else if (phase.kind === 'before')
    shortMessage = `아직 일과 전이에요. 오늘 일과는 ${settings.periodTimes[0]?.start ?? ''}에 시작해요.`;
  else if (phase.kind === 'after') shortMessage = '오늘 일과가 끝났어요. 수고하셨어요!';

  return (
    <div className="flex h-screen flex-col bg-mint-50 p-3">
      <div
        className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl p-4 shadow-sm ring-1 ring-slate-100"
        style={{ background: `rgba(255,255,255,${opacity / 100})` }}
      >
        <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
          <p className="text-sm font-bold text-slate-700">{format(now, 'M월 d일 (EEE)', { locale: ko })}</p>
          <button
            type="button"
            onClick={() => setShowSettings((v) => !v)}
            aria-label="위젯 설정"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <SettingsIcon size={16} />
          </button>
        </div>

        {showSettings && (
          <div className="mb-2 flex shrink-0 items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
            <span className="shrink-0 text-[11px] text-slate-500">배경 진하기</span>
            <input
              type="range"
              min={0}
              max={100}
              value={opacity}
              onChange={(e) => handleOpacityChange(Number(e.target.value))}
              className="flex-1"
            />
            <span className="w-8 shrink-0 text-right text-[11px] text-slate-400">{opacity}%</span>
          </div>
        )}

        {shortMessage ? (
          <p className="flex flex-1 items-center justify-center text-center text-sm text-slate-500">
            {shortMessage}
          </p>
        ) : (
          <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto">
            {Array.from({ length: settings.periodCount }, (_, i) => {
              const slot = effectiveSlot(data.timetable, data.swapOverrides, todayKey, i);
              const isCanceled = data.canceledLessons.some((c) => c.date === todayKey && c.period === i);
              const makeup = data.makeupLessons.find((m) => m.date === todayKey && m.period === i);
              const isCurrent = phase.kind === 'period' && phase.index === i;
              const time = settings.periodTimes[i];
              const color = slot.subject.trim()
                ? subjectColors.get(classColorKey(slot.subject, slot.room))
                : undefined;
              return (
                <li
                  key={i}
                  className={`flex items-center gap-2 rounded-xl px-2.5 py-1.5 ${
                    isCurrent ? 'bg-mint-100 ring-1 ring-mint-300' : ''
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold ${
                      isCurrent ? 'bg-mint-500 text-white' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate text-sm font-medium ${
                        isCanceled ? 'text-slate-400 line-through' : color ? color.text : 'text-slate-600'
                      }`}
                    >
                      {slot.subject || '미배정'}
                      {slot.room ? ` · ${slot.room}` : ''}
                    </p>
                    {makeup && (
                      <p className="truncate text-[11px] font-medium text-violet-600">
                        보강 · {makeup.subject}
                        {makeup.room ? ` ${makeup.room}` : ''}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-[11px] text-slate-400">
                    {time?.start}~{time?.end}
                  </span>
                  {isCanceled && (
                    <span className="shrink-0 rounded bg-slate-400 px-1 text-[9px] font-bold text-white">휴강</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 타입 체크**

Run: `cd client && npx tsc --noEmit`
Expected: 에러 없이 종료.

- [ ] **Step 3: Commit**

```bash
git add client/src/views/WidgetView.tsx
git commit -m "feat: 오늘의 시간표 위젯 화면(WidgetView) 추가"
```

(Task 4에서 App.tsx에 연결하기 전까지는 화면에서 실제로 보이지 않는다 — 다음 태스크에서
같이 확인한다.)

---

### Task 4: `App.tsx` — 위젯 모드 분기

**Files:**
- Modify: `client/src/App.tsx`

**Interfaces:**
- Consumes: Task 3의 `WidgetView` 컴포넌트.

- [ ] **Step 1: import 추가**

`client/src/App.tsx`의 `import BoardView from './views/BoardView';` 바로 아래 다른
view import들 사이, 알파벳 순서를 고려해 `TimetableView` 아래에 추가:

```tsx
import TimetableView from './views/TimetableView';
import WidgetView from './views/WidgetView';
import type { ViewId } from './types';
```

- [ ] **Step 2: 위젯 모드 상태와 분기 추가**

`export default function App() {` 안, `const [seenWhatsNew, setSeenWhatsNew] = useLocalStorage('haru.whatsnew.seen', '');`
바로 아래에 추가:

```tsx
  // "?widget=1"로 열린 창인지 — 주소가 도중에 바뀌지 않으므로 마운트 시 한 번만 본다.
  const [isWidget] = useState(
    () => new URLSearchParams(window.location.search).get('widget') === '1',
  );
```

`useTodoReminders(data.todos, settings.reminderMinutes > 0);` 바로 아래,
기존 로그인 게이트(`if (status && !status.authenticated) { return <LoginScreen />; }`)
**바로 위**에 추가:

```tsx
  // 위젯 창은 사이드바·헤더 없이 오늘의 시간표만 보여준다.
  if (isWidget) {
    if (status && !status.authenticated) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-mint-50 p-6 text-center">
          <p className="text-sm text-slate-500">메인 창에서 먼저 로그인해 주세요.</p>
        </div>
      );
    }
    return <WidgetView />;
  }

```

- [ ] **Step 3: 타입 체크**

Run: `cd client && npx tsc --noEmit`
Expected: 에러 없이 종료.

- [ ] **Step 4: 개발 서버에서 직접 확인**

Run: `cd client && npm run dev` (이미 떠 있다면 생략)

브라우저에서 로그인 상태로 `http://localhost:5173/?widget=1`을 직접 열어:
- Sidebar/Header 없이 오늘 교시 목록만 뜨는지.
- 지금 진행 중인 교시가 민트색으로 강조되는지.
- 톱니바퀴 아이콘 → 슬라이더로 배경 진하기를 바꾸면 카드가 연해지는지.
- 시크릿 창(로그인 안 된 상태)에서 같은 주소를 열면 "메인 창에서 먼저 로그인해
  주세요" 문구만 뜨고 흰 화면/에러가 안 나는지.

- [ ] **Step 5: Commit**

```bash
git add client/src/App.tsx
git commit -m "feat: ?widget=1 쿼리로 위젯 모드 분기 추가"
```

---

### Task 5: `SettingsView.tsx` — 위젯 열기/닫기 버튼

**Files:**
- Modify: `client/src/views/SettingsView.tsx`

**Interfaces:**
- Consumes: Task 1의 `getWidgetSize`.

- [ ] **Step 1: import 수정**

`client/src/views/SettingsView.tsx` 맨 위:

```tsx
import { useEffect, useRef, useState } from 'react';
```

같은 파일의 `import PeriodTimesModal from '../components/PeriodTimesModal';` 바로
아래에 추가:

```tsx
import { getWidgetSize } from '../lib/widgetPrefs';
```

- [ ] **Step 2: 위젯 열기/닫기 상태·함수 추가**

`export default function SettingsView() {` 안, 기존
`const [editingPeriodTimes, setEditingPeriodTimes] = useState(false);` 바로 아래에
추가:

```tsx
  const widgetRef = useRef<Window | null>(null);
  const [widgetOpen, setWidgetOpen] = useState(false);

  // 사용자가 위젯 창을 직접 닫아도(버튼이 아니라 창의 X로) 버튼 라벨이 따라가도록
  // 1초마다 창이 열려 있는지 확인한다.
  useEffect(() => {
    const id = setInterval(() => {
      setWidgetOpen(Boolean(widgetRef.current && !widgetRef.current.closed));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  function toggleWidget() {
    if (widgetRef.current && !widgetRef.current.closed) {
      widgetRef.current.close();
      setWidgetOpen(false);
      return;
    }
    const size = getWidgetSize();
    const win = window.open(
      '/?widget=1',
      'miyo-widget',
      `width=${size.width},height=${size.height},resizable=yes,popup=yes`,
    );
    widgetRef.current = win;
    setWidgetOpen(Boolean(win));
    win?.focus();
  }
```

- [ ] **Step 3: 새 섹션 추가**

같은 파일에서 "구글 캘린더 연동" 섹션의 닫는 태그와 "데이터" 섹션의 여는 태그 사이
(`</section>` 다음 줄이 `<section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100"><h3 className="mb-2 text-base font-bold text-slate-800">데이터</h3>`인 지점) 사이에 아래 섹션을 끼워 넣는다:

```tsx
      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
        <h3 className="mb-2 text-base font-bold text-slate-800">바탕화면 위젯</h3>
        <div className={rowCls}>
          <div>
            <p className={labelCls}>오늘의 시간표 위젯</p>
            <p className={descCls}>
              오늘의 시간표만 담은 작은 창을 띄워 화면 한쪽에 계속 열어둘 수 있어요. 창
              가장자리를 드래그하면 크기가 바뀌고, 위젯 안 톱니바퀴 아이콘으로 배경 진하기를
              조절할 수 있어요. 이 브라우저를 닫으면 위젯도 같이 닫혀요.
            </p>
          </div>
          <button
            onClick={toggleWidget}
            className={`shrink-0 rounded-xl px-4 py-2 text-sm font-semibold transition ${
              widgetOpen
                ? 'border border-rose-200 text-rose-500 hover:bg-rose-50'
                : 'bg-mint-500 text-white hover:bg-mint-600'
            }`}
          >
            {widgetOpen ? '위젯 닫기' : '위젯 열기'}
          </button>
        </div>
      </section>

```

- [ ] **Step 4: 타입 체크**

Run: `cd client && npx tsc --noEmit`
Expected: 에러 없이 종료.

- [ ] **Step 5: 개발 서버에서 직접 확인**

환경 설정 화면에서:
- "위젯 열기" 클릭 → 작은 팝업 창이 뜨고 버튼이 "위젯 닫기"로 바뀌는지.
- 다시 "위젯 열기" 문구가 있던 자리(이제 "위젯 닫기")를 클릭 → 창이 닫히고 버튼이
  "위젯 열기"로 돌아오는지.
- "위젯 열기"로 다시 열고, 위젯 창을 그 창 자체의 X 버튼으로 닫아도(1초 안에) 설정
  화면 버튼이 "위젯 열기"로 돌아오는지.
- 위젯 창 가장자리를 드래그해 크기를 바꾼 뒤 닫고 "위젯 열기"를 다시 누르면 그
  크기로 뜨는지.

- [ ] **Step 6: Commit**

```bash
git add client/src/views/SettingsView.tsx
git commit -m "feat: 환경 설정에 오늘의 시간표 위젯 열기/닫기 버튼 추가"
```

---

### Task 6: 업데이트 소식 반영 + 최종 통합 확인

**Files:**
- Modify: `client/src/components/WhatsNewModal.tsx`

- [ ] **Step 1: 새 항목 추가 + 버전 올리기**

`client/src/components/WhatsNewModal.tsx`의 `WHATS_NEW_VERSION`을 올리고, `ITEMS`
배열 맨 앞에 새 항목을 추가한다:

```tsx
export const WHATS_NEW_VERSION = '2026-08-29-2';

const ITEMS = [
  {
    title: '오늘의 시간표 — 바탕화면 위젯',
    desc: '환경 설정에서 "위젯 열기"를 누르면 오늘의 시간표만 담긴 작은 창이 떠요. 화면 한쪽에 계속 띄워둘 수 있고, 가장자리를 드래그해 크기를 바꾸거나 톱니바퀴 아이콘으로 배경 진하기를 조절할 수 있어요.',
  },
  {
    title: '오늘의 시간표 — 점심·보강·휴강 드래그 카드',
```

(이후 기존 항목들은 그대로 둔다.)

- [ ] **Step 2: 타입 체크 + 전체 빌드**

Run: `cd client && npx tsc --noEmit && npm run build`
Expected: 에러 없이 빌드 완료.

- [ ] **Step 3: 전체 유닛 테스트**

Run: `cd client && npx vitest run`
Expected: 기존 테스트 전부 + `widgetPrefs.test.ts` 포함 전체 PASS.

- [ ] **Step 4: 최종 통합 수동 확인**

1. 환경 설정 → "위젯 열기" → 오늘 교시 목록, 현재 교시 강조 확인.
2. 위젯 크기 드래그로 변경 → 닫기 → 다시 열기 → 크기 유지 확인.
3. 톱니바퀴 → 배경 진하기 슬라이더 조절 → 닫기 → 다시 열기 → 값 유지 확인.
4. 메인 탭에서 오늘 시간표의 과목을 하나 바꾼 뒤, 위젯 창을 클릭(포커스) →
   바뀐 내용이 반영되는지 확인(즉시 안 바뀌면 5분 이내 자동 반영도 확인 가능하지만
   포커스 시 즉시 반영이 1차 기준).
5. 위젯 창에서 "업데이트 소식" 팝업이 안 뜨는지(위젯 모드는 `WhatsNewModal`을
   렌더하지 않는 분기이므로 자연히 안 뜬다 — Task 4 확인).
6. 로그인 메인 탭을 완전히 닫으면 위젯 창도 같이 닫히는지(브라우저 팝업의 기본
   동작 — opener 탭이 아니라 "이 브라우저 전체"를 닫을 때 같이 꺼지는지는 OS/브라우저
   설정에 따라 다를 수 있음 — 다르면 검증 결과만 기록하고 이번 범위에서 추가 조치는
   하지 않는다).

- [ ] **Step 5: Commit**

```bash
git add client/src/components/WhatsNewModal.tsx
git commit -m "docs: 업데이트 소식에 바탕화면 위젯 안내 추가"
```

- [ ] **Step 6: Push**

```bash
git push
```
