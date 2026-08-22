# 진도계획표 1단계(데이터 기반) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 반(학급)별로 과목 진도(현재 차시)를 관리하고, 학사일정을 반영해 자동으로 진도를
올려주는 "진도계획표" 화면을 새로 추가한다. 카드형 대시보드·팝오버·다크모드는 이후
단계에서 다룬다 — 이번 단계는 데이터 기반과 최소 동작 화면까지다.

**Architecture:** 기존 "오늘의 시간표"(`Timetable`/`PeriodSlot`)는 전혀 건드리지 않고,
완전히 새로운 데이터 4종류(반 목록·과목 목록·반+과목 배정 시간표·반+과목별 진도)를
`AppData`에 추가한다. 서버는 사용자당 JSON 한 덩어리를 그대로 저장하므로 DB 마이그레이션
없이, 저장 허용 키 목록만 넓히면 된다. 화면은 사이드바에 새 메뉴로 추가하고, 반 관리 →
과목 관리 → 배정 그리드 → 진도 목록 4개 컴포넌트로 구성한다.

**Tech Stack:** React + TypeScript(client), Express(server), 순수 함수는 Vitest/Node
test runner로 단위 테스트. 새 라이브러리 의존성 없음.

## Global Constraints

- 기존 `Timetable`/`PeriodSlot`/`TimetableView.tsx`는 수정하지 않는다(완전 별개 기능).
- 서버 DB 스키마 변경 없음 — `server/lib/appState.js`의 허용 키 목록만 확장한다.
- 새 UI 컴포넌트는 이 프로젝트의 기존 관례를 따른다: Tailwind 유틸리티 클래스,
  `lucide-react` 아이콘, `useData()`(`../context/DataContext`)로 저장, 주석은
  "왜"가 비자명할 때만 한 줄.
- 컴포넌트(화면) 단위 자동 테스트는 이 프로젝트에 선례가 없으므로 만들지 않는다
  (다른 뷰들도 다 그렇다). 순수 로직 함수(`progress.ts`, `appState.js`)는 반드시
  단위 테스트한다.
- 모든 명령은 저장소 루트
  `C:\Pcall\R02-창작자(Creator)\D01-앱 개발\P01-교육진로웹앱(EdTech)\planner`에서
  실행한다(클라이언트 전용 명령은 `client/`로 이동).

---

### Task 1: 데이터 모델 + 서버 저장 허용

**Files:**
- Modify: `client/src/types.ts:1-9` (ViewId), `client/src/types.ts:158-170` (AppData 부근)
- Modify: `client/src/lib/appData.ts`
- Modify: `server/lib/appState.js`
- Test: `server/lib/appState.test.js`

**Interfaces:**
- Produces: `SchoolClass { id: string; name: string }`,
  `ProgressSubject { id: string; name: string; totalLessons: number }`,
  `ProgressTimetable = Record<number, Array<{ classId: string; subjectId: string } | null>>`,
  `ClassProgress { classId: string; subjectId: string; currentLesson: number; lastAdvancedDate?: string }`.
  `AppData`에 `progressClasses: SchoolClass[]`, `progressSubjects: ProgressSubject[]`,
  `progressTimetable: ProgressTimetable`, `classProgress: ClassProgress[]` 필드 추가.
  `ViewId`에 `'progress'` 추가.

- [ ] **Step 1: `server/lib/appState.test.js`의 기존 키 개수 테스트를 먼저 고쳐서 실패시킨다(TDD)**

`server/lib/appState.test.js` 5번째 줄의 테스트를 아래로 교체:

```js
test('defaultAppState는 12개 키를 가진다', () => {
  const s = defaultAppState();
  assert.deepEqual(
    Object.keys(s).sort(),
    [
      'classProgress', 'holidays', 'meetings', 'memos', 'overtimeLogs', 'overtimePunches',
      'progressClasses', 'progressSubjects', 'progressTimetable', 'settings', 'timetable', 'todos',
    ],
  );
  assert.deepEqual(s.todos, []);
  assert.deepEqual(s.holidays, {});
  assert.deepEqual(s.overtimeLogs, []);
  assert.deepEqual(s.overtimePunches, []);
  assert.deepEqual(s.progressClasses, []);
  assert.deepEqual(s.progressSubjects, []);
  assert.deepEqual(s.progressTimetable, {});
  assert.deepEqual(s.classProgress, []);
  assert.equal(s.settings.periodCount, 7);
});
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

```
node --test server/lib/appState.test.js
```
Expected: FAIL — `defaultAppState는 12개 키를 가진다` 테스트에서 키 목록이 8개뿐이라
`deepEqual`이 실패한다.

- [ ] **Step 3: `server/lib/appState.js`에 새 키 4개를 추가한다**

`defaultAppState()`와 `KEYS`를 아래로 교체:

```js
export function defaultAppState() {
  return {
    todos: [],
    meetings: [],
    memos: [],
    timetable: {},
    settings: { ...DEFAULT_SETTINGS },
    holidays: {},
    overtimeLogs: [],
    overtimePunches: [],
    progressClasses: [],
    progressSubjects: [],
    progressTimetable: {},
    classProgress: [],
  };
}

