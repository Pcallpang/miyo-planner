# 오늘의 시간표 기본 노출 + 최소화 토글 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 미요 플래너 위젯의 기본 화면을 "오늘의 시간표 전체 목록"으로 바꾸고, 새 최소화 버튼으로 지금의 "한 줄 메시지 + 다음 시간표" 축소 화면과 토글할 수 있게 한다.

**Architecture:** `src/lib/schedule.ts`에 순수 함수 두 개(`getPhaseMessage`, `getNextPeriodIndex`)를 추가해 축소 화면 텍스트/다음 교시 계산을 테스트 가능하게 분리하고, `src/lib/widgetPrefs.ts`에 최소화 on/off를 localStorage에 저장하는 getter/setter를 추가한다. `src/App.tsx`는 이 두 모듈을 조합해 렌더링 분기만 담당한다.

**Tech Stack:** React + TypeScript (Vite), Vitest for unit tests. 기존 파일의 스타일(TailwindCSS 유틸리티 클래스)을 그대로 재사용한다.

## Global Constraints

- 주말(`phase.kind === 'weekend'`)은 최소화 상태와 무관하게 항상 메시지만 보여준다 (시간표 데이터가 없으므로).
- 최소화 on/off는 `localStorage`에 저장되어 위젯 재시작 후에도 유지된다 (스펙: `docs/superpowers/specs/2026-08-31-dashboard-default-minimize-design.md`).
- 기존 전체 시간표 `<ul>` 렌더링 로직(색상, 취소선, 보강 표시 등)은 변경하지 않고 그대로 재사용한다.

---

## Task 1: 최소화 상태 저장 (`widgetPrefs.ts`)

**Files:**
- Modify: `src/lib/widgetPrefs.ts`
- Test: `src/lib/widgetPrefs.test.ts`

**Interfaces:**
- Produces: `getMinimized(): boolean`, `setMinimized(value: boolean): void`

- [ ] **Step 1: Write the failing tests**

`src/lib/widgetPrefs.test.ts` 맨 아래에 추가:

```ts
import { getMinimized, setMinimized, getOpacity, setOpacity } from './widgetPrefs';
```

(기존 import 줄 `import { getOpacity, setOpacity } from './widgetPrefs';` 를 위처럼 확장한다.)

파일 끝에 추가:

```ts
describe('getMinimized / setMinimized', () => {
  test('저장된 값이 없으면 기본값(false, 펼침)을 반환한다', () => {
    expect(getMinimized()).toBe(false);
  });

  test('true로 저장하면 true를 돌려준다', () => {
    setMinimized(true);
    expect(getMinimized()).toBe(true);
  });

  test('false로 저장하면 false를 돌려준다', () => {
    setMinimized(true);
    setMinimized(false);
    expect(getMinimized()).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- widgetPrefs`
Expected: FAIL — `getMinimized`/`setMinimized` are not exported from `./widgetPrefs`

- [ ] **Step 3: Implement**

`src/lib/widgetPrefs.ts` 맨 아래에 추가:

```ts

/** 위젯을 "전체 시간표"로 볼지 "한 줄 요약(최소화)"으로 볼지. 껐다 켜도 유지되도록 저장한다. */
const MINIMIZED_KEY = 'miyo.widget.minimized';

export function getMinimized(): boolean {
  return localStorage.getItem(MINIMIZED_KEY) === 'true';
}

export function setMinimized(value: boolean): void {
  localStorage.setItem(MINIMIZED_KEY, String(value));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- widgetPrefs`