const KEYS = [
  'todos', 'meetings', 'memos', 'timetable', 'settings', 'holidays', 'overtimeLogs', 'overtimePunches',
  'progressClasses', 'progressSubjects', 'progressTimetable', 'classProgress',
];
```

- [ ] **Step 4: 테스트 실행해서 통과 확인**

```
node --test server/lib/appState.test.js
```
Expected: PASS (전체 4개 테스트)

- [ ] **Step 5: `client/src/types.ts`에 타입 추가**

`export type ViewId =` 블록(1~9번째 줄)을 아래로 교체:

```ts
export type ViewId =
  | 'dashboard'
  | 'matrix'
  | 'school'
  | 'timetable'
  | 'progress'
  | 'memo'
  | 'procurement'
  | 'settings'
  | 'overtime';
```

`export interface AppData { ... }` 블록(158~170번째 줄 부근, `overtimePunches: OvertimePunch[];`
다음 줄) 바로 앞에 새 인터페이스들을 추가하고, `AppData`에 필드를 더한다 — 전체를
아래로 교체:

```ts
/** 진도계획표: 반(학급) */
export interface SchoolClass {
  id: string;
  name: string; // 예: '1-1'
}

/** 진도계획표: 과목. 총 차시는 1단계에서는 직접 입력한다 */
export interface ProgressSubject {
  id: string;
  name: string; // 예: '수학'
  totalLessons: number;
}

/** 진도계획표 전용 배정표. 요일(1=월~5=금) → 교시 인덱스별 반+과목 배정. 배정 없으면 null.
 *  기존 Timetable(오늘의 시간표, 자유입력 과목/교실)과는 완전히 별개다. */
export type ProgressTimetable = Record<number, Array<{ classId: string; subjectId: string } | null>>;

/** 반+과목 조합의 진도 위치 */
export interface ClassProgress {
  classId: string;
  subjectId: string;
  currentLesson: number; // 0 = 아직 시작 안 함
  /** 자동 진행 계산이 마지막으로 반영한 날짜(YYYY-MM-DD). 이 날짜까지는 이미 반영됨 */
  lastAdvancedDate?: string;
}

export interface AppData {
  todos: Todo[];
  meetings: Meeting[];
  memos: MemoNote[];
  timetable: Timetable;
  settings: Settings;
  /** 사용자가 지정한 휴일(재량휴업일 등). YYYY-MM-DD → 라벨 */
  holidays: Record<string, string>;
  overtimeLogs: OvertimeLog[];
  overtimePunches: OvertimePunch[];
  progressClasses: SchoolClass[];
  progressSubjects: ProgressSubject[];
  progressTimetable: ProgressTimetable;
  classProgress: ClassProgress[];
}
```

- [ ] **Step 6: `client/src/lib/appData.ts`의 `defaultAppData()`에 새 필드 추가**

```ts
export function defaultAppData(): AppData {
  return {
    todos: [],
    meetings: [],
    memos: [],
    timetable: {},
    settings: defaultSettings(),
    holidays: {},
    overtimeLogs: [],
    overtimePunches: [],
    progressClasses: [],
    progressSubjects: [],
    progressTimetable: {},
    classProgress: [],
  };
}
```

- [ ] **Step 7: 타입체크**

```
cd client && npx tsc --noEmit
```
Expected: 에러 없음. (아직 이 필드들을 쓰는 화면이 없어도, `AppData`를 다루는 기존
코드는 구조적 타이핑상 초과 필드를 허용하므로 깨지지 않는다.)

- [ ] **Step 8: 커밋**

```bash
git add client/src/types.ts client/src/lib/appData.ts server/lib/appState.js server/lib/appState.test.js
git commit -m "feat: 진도계획표 데이터 모델 추가 + 서버 저장 허용"
```

---

### Task 2: 자동 진행 계산 로직

**Files:**
- Create: `client/src/lib/progress.ts`
- Test: `client/src/lib/progress.test.ts`

**Interfaces:**
- Consumes: `ProgressTimetable`(Task 1에서 정의).
- Produces: `weeklyOccurrences(timetable, classId, subjectId): Record<number, number>`,
  `countElapsedLessons(occurrences, fromExclusive, toExclusive, noClassDates): number`.
  두 함수 모두 Task 7(ProgressList)에서 그대로 가져다 쓴다.

- [ ] **Step 1: 실패하는 테스트 작성**

`client/src/lib/progress.test.ts` 생성:

```ts
import { describe, expect, test } from 'vitest';
import { countElapsedLessons, weeklyOccurrences } from './progress';
import type { ProgressTimetable } from '../types';

describe('weeklyOccurrences', () => {
  test('배정이 없으면 빈 객체', () => {
    const timetable: ProgressTimetable = { 1: [null, null], 2: [null] };
    expect(weeklyOccurrences(timetable, 'c1', 's1')).toEqual({});
  });

  test('한 요일 한 교시에 배정되면 그 요일에 1', () => {
    const timetable: ProgressTimetable = {
      2: [null, { classId: 'c1', subjectId: 's1' }],
    };
    expect(weeklyOccurrences(timetable, 'c1', 's1')).toEqual({ 2: 1 });
  });

  test('같은 요일에 두 번 배정되면 2', () => {
    const timetable: ProgressTimetable = {
      3: [{ classId: 'c1', subjectId: 's1' }, { classId: 'c1', subjectId: 's1' }],
    };
    expect(weeklyOccurrences(timetable, 'c1', 's1')).toEqual({ 3: 2 });
  });

  test('다른 반이나 다른 과목 배정은 세지 않는다', () => {
    const timetable: ProgressTimetable = {
      1: [{ classId: 'c2', subjectId: 's1' }, { classId: 'c1', subjectId: 's2' }],
    };
    expect(weeklyOccurrences(timetable, 'c1', 's1')).toEqual({});
  });
});

describe('countElapsedLessons', () => {
  const noHolidays = new Set<string>();

  test('fromExclusive가 없으면 0 (신규 행은 소급하지 않는다)', () => {
    expect(countElapsedLessons({ 1: 1 }, undefined, '2026-08-24', noHolidays)).toBe(0);
  });

  test('평일 5일 모두 수업이면 요일 카운트 합만큼 오른다', () => {
    const occurrences = { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 };
    expect(countElapsedLessons(occurrences, '2026-08-16', '2026-08-22', noHolidays)).toBe(5);
  });

  test('방학이 껴 있으면 그 날짜는 건너뛴다', () => {
    const occurrences = { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 };
    const holidays = new Set(['2026-08-19']);
    expect(countElapsedLessons(occurrences, '2026-08-16', '2026-08-22', holidays)).toBe(4);
  });

  test('주 2회(화·목)만 배정이면 그 요일만 카운트한다', () => {
    const occurrences = { 2: 1, 4: 1 };
    expect(countElapsedLessons(occurrences, '2026-08-16', '2026-08-22', noHolidays)).toBe(2);
  });

  test('범위가 비어있거나 뒤바뀌면 0', () => {
    expect(countElapsedLessons({ 1: 1 }, '2026-08-20', '2026-08-20', noHolidays)).toBe(0);
    expect(countElapsedLessons({ 1: 1 }, '2026-08-20', '2026-08-10', noHolidays)).toBe(0);
  });
});
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

```
cd client && npx vitest run src/lib/progress.test.ts
```
Expected: FAIL — `./progress` 모듈이 없어서 임포트 에러.

- [ ] **Step 3: 최소 구현 작성**

`client/src/lib/progress.ts` 생성:

```ts
import type { ProgressTimetable } from '../types';

/** classId+subjectId가 배정된 요일(1~5)별 교시 수. 같은 요일에 두 번 배정되면 2. */
export function weeklyOccurrences(
  timetable: ProgressTimetable,
  classId: string,
  subjectId: string,
): Record<number, number> {
  const result: Record<number, number> = {};
  for (const [dayKey, slots] of Object.entries(timetable)) {
    const day = Number(dayKey);
    const count = slots.filter((s) => s?.classId === classId && s?.subjectId === subjectId).length;
    if (count > 0) result[day] = count;
  }
  return result;
}

/** YYYY-MM-DD 날짜 문자열에 하루를 더한다 */
function addDay(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Date.getDay()(0=일~6=토)를 이 앱의 요일 표기(1=월~5=금)로. 주말이면 null. */
function toWeekday(ymd: string): number | null {
  const dow = new Date(`${ymd}T00:00:00`).getDay();
  return dow >= 1 && dow <= 5 ? dow : null;
}

/**
 * fromExclusive 다음날부터 toExclusive 전날까지, noClassDates에 없는 평일만 세어
 * 그날 요일에 배정된 교시 수(occurrences)만큼 차시를 더한다.
 * fromExclusive가 없으면 0을 돌려준다 — 신규 진도 행은 오늘부터 시작하고 과거로
 * 소급해서 세지 않는다.
 */
export function countElapsedLessons(
  occurrences: Record<number, number>,
  fromExclusive: string | undefined,
  toExclusive: string,
  noClassDates: Set<string>,
): number {
  if (!fromExclusive) return 0;
  let total = 0;
  let cursor = addDay(fromExclusive);
  while (cursor < toExclusive) {
    if (!noClassDates.has(cursor)) {
      const weekday = toWeekday(cursor);
      if (weekday !== null) total += occurrences[weekday] ?? 0;
    }
    cursor = addDay(cursor);
  }
  return total;
}
```

- [ ] **Step 4: 테스트 실행해서 통과 확인**

```
cd client && npx vitest run src/lib/progress.test.ts
```
Expected: PASS (9개 테스트 전부)

- [ ] **Step 5: 커밋**