Expected: PASS (all `getOpacity/setOpacity` tests + 3 new `getMinimized/setMinimized` tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/widgetPrefs.ts src/lib/widgetPrefs.test.ts
git commit -m "feat: 위젯 최소화 상태 저장 기능 추가"
```

---

## Task 2: 축소 화면 텍스트 계산 (`schedule.ts`)

**Files:**
- Modify: `src/lib/schedule.ts`
- Test: `src/lib/schedule.test.ts`

**Interfaces:**
- Consumes: `DayPhase` (기존 타입, `schedule.ts`에 정의됨), `PeriodTime`/`PeriodSlot` (`../types`)
- Produces:
  - `getPhaseMessage(phase: DayPhase, periodTimes: PeriodTime[], currentSlot?: PeriodSlot): string`
  - `getNextPeriodIndex(phase: DayPhase, periodCount: number): number | null`

- [ ] **Step 1: Write the failing tests**

`src/lib/schedule.test.ts` 상단 import를 아래로 교체:

```ts
import { describe, expect, test } from 'vitest';
import { getDayPhase, getPhaseMessage, getNextPeriodIndex } from './schedule';
import type { PeriodTime } from '../types';
```

파일 끝에 추가:

```ts

describe('getPhaseMessage', () => {
  test('주말 메시지', () => {
    expect(getPhaseMessage({ kind: 'weekend' }, times)).toBe('주말이에요. 편안한 하루 보내세요.');
  });

  test('일과 전 메시지는 첫 교시 시작 시각을 포함한다', () => {
    expect(getPhaseMessage({ kind: 'before' }, times)).toBe('아직 일과 전이에요. 09:00에 시작해요.');
  });

  test('일과 후 메시지', () => {
    expect(getPhaseMessage({ kind: 'after' }, times)).toBe('오늘 일과가 끝났어요. 수고하셨어요!');
  });

  test('쉬는 시간 메시지', () => {
    expect(getPhaseMessage({ kind: 'break', nextIndex: 1 }, times)).toBe('쉬는 시간이에요');
  });

  test('수업 중 메시지는 교시 번호와 과목을 포함한다', () => {
    expect(getPhaseMessage({ kind: 'period', index: 0 }, times, { subject: '수학', room: '201' })).toBe(
      '1교시 진행 중 · 수학 201',
    );
  });

  test('수업 중인데 과목이 미배정이면 교시 번호만 보여준다', () => {
    expect(getPhaseMessage({ kind: 'period', index: 0 }, times, { subject: '', room: '' })).toBe('1교시 진행 중');
  });
});

describe('getNextPeriodIndex', () => {
  test('일과 전이면 0교시(첫 교시)를 가리킨다', () => {
    expect(getNextPeriodIndex({ kind: 'before' }, 2)).toBe(0);
  });

  test('교시가 하나도 없으면 일과 전이어도 다음 교시가 없다', () => {
    expect(getNextPeriodIndex({ kind: 'before' }, 0)).toBeNull();
  });

  test('쉬는 시간이면 nextIndex를 그대로 가리킨다', () => {
    expect(getNextPeriodIndex({ kind: 'break', nextIndex: 1 }, 2)).toBe(1);
  });

  test('수업 중이면 다음 교시(index+1)를 가리킨다', () => {
    expect(getNextPeriodIndex({ kind: 'period', index: 0 }, 2)).toBe(1);
  });

  test('마지막 교시 수업 중이면 다음 교시가 없다', () => {
    expect(getNextPeriodIndex({ kind: 'period', index: 1 }, 2)).toBeNull();
  });

  test('일과 후/주말은 다음 교시가 없다', () => {
    expect(getNextPeriodIndex({ kind: 'after' }, 2)).toBeNull();
    expect(getNextPeriodIndex({ kind: 'weekend' }, 2)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- schedule`
Expected: FAIL — `getPhaseMessage`/`getNextPeriodIndex` are not exported from `./schedule`

- [ ] **Step 3: Implement**

`src/lib/schedule.ts` 상단 import를 아래로 교체:

```ts
import type { PeriodSlot, PeriodTime } from '../types';
```

파일 끝에 추가:

```ts

/** 최소화 화면에 보여줄 한 줄 상태 메시지. `currentSlot`은 phase.kind === 'period'일 때만 쓴다. */
export function getPhaseMessage(phase: DayPhase, periodTimes: PeriodTime[], currentSlot?: PeriodSlot): string {
  switch (phase.kind) {
    case 'weekend':
      return '주말이에요. 편안한 하루 보내세요.';
    case 'before':
      return `아직 일과 전이에요. ${periodTimes[0]?.start ?? ''}에 시작해요.`;
    case 'after':
      return '오늘 일과가 끝났어요. 수고하셨어요!';
    case 'break':
      return '쉬는 시간이에요';
    case 'period': {
      const label = `${phase.index + 1}교시 진행 중`;
      if (!currentSlot?.subject.trim()) return label;
      return `${label} · ${currentSlot.subject}${currentSlot.room ? ` ${currentSlot.room}` : ''}`;
    }
  }
}

/** 최소화 화면의 "다음 시간표" 줄에 쓸 교시 인덱스. 다음 교시가 없으면 null. */
export function getNextPeriodIndex(phase: DayPhase, periodCount: number): number | null {
  switch (phase.kind) {
    case 'before':
      return periodCount > 0 ? 0 : null;
    case 'break':
      return phase.nextIndex < periodCount ? phase.nextIndex : null;
    case 'period':
      return phase.index + 1 < periodCount ? phase.index + 1 : null;
    default:
      return null;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- schedule`
Expected: PASS (기존 `getDayPhase` 테스트 + 새 12개 테스트)

- [ ] **Step 5: Commit**

```bash
git add src/lib/schedule.ts src/lib/schedule.test.ts
git commit -m "feat: 축소 화면용 상태 메시지·다음 교시 계산 함수 추가"
```

---

## Task 3: 화면 렌더링 — 기본 대시보드 + 최소화 토글 (`App.tsx`)

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `getMinimized`/`setMinimized` (Task 1), `getPhaseMessage`/`getNextPeriodIndex` (Task 2), 기존 `getDayPhase`, `effectiveSlot`, `buildSubjectColors`

이 태스크는 UI 조립이라 자동 테스트가 없다. 대신 Step 4에서 `npm run dev`로 수동 확인한다.

- [ ] **Step 1: `WidgetControls`에 최소화 토글 버튼 추가**

`src/App.tsx`의 `WidgetControls` 함수 시그니처를 교체:

```tsx
function WidgetControls({
  opacity,
  onOpacityChange,
  minimized,
  onToggleMinimize,
}: {
  opacity: number;
  onOpacityChange: (value: number) => void;
  minimized: boolean;
  onToggleMinimize: () => void;
}) {
```

같은 함수 안, 첫 번째 `<button>`(⚙) 바로 위에 추가:

```tsx
      <button
        type="button"
        onClick={onToggleMinimize}
        title={minimized ? '전체 시간표 보기' : '최소화'}
        aria-label={minimized ? '전체 시간표 보기' : '최소화'}
        className="flex h-5 w-5 items-center justify-center rounded text-xs text-white/80 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] hover:bg-white/15 hover:text-white"
      >
        {minimized ? '⤢' : '－'}
      </button>
```

- [ ] **Step 2: `Shell`에 최소화 props 추가하고 App 세 곳의 호출부에 전달**

`Shell` 함수 시그니처 교체:

```tsx
function Shell({
  opacity,
  onOpacityChange,
  minimized,
  onToggleMinimize,
  children,
}: {
  opacity: number;
  onOpacityChange: (value: number) => void;
  minimized: boolean;
  onToggleMinimize: () => void;
  children: React.ReactNode;
}) {
```

`Shell` 내부의 `<WidgetControls opacity={opacity} onOpacityChange={onOpacityChange} />` 호출을 교체:

```tsx
          <WidgetControls
            opacity={opacity}
            onOpacityChange={onOpacityChange}
            minimized={minimized}
            onToggleMinimize={onToggleMinimize}
          />
```

`App` 함수 안, `opacity` state 바로 아래에 추가:

```tsx
  const [minimized, setMinimizedState] = useState(() => getMinimized());

  function handleToggleMinimize() {
    const next = !minimized;
    setMinimizedState(next);
    setMinimized(next);
  }
```

`App`이 `<Shell opacity={opacity} onOpacityChange={handleOpacityChange}>`를 호출하는 세 곳(로딩 중 / 로그인 필요 / 데이터 로딩 중) 모두 아래처럼 props 추가:

```tsx
      <Shell
        opacity={opacity}
        onOpacityChange={handleOpacityChange}
        minimized={minimized}
        onToggleMinimize={handleToggleMinimize}
      >
```

- [ ] **Step 3: import 추가 및 본문 렌더링 로직 교체**

파일 상단 import 블록을 아래로 교체:

```tsx
import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { getDayPhase, getPhaseMessage, getNextPeriodIndex } from './lib/schedule';
import { effectiveSlot } from './lib/scheduleSlot';
import { buildSubjectColors, classColorKey } from './lib/subjectColors';
import { getOpacity, setOpacity, getMinimized, setMinimized } from './lib/widgetPrefs';
import type { AppDataResult } from './miyo';
```

데이터가 있을 때의 렌더링 블록에서 아래 부분:

```tsx
  const { settings, timetable, swapOverrides, canceledLessons, makeupLessons, subjectColors } = data;
  const phase = getDayPhase(now, settings.periodTimes, settings.periodCount);
  const todayKey = format(now, 'yyyy-MM-dd');
  const colors = buildSubjectColors(timetable, subjectColors);

  let shortMessage = '';
  if (phase.kind === 'weekend') shortMessage = '주말이에요. 편안한 하루 보내세요.';
  else if (phase.kind === 'before') shortMessage = `아직 일과 전이에요. ${settings.periodTimes[0]?.start ?? ''}에 시작해요.`;
  else if (phase.kind === 'after') shortMessage = '오늘 일과가 끝났어요. 수고하셨어요!';
```

을 아래로 교체:

```tsx
  const { settings, timetable, swapOverrides, canceledLessons, makeupLessons, subjectColors } = data;
  const phase = getDayPhase(now, settings.periodTimes, settings.periodCount);
  const todayKey = format(now, 'yyyy-MM-dd');
  const colors = buildSubjectColors(timetable, subjectColors);

  // 주말은 시간표 데이터 자체가 없어 최소화 여부와 무관하게 항상 메시지만 보여준다.
  const isWeekend = phase.kind === 'weekend';
  const showDashboard = !isWeekend && !minimized;

  const currentSlot =
    phase.kind === 'period' ? effectiveSlot(timetable, swapOverrides, todayKey, phase.index) : undefined;
  const compactMessage = showDashboard ? '' : getPhaseMessage(phase, settings.periodTimes, currentSlot);
  const nextIndex = showDashboard ? null : getNextPeriodIndex(phase, settings.periodCount);
  const nextSlot = nextIndex !== null ? effectiveSlot(timetable, swapOverrides, todayKey, nextIndex) : null;
  const nextTime = nextIndex !== null ? settings.periodTimes[nextIndex] : null;
```

그 아래, 헤더의 두 번째 `WidgetControls` 호출:

```tsx
            <WidgetControls opacity={opacity} onOpacityChange={handleOpacityChange} />
```

을 교체:

```tsx
            <WidgetControls
              opacity={opacity}
              onOpacityChange={handleOpacityChange}
              minimized={minimized}
              onToggleMinimize={handleToggleMinimize}
            />
```

마지막으로, 본문 분기 블록 전체:

```tsx
        {shortMessage ? (
          <p className="flex flex-1 items-center justify-center text-center text-sm text-white/90 drop-shadow">
            {shortMessage}
          </p>
        ) : (
          <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto px-1">
            {Array.from({ length: settings.periodCount }, (_, i) => {
              ...
            })}
          </ul>
        )}
```

을 아래로 교체 (`<ul>...</ul>` 내부는 기존 코드를 그대로 옮긴다 — 변경 없음):

```tsx
        {showDashboard ? (
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
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-1 p-4 text-center">
            <p className="text-sm text-white/90 drop-shadow">{compactMessage}</p>
            {nextIndex !== null && nextSlot && (
              <p className="text-xs text-white/70 drop-shadow">
                다음 · {nextIndex + 1}교시 {nextSlot.subject || '미배정'}
                {nextSlot.room ? ` ${nextSlot.room}` : ''}
                {nextTime ? ` (${nextTime.start}~${nextTime.end})` : ''}
              </p>
            )}
          </div>
        )}
```

- [ ] **Step 4: 타입 체크 + 수동 확인**

Run: `npm run build` (또는 프로젝트에 `tsc --noEmit` 스크립트가 있으면 그것)
Expected: 타입 에러 없이 성공

수동 확인 (`npm run dev` 또는 기존 위젯 실행 방법으로):
1. 위젯을 켰을 때 평일이면 전체 시간표 목록이 기본으로 보이는지 확인.
2. 새로 생긴 "－" 버튼을 눌러 최소화 → 상태 메시지 + "다음 · N교시 ..." 줄이 보이는지 확인.
3. "⤢" 버튼을 눌러 다시 펼쳤을 때 전체 목록으로 돌아오는지 확인.
4. 위젯을 껐다 켜서(재시작) 최소화 상태가 유지되는지 확인.
5. 주말에는(또는 시스템 날짜를 주말로 바꿔) 최소화 버튼을 눌러도 항상 메시지만 보이는지 확인.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat: 오늘의 시간표를 기본 화면으로, 최소화 버튼으로 요약 화면 전환"
```