```bash
git add client/src/lib/progress.ts client/src/lib/progress.test.ts
git commit -m "feat: 진도 자동 진행 계산 로직(progress.ts)"
```

---

### Task 3: 내비게이션 배선 + 빈 화면

**Files:**
- Modify: `client/src/lib/sidebarOrder.ts`, `client/src/lib/sidebarOrder.test.ts`
- Modify: `client/src/components/Sidebar.tsx`
- Modify: `client/src/components/MoreSheet.tsx`
- Modify: `client/src/App.tsx`
- Create: `client/src/views/ProgressView.tsx` (1단계에서는 빈 화면, Task 8에서 완성)

**Interfaces:**
- Consumes: `ViewId`(Task 1에서 `'progress'` 추가됨).
- Produces: 사이드바·모바일 더보기 시트에서 `'progress'`로 이동 가능. `ProgressView`
  컴포넌트(Task 8이 내용을 채운다).

- [ ] **Step 1: `client/src/lib/sidebarOrder.ts`에 `'progress'` 추가**

`SidebarItemId`와 `DEFAULT_SIDEBAR_ORDER`를 아래로 교체(둘 다 `timetable` 다음,
`procurement` 앞에 `progress`를 끼워 넣는다):

```ts
export type SidebarItemId =
  | 'dashboard'
  | 'matrix'
  | 'memo'
  | 'school'
  | 'timetable'
  | 'progress'
  | 'procurement'
  | 'seating';

export const DEFAULT_SIDEBAR_ORDER: SidebarItemId[] = [
  'dashboard',
  'matrix',
  'memo',
  'school',
  'timetable',
  'progress',
  'procurement',
  'seating',
];
```

- [ ] **Step 2: `client/src/lib/sidebarOrder.test.ts`를 새 기본 순서에 맞게 고친다**

파일 전체를 아래로 교체:

```ts
import { describe, expect, test } from 'vitest';
import { DEFAULT_SIDEBAR_ORDER, resolveSidebarOrder } from './sidebarOrder';

describe('resolveSidebarOrder', () => {
  test('빈 배열이면 기본 순서를 그대로 쓴다', () => {
    expect(resolveSidebarOrder([])).toEqual(DEFAULT_SIDEBAR_ORDER);
  });

  test('사용자가 바꾼 순서를 그대로 유지한다', () => {
    const custom = ['school', 'dashboard', 'matrix', 'memo', 'timetable', 'progress', 'procurement', 'seating'];
    expect(resolveSidebarOrder(custom)).toEqual(custom);
  });

  test('더는 존재하지 않는 항목은 제거한다', () => {
    const saved = [
      'dashboard', 'old-removed-view', 'matrix', 'memo', 'school', 'timetable', 'progress', 'procurement', 'seating',
    ];
    const result = resolveSidebarOrder(saved);
    expect(result).not.toContain('old-removed-view');
    expect(result).toEqual(['dashboard', 'matrix', 'memo', 'school', 'timetable', 'progress', 'procurement', 'seating']);
  });

  test('저장된 목록에 없는 새 항목은 끝에, 기본 순서대로 붙인다', () => {
    // 'progress'와 'procurement'가 기능 추가 이전에 저장된 것처럼, 둘 다 saved에 없는 상황
    const saved = ['school', 'dashboard', 'matrix', 'memo', 'timetable', 'seating'];
    expect(resolveSidebarOrder(saved)).toEqual([
      'school', 'dashboard', 'matrix', 'memo', 'timetable', 'seating', 'progress', 'procurement',
    ]);
  });

  test('중복이 있어도 한 번만 남긴다', () => {
    const saved = ['dashboard', 'dashboard', 'matrix', 'memo', 'school', 'timetable', 'procurement', 'seating'];
    const result = resolveSidebarOrder(saved);
    expect(result.filter((id) => id === 'dashboard')).toHaveLength(1);
  });
});
```

- [ ] **Step 3: 테스트 실행**

```
cd client && npx vitest run src/lib/sidebarOrder.test.ts
```
Expected: PASS (5개 전부)

- [ ] **Step 4: 빈 `ProgressView` 생성**

`client/src/views/ProgressView.tsx` 생성:

```tsx
import { ClipboardList } from 'lucide-react';

export default function ProgressView() {
  return (
    <div className="mx-auto max-w-4xl">
      <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800">
        <ClipboardList size={18} className="text-mint-500" />
        진도계획표
      </h2>
      <p className="mt-4 text-sm text-slate-400">준비 중입니다.</p>
    </div>
  );
}
```

- [ ] **Step 5: `client/src/App.tsx`에 라우팅 추가**

`import TimetableView from './views/TimetableView';` 다음 줄에 추가:

```ts
import ProgressView from './views/ProgressView';
```

`{view === 'timetable' && <TimetableView />}` 다음 줄에 추가:

```tsx
{view === 'progress' && <ProgressView />}
```

`const MORE_VIEWS: ViewId[] = ['timetable', 'procurement', 'settings'];`를 아래로 교체:

```ts
const MORE_VIEWS: ViewId[] = ['timetable', 'progress', 'procurement', 'settings'];
```

- [ ] **Step 6: `client/src/components/Sidebar.tsx`에 메뉴 추가**

`import { ... } from 'lucide-react';` 블록의 `Armchair,` 다음 줄에 추가(알파벳 순서상
`Armchair`와 `ClipboardPaste` 사이):

```ts
  ClipboardList,
```

`ITEM_DEFS`에 `timetable` 항목 다음, `procurement` 항목 앞에 추가:

```ts
  progress: { label: '진도계획표', icon: ClipboardList },
```

- [ ] **Step 7: `client/src/components/MoreSheet.tsx`에 메뉴 추가**

`import` 목록에 `ClipboardList` 추가:

```ts
import { Armchair, ClipboardList, ClipboardPaste, FileSpreadsheet, LogOut, Settings, Table, X } from 'lucide-react';
```

"오늘의 시간표" 버튼(`navigate('timetable')`) 바로 다음에 추가:

```tsx
          <button
            onClick={() => navigate('progress')}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            <ClipboardList size={18} className="text-slate-400" />
            진도계획표
          </button>
```

- [ ] **Step 8: 타입체크 + 전체 테스트**

```
cd client && npx tsc --noEmit
cd .. && npm test
```
Expected: 에러 없음, 서버+클라이언트 테스트 전부 통과.

- [ ] **Step 9: 개발 서버로 눈 확인**

```
npm run dev
```
브라우저에서 로그인 후 사이드바에 "진도계획표" 메뉴가 보이는지, 클릭하면 "준비
중입니다" 화면이 뜨는지, 모바일 폭(< lg)에서는 "더보기" 시트에 같은 메뉴가 있는지
확인한다.

- [ ] **Step 10: 커밋**

```bash
git add client/src/lib/sidebarOrder.ts client/src/lib/sidebarOrder.test.ts \
  client/src/components/Sidebar.tsx client/src/components/MoreSheet.tsx \
  client/src/App.tsx client/src/views/ProgressView.tsx
git commit -m "feat: 진도계획표 메뉴·라우팅 추가(빈 화면)"
```

---

### Task 4: 반 관리 (ClassManager)

**Files:**
- Create: `client/src/components/progress/ClassManager.tsx`

**Interfaces:**
- Consumes: `useData()`(`../../context/DataContext`) → `data.progressClasses`,
  `update()`. `SchoolClass`(Task 1).
- Produces: `ClassManager` 컴포넌트, Task 8이 `ProgressView`에 조립한다.

- [ ] **Step 1: 컴포넌트 작성**

`client/src/components/progress/ClassManager.tsx` 생성:

```tsx
import { Plus, Trash2 } from 'lucide-react';
import { useData } from '../../context/DataContext';
import type { SchoolClass } from '../../types';

export default function ClassManager() {
  const { data, update } = useData();
  const classes = data.progressClasses;
  const setClasses = (updater: (prev: SchoolClass[]) => SchoolClass[]) =>
    update((prev) => ({ progressClasses: updater(prev.progressClasses) }));

  function addClass() {
    setClasses((prev) => [...prev, { id: crypto.randomUUID(), name: '' }]);
  }

  function renameClass(id: string, name: string) {
    setClasses((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)));
  }

  function removeClass(id: string) {
    setClasses((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-700">반 관리</h3>
        <button
          onClick={addClass}
          className="flex items-center gap-1 rounded-lg bg-mint-500 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-mint-600"
        >
          <Plus size={13} /> 반 추가
        </button>
      </div>
      {classes.length === 0 ? (
        <p className="py-3 text-sm text-slate-400">등록된 반이 없습니다. '반 추가'로 시작하세요.</p>
      ) : (
        <ul className="space-y-1.5">
          {classes.map((c) => (
            <li key={c.id} className="group flex items-center gap-2">
              <input
                value={c.name}
                onChange={(e) => renameClass(c.id, e.target.value)}
                placeholder="예: 1-1"
                className="flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-mint-400"
              />
              <button
                onClick={() => removeClass(c.id)}
                className="rounded p-1 text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-rose-400"
                aria-label={`${c.name || '반'} 삭제`}
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 2: 타입체크**

```
cd client && npx tsc --noEmit
```
Expected: 에러 없음(아직 아무 데서도 import하지 않아 미사용 경고는 없다 — tsc는
미사용 파일을 에러로 보지 않는다).

- [ ] **Step 3: 커밋**

```bash
git add client/src/components/progress/ClassManager.tsx
git commit -m "feat: 반 관리 컴포넌트(ClassManager)"
```

---

### Task 5: 과목 관리 (SubjectManager)

**Files:**
- Create: `client/src/components/progress/SubjectManager.tsx`

**Interfaces:**
- Consumes: `useData()` → `data.progressSubjects`, `update()`. `ProgressSubject`(Task 1).
- Produces: `SubjectManager` 컴포넌트, Task 8이 조립한다.

- [ ] **Step 1: 컴포넌트 작성**

`client/src/components/progress/SubjectManager.tsx` 생성:

```tsx
import { Plus, Trash2 } from 'lucide-react';
import { useData } from '../../context/DataContext';
import type { ProgressSubject } from '../../types';

export default function SubjectManager() {
  const { data, update } = useData();
  const subjects = data.progressSubjects;
  const setSubjects = (updater: (prev: ProgressSubject[]) => ProgressSubject[]) =>
    update((prev) => ({ progressSubjects: updater(prev.progressSubjects) }));

  function addSubject() {
    setSubjects((prev) => [...prev, { id: crypto.randomUUID(), name: '', totalLessons: 1 }]);
  }

  function renameSubject(id: string, name: string) {
    setSubjects((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)));
  }

  function setTotalLessons(id: string, totalLessons: number) {
    setSubjects((prev) => prev.map((s) => (s.id === id ? { ...s, totalLessons } : s)));
  }

  function removeSubject(id: string) {
    setSubjects((prev) => prev.filter((s) => s.id !== id));
  }

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-700">과목 관리</h3>
        <button
          onClick={addSubject}
          className="flex items-center gap-1 rounded-lg bg-mint-500 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-mint-600"
        >
          <Plus size={13} /> 과목 추가
        </button>
      </div>
      {subjects.length === 0 ? (
        <p className="py-3 text-sm text-slate-400">등록된 과목이 없습니다. '과목 추가'로 시작하세요.</p>
      ) : (
        <ul className="space-y-1.5">
          {subjects.map((s) => (
            <li key={s.id} className="group flex items-center gap-2">
              <input
                value={s.name}
                onChange={(e) => renameSubject(s.id, e.target.value)}
                placeholder="예: 수학"
                className="flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-mint-400"
              />
              <label className="flex shrink-0 items-center gap-1 text-xs text-slate-400">
                총
                <input
                  type="number"
                  min={1}
                  value={s.totalLessons}
                  onChange={(e) => setTotalLessons(s.id, Math.max(1, Number(e.target.value) || 1))}
                  className="w-14 rounded-lg border border-slate-200 px-1.5 py-1.5 text-sm outline-none focus:border-mint-400"
                />
                차시
              </label>
              <button
                onClick={() => removeSubject(s.id)}
                className="rounded p-1 text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-rose-400"
                aria-label={`${s.name || '과목'} 삭제`}
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 2: 타입체크**

```
cd client && npx tsc --noEmit
```
Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add client/src/components/progress/SubjectManager.tsx
git commit -m "feat: 과목 관리 컴포넌트(SubjectManager)"
```

---

### Task 6: 배정 그리드 (AssignmentGrid)

**Files:**
- Create: `client/src/components/progress/AssignmentGrid.tsx`

**Interfaces:**
- Consumes: `useApp()`(`../../context/AppContext`) → `settings.periodCount`.
  `useData()` → `data.progressClasses`, `data.progressSubjects`, `data.progressTimetable`, `update()`.
- Produces: `AssignmentGrid` 컴포넌트. 셀 선택값 인코딩 규칙(`${classId}::${subjectId}`)은
  Task 7(ProgressList)이 배정 목록을 뽑아낼 때 재사용하지 않는다 — ProgressList는
  `progressTimetable`을 직접 순회하므로 이 인코딩은 이 파일 내부 구현 세부사항이다.

- [ ] **Step 1: 컴포넌트 작성**

`client/src/components/progress/AssignmentGrid.tsx` 생성:

```tsx
import { useApp } from '../../context/AppContext';
import { useData } from '../../context/DataContext';

const WEEKDAYS = [
  { day: 1, label: '월' },
  { day: 2, label: '화' },
  { day: 3, label: '수' },
  { day: 4, label: '목' },
  { day: 5, label: '금' },
];

function cellKey(classId: string, subjectId: string) {
  return `${classId}::${subjectId}`;
}

export default function AssignmentGrid() {
  const { settings } = useApp();
  const { data, update } = useData();
  const classes = data.progressClasses;
  const subjects = data.progressSubjects;
  const timetable = data.progressTimetable;

  function setSlot(day: number, period: number, value: { classId: string; subjectId: string } | null) {
    update((prev) => {
      const daySlots = [...(prev.progressTimetable[day] ?? [])];
      while (daySlots.length <= period) daySlots.push(null);
      daySlots[period] = value;
      return { progressTimetable: { ...prev.progressTimetable, [day]: daySlots } };
    });
  }

  const hasOptions = classes.length > 0 && subjects.length > 0;

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
      <h3 className="mb-3 text-sm font-bold text-slate-700">교시별 반 배정</h3>
      {!hasOptions ? (
        <p className="py-3 text-sm text-slate-400">반과 과목을 먼저 등록해야 배정할 수 있습니다.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-2xl text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400">
                <th className="w-12 pb-2 font-medium">교시</th>
                {WEEKDAYS.map(({ day, label }) => (
                  <th key={day} className="pb-2 font-medium">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: settings.periodCount }, (_, period) => (
                <tr key={period}>
                  <td className="py-1 pr-2 text-xs font-semibold text-slate-500">{period + 1}</td>
                  {WEEKDAYS.map(({ day }) => {
                    const slot = (timetable[day] ?? [])[period] ?? null;
                    const value = slot ? cellKey(slot.classId, slot.subjectId) : '';
                    return (
                      <td key={day} className="py-1 pr-1">
                        <select
                          value={value}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (!v) {
                              setSlot(day, period, null);
                              return;
                            }
                            const [classId, subjectId] = v.split('::');
                            setSlot(day, period, { classId, subjectId });
                          }}
                          className="w-full rounded-lg border border-slate-200 px-1.5 py-1.5 text-xs outline-none focus:border-mint-400"
                        >
                          <option value="">배정 없음</option>
                          {classes.map((c) =>
                            subjects.map((s) => (
                              <option key={cellKey(c.id, s.id)} value={cellKey(c.id, s.id)}>
                                {c.name || '(이름 없음)'} · {s.name || '(이름 없음)'}
                              </option>
                            )),
                          )}
                        </select>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 2: 타입체크**

```
cd client && npx tsc --noEmit
```
Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add client/src/components/progress/AssignmentGrid.tsx
git commit -m "feat: 교시별 반 배정 그리드(AssignmentGrid)"
```

---

### Task 7: 자동 진행 반영 + 진도 목록 (ProgressList)

**Files:**
- Create: `client/src/components/progress/ProgressList.tsx`

**Interfaces:**
- Consumes: `useApp()` → `settings.school`. `useData()` → `data.progressClasses`,
  `data.progressSubjects`, `data.progressTimetable`, `data.classProgress`, `data.holidays`,
  `update()`. `api.schoolSchedule(school, from, to)`(`../../lib/api`, 기존 함수).
  `todayYMD()`(`../../lib/overtime`, 기존 함수 재사용). `weeklyOccurrences`,
  `countElapsedLessons`(Task 2, `../../lib/progress`).
- Produces: `ProgressList` 컴포넌트. `data.classProgress`에 새 배정 건의 행을 자동
  생성하고, 학사일정 기준으로 지난 날짜만큼 `currentLesson`을 자동으로 올린다.

- [ ] **Step 1: 컴포넌트 작성**

`client/src/components/progress/ProgressList.tsx` 생성:

```tsx
import { useEffect } from 'react';
import { api } from '../../lib/api';
import { useApp } from '../../context/AppContext';
import { useData } from '../../context/DataContext';
import { todayYMD } from '../../lib/overtime';
import { countElapsedLessons, weeklyOccurrences } from '../../lib/progress';

export default function ProgressList() {
  const { settings } = useApp();
  const { data, update } = useData();
  const { progressClasses: classes, progressSubjects: subjects, progressTimetable: timetable, classProgress, holidays } = data;

  // 배정된 반+과목 조합 목록(중복 제거)
  const assignedPairs = new Map<string, { classId: string; subjectId: string }>();
  for (const slots of Object.values(timetable)) {
    for (const slot of slots) {
      if (slot) assignedPairs.set(`${slot.classId}::${slot.subjectId}`, slot);
    }
  }

  // 새로 배정된 반+과목에는 진도 행을 만든다(오늘부터 시작, 과거로 소급하지 않는다)
  useEffect(() => {
    const existingKeys = new Set(classProgress.map((p) => `${p.classId}::${p.subjectId}`));
    const missing = [...assignedPairs.values()].filter(
      (p) => !existingKeys.has(`${p.classId}::${p.subjectId}`),
    );
    if (missing.length === 0) return;
    const today = todayYMD();
    update((prev) => ({
      classProgress: [
        ...prev.classProgress,
        ...missing.map((p) => ({ classId: p.classId, subjectId: p.subjectId, currentLesson: 0, lastAdvancedDate: today })),
      ],
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timetable, classProgress]);

  // 화면을 열 때 한 번, 학사일정 기준으로 지난 날짜만큼 자동으로 진도를 올린다
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const today = todayYMD();
      const rows = classProgress.filter((p) => p.lastAdvancedDate && p.lastAdvancedDate < today);
      if (rows.length === 0) return;
      const noClassDates = new Set<string>(Object.keys(holidays));
      if (settings.school) {
        const from = rows.reduce(
          (min, p) => (p.lastAdvancedDate! < min ? p.lastAdvancedDate! : min),
          rows[0].lastAdvancedDate!,
        );
        try {
          const { schedule } = await api.schoolSchedule(settings.school, from, today);
          for (const item of schedule) if (item.noClass) noClassDates.add(item.date);
        } catch {
          // 학사일정을 못 받아와도 사용자 지정 휴일만으로 계속 진행한다
        }
      }
      if (cancelled) return;
      update((prev) => ({
        classProgress: prev.classProgress.map((row) => {
          if (!row.lastAdvancedDate || row.lastAdvancedDate >= today) return row;
          const occurrences = weeklyOccurrences(prev.progressTimetable, row.classId, row.subjectId);
          const gained = countElapsedLessons(occurrences, row.lastAdvancedDate, today, noClassDates);
          return { ...row, currentLesson: row.currentLesson + gained, lastAdvancedDate: today };
        }),
      }));
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setCurrentLesson(classId: string, subjectId: string, currentLesson: number) {
    update((prev) => ({
      classProgress: prev.classProgress.map((p) =>
        p.classId === classId && p.subjectId === subjectId ? { ...p, currentLesson } : p,
      ),
    }));
  }

  const classNameOf = (id: string) => classes.find((c) => c.id === id)?.name || '(이름 없음)';
  const subjectOf = (id: string) => subjects.find((s) => s.id === id);

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
      <h3 className="mb-3 text-sm font-bold text-slate-700">반별 진도</h3>
      {assignedPairs.size === 0 ? (
        <p className="py-3 text-sm text-slate-400">교시별 반 배정을 먼저 해주세요.</p>
      ) : (
        <ul className="space-y-2">
          {[...assignedPairs.values()].map(({ classId, subjectId }) => {
            const subject = subjectOf(subjectId);
            const row = classProgress.find((p) => p.classId === classId && p.subjectId === subjectId);
            const current = row?.currentLesson ?? 0;
            const total = subject?.totalLessons ?? 0;
            const percent = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
            return (
              <li key={`${classId}::${subjectId}`} className="rounded-xl bg-slate-50 px-3 py-2.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-700">
                    {classNameOf(classId)} · {subject?.name || '(이름 없음)'}
                  </span>
                  <span className="text-xs text-slate-400">{percent}%</span>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full rounded-full bg-mint-400" style={{ width: `${percent}%` }} />
                  </div>
                  <input
                    type="number"
                    min={0}
                    value={current}
                    onChange={(e) => setCurrentLesson(classId, subjectId, Math.max(0, Number(e.target.value) || 0))}
                    className="w-14 shrink-0 rounded-lg border border-slate-200 px-1.5 py-1 text-right text-xs outline-none focus:border-mint-400"
                  />
                  <span className="shrink-0 text-xs text-slate-400">/ {total}차시</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 2: 타입체크**

```
cd client && npx tsc --noEmit
```
Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add client/src/components/progress/ProgressList.tsx
git commit -m "feat: 반+과목별 진도 목록 + 자동 진행(ProgressList)"
```

---

### Task 8: 화면 조립 + 전체 검증

**Files:**
- Modify: `client/src/views/ProgressView.tsx`

**Interfaces:**
- Consumes: `ClassManager`(Task 4), `SubjectManager`(Task 5), `AssignmentGrid`(Task 6),
  `ProgressList`(Task 7) — 전부 `client/src/components/progress/`.

- [ ] **Step 1: `ProgressView.tsx`를 실제 화면으로 교체**

`client/src/views/ProgressView.tsx` 전체를 아래로 교체:

```tsx
import { ClipboardList } from 'lucide-react';
import ClassManager from '../components/progress/ClassManager';
import SubjectManager from '../components/progress/SubjectManager';
import AssignmentGrid from '../components/progress/AssignmentGrid';
import ProgressList from '../components/progress/ProgressList';

export default function ProgressView() {
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800">
        <ClipboardList size={18} className="text-mint-500" />
        진도계획표
      </h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ClassManager />
        <SubjectManager />
      </div>
      <AssignmentGrid />
      <ProgressList />
    </div>
  );
}
```

- [ ] **Step 2: 타입체크 + 전체 테스트**

```
cd client && npx tsc --noEmit
cd .. && npm test
```
Expected: 에러 없음, 서버+클라이언트 테스트 전부 통과(Task 1·2·3에서 추가/수정한
테스트 포함).

- [ ] **Step 3: 개발 서버로 전체 흐름 눈 확인**

```
npm run dev
```

브라우저에서 로그인 → 사이드바 "진도계획표" 클릭 → 순서대로 확인:
1. "반 추가"로 반 2개(예: 1-1, 1-2) 등록
2. "과목 추가"로 과목 1개(예: 수학, 총 10차시) 등록
3. "교시별 반 배정" 표에서 월요일 1교시에 "1-1 · 수학" 선택, 화요일 1교시에도
   "1-1 · 수학" 선택
4. "반별 진도" 목록에 "1-1 · 수학  0% ... 0 / 10차시"가 뜨는지 확인
5. 진도 칸에 직접 숫자(예: 3)를 입력해 저장되는지, 새로고침해도 유지되는지 확인
6. 반·과목 이름을 바꿨을 때 배정 그리드와 진도 목록에도 바로 반영되는지 확인
7. 모바일 폭(<lg)에서 "더보기" 시트로도 진입되는지 확인

- [ ] **Step 4: 커밋**

```bash
git add client/src/views/ProgressView.tsx
git commit -m "feat: 진도계획표 화면 조립 완료(1단계)"
```
