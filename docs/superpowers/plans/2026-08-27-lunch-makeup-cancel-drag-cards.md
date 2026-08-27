# 점심시간·보강·휴강 드래그 카드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** "오늘의 시간표" 화면 아래에 점심시간·보강·휴강 카드 3개를 두고, 드래그해서
시간표에 적용할 수 있게 한다.

**Architecture:** `WeeklyGrid.tsx`의 표(`<table>`)를 요일별로 독립된 세로 열(flex
column)로 다시 짠 뒤, 그 위에 카드 드래그 상태(`draggingCard`)와 두 개의 작은 신규
컴포넌트(`DragCardTray`, `MakeupDropForm`)를 얹는다. 보강·휴강은 기존
`saveMakeup`/`toggleCanceled` 로직을 그대로 재사용하고, 점심시간만 새 데이터 필드
(`lunchAfterPeriod`)로 저장한다.

**Tech Stack:** React + TypeScript(Vite), Tailwind CSS, HTML5 네이티브 드래그
(`draggable`/`onDragStart`/`onDrop`) — 이미 이 파일에서 칸 교환에 쓰던 것과 같은
방식.

## Global Constraints

- 이 프로젝트에는 자동 테스트가 없다(관례). 각 태스크의 검증은 `npx tsc --noEmit`
  통과 + 필요하면 `npm run dev`로 개발 서버를 띄워 직접 눈으로 확인하는 방식으로
  한다.
- 참조 스펙: `docs/superpowers/specs/2026-08-27-lunch-makeup-cancel-drag-cards-design.md`
- 기존 클릭 → `TimetableCellModal` 흐름, 기존 칸 교환 드래그(`dragging`/`pendingSwap`
  state)는 그대로 유지한다 — 이번 작업은 추가 진입로일 뿐이다.
- `client/`에서 명령을 실행할 때는 `cd client`(또는 절대경로) 후 실행한다.

---

### Task 1: 데이터 모델 — `lunchAfterPeriod` 추가

**Files:**
- Modify: `client/src/types.ts`
- Modify: `client/src/lib/appData.ts`
- Modify: `server/lib/appState.js`

**Interfaces:**
- Produces: `LunchAfterPeriod` 타입(`Record<number, number>`, 요일 1~5 → 0-based
  교시 인덱스), `AppData.lunchAfterPeriod: LunchAfterPeriod` 필드. 이후 태스크들이
  `data.lunchAfterPeriod`로 읽고 `update((prev) => ({ lunchAfterPeriod: ... }))`로
  쓴다.

- [ ] **Step 1: `types.ts`에 타입과 필드 추가**

`client/src/types.ts`에서 `MakeupLesson` 인터페이스 바로 아래(현재 205번째 줄
부근, `export interface AppData {` 앞)에 추가:

```ts
/** 요일(1=월~5=금)별로 점심시간 표시줄을 몇 교시 뒤에 끼워 넣을지. 값이 없는
 *  요일은 점심줄이 없다. 순수 화면 표시용 — 교시 번호·시간표 데이터·진도 계산에는
 *  전혀 영향을 주지 않는다. */
export type LunchAfterPeriod = Record<number, number>; // day -> 0-based period index
```

같은 파일의 `AppData` 인터페이스 안, `makeupLessons: MakeupLesson[];` 바로 아래에
한 줄 추가:

```ts
  makeupLessons: MakeupLesson[];
  /** 요일별 점심시간 표시줄 위치(화면 표시 전용). 없는 요일은 점심줄 없음. */
  lunchAfterPeriod: LunchAfterPeriod;
```

- [ ] **Step 2: `appData.ts`의 기본값에 추가**

`client/src/lib/appData.ts`의 `defaultAppData()` 안, `makeupLessons: [],` 바로
아래에 추가:

```ts
    makeupLessons: [],
    lunchAfterPeriod: {},
```

- [ ] **Step 3: 서버 기본값·허용 목록에 추가**

`server/lib/appState.js`의 `defaultAppState()` 안, `makeupLessons: [],` 바로
아래에 추가:

```js
    makeupLessons: [],
    lunchAfterPeriod: {},
```

같은 파일의 `KEYS` 배열에 `'lunchAfterPeriod'`를 추가:

```js
const KEYS = [
  'todos', 'meetings', 'memos', 'timetable', 'settings', 'holidays', 'overtimeLogs', 'overtimePunches',
  'subjectProgress', 'canceledLessons', 'swapOverrides', 'makeupLessons', 'lunchAfterPeriod',
  'subjectLessonNotes', 'subjectColors', 'ddays',
];
```

- [ ] **Step 4: 타입 체크**

Run: `cd "client" && npx tsc --noEmit`
Expected: 에러 없이 종료(빈 출력).

- [ ] **Step 5: Commit**

```bash
git add client/src/types.ts client/src/lib/appData.ts server/lib/appState.js
git commit -m "feat: 요일별 점심시간 표시 위치(lunchAfterPeriod) 데이터 필드 추가"
```

---

### Task 2: `WeeklyGrid.tsx` — 표를 요일별 독립 열 구조로 리팩터링

이번 태스크는 **동작 변경 없이** 화면 구조만 바꾼다(다음 태스크들이 이 구조 위에
점심줄·카드를 얹는다). 끝나고 나면 지금과 똑같이 보이고 똑같이 동작해야 한다 —
칸 클릭 → 수정 모달, 칸 드래그 → 교환 확인창, 휴강·보강 배지, 색상, 오늘 강조 전부
그대로.

**Files:**
- Modify: `client/src/components/timetable/WeeklyGrid.tsx` (렌더 부분만 교체)

**Interfaces:**
- Consumes: Task 1의 `data.lunchAfterPeriod`는 아직 안 씀(다음 태스크에서).
- Produces: 이후 태스크가 이어 붙일 위치 — 요일별 `<div className="flex ... flex-col gap-1">`
  안에서 `Array.from({ length: settings.periodCount }, (_, i) => (...))`로
  칸들을 렌더링하는 부분.

- [ ] **Step 1: 렌더 부분 교체**

`client/src/components/timetable/WeeklyGrid.tsx`에서 `return (` 이후,
`<div className="overflow-x-auto">`로 시작해 `</div>`(표 전체)로 끝나는 블록
전체(원래 파일 기준 277~395번째 줄, `<table>...</table>`을 감싼 `overflow-x-auto`
div)를 아래로 통째로 교체한다:

```tsx
      <div className="overflow-x-auto">
        <div className="flex min-w-2xl gap-1 text-sm">
          {/* 교시 번호 열 — 참조용 라벨. 어떤 요일에 점심줄이 끼면 그 요일과는
              높이가 어긋나는 게 의도된 동작이다(요일마다 독립적으로 밀림). */}
          <div className="flex w-10 flex-col gap-1">
            <div className="h-11" />
            {Array.from({ length: settings.periodCount }, (_, i) => (
              <div key={i} className="flex min-h-14 items-center justify-center p-1.5">
                <span
                  className={`grid h-7 w-7 place-items-center rounded-lg text-xs font-bold ${
                    isThisWeek && i === currentPeriod ? 'bg-mint-500 text-white' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {i + 1}
                </span>
              </div>
            ))}
          </div>

          {WEEKDAYS.map(({ day, label }) => {
            const date = addDays(weekStart, day - 1);
            const dateKey = format(date, 'yyyy-MM-dd');
            const holiday = holidayByDate.get(dateKey);
            const isToday = isThisWeek && dateKey === todayKey;
            return (
              <div key={day} className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="h-11 pb-1 text-xs font-medium align-top">
                  <div className={isToday ? 'text-mint-600' : 'text-slate-500'}>
                    {label} {format(date, 'M/d')}
                  </div>
                  <div
                    className="mt-0.5 line-clamp-2 h-6 text-[10px] font-normal leading-3 text-rose-500"
                    title={holiday}
                  >
                    {holiday}
                  </div>
                </div>

                {Array.from({ length: settings.periodCount }, (_, i) => {
                  const cellDateKey = format(addDays(weekStart, day - 1), 'yyyy-MM-dd');
                  const slot = slotAt(cellDateKey, i);
                  const isManualCanceled = canceledLessons.some((c) => c.date === cellDateKey && c.period === i);
                  const isAutoCanceled = autoCanceledDates.has(cellDateKey);
                  const isCanceled = isManualCanceled || isAutoCanceled;
                  const isSwapped = swapOverrides.some((o) => o.date === cellDateKey && o.period === i);
                  const makeup = makeupLessons.find((m) => m.date === cellDateKey && m.period === i);
                  const isDragging = dragging?.day === day && dragging?.period === i;
                  const isNow = isThisWeek && i === currentPeriod && cellDateKey === todayKey;
                  const color = slot.subject.trim()
                    ? subjectColors.get(classColorKey(slot.subject, slot.room))
                    : undefined;
                  return (
                    <div
                      key={i}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (dragging && !(dragging.day === day && dragging.period === i)) {
                          setPendingSwap({ a: dragging, b: { day, period: i } });
                        }
                        setDragging(null);
                      }}
                      className={`rounded-lg p-1 ${isNow ? 'ring-2 ring-mint-300' : ''}`}
                    >
                      <button
                        type="button"
                        draggable
                        onClick={() => setEditing({ day, period: i })}
                        onDragStart={() => setDragging({ day, period: i })}
                        onDragEnd={() => setDragging(null)}
                        className={`relative flex min-h-14 w-full cursor-grab flex-col items-center justify-center gap-0.5 rounded-lg p-1.5 text-center transition active:cursor-grabbing ${
                          isDragging ? 'opacity-40' : ''
                        } ${
                          isCanceled
                            ? 'bg-slate-100 opacity-60'
                            : color
                              ? `${color.bg} hover:brightness-95`
                              : 'bg-slate-50/70 hover:bg-slate-100'
                        }`}
                      >
                        {isSwapped && (
                          <span className="absolute left-1 top-1 rounded bg-sky-400 px-1 text-[9px] font-bold text-white">
                            교환
                          </span>
                        )}
                        {isCanceled && (
                          <span className="absolute right-1 top-1 rounded bg-slate-400 px-1 text-[9px] font-bold text-white">
                            휴강
                          </span>
                        )}
                        <span
                          className={`w-full truncate text-xs font-medium ${
                            isCanceled ? 'text-slate-400 line-through' : color ? color.text : 'text-slate-300'
                          }`}
                        >
                          {slot.subject || '미배정'}
                        </span>
                        {slot.room && (
                          <span
                            className={`w-full truncate text-[11px] opacity-80 ${
                              isCanceled ? 'text-slate-400' : color ? color.text : 'text-slate-400'
                            }`}
                          >
                            {slot.room}
                          </span>
                        )}
                        {makeup && (
                          <span className="w-full truncate rounded bg-violet-100 px-1 text-[10px] font-medium text-violet-700">
                            보강 · {makeup.subject}
                            {makeup.room ? ` ${makeup.room}` : ''}
                          </span>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
```

- [ ] **Step 2: 타입 체크**

Run: `cd "client" && npx tsc --noEmit`
Expected: 에러 없이 종료.

- [ ] **Step 3: 개발 서버에서 눈으로 확인**

Run: `cd "client" && npm run dev` (백그라운드로 띄워도 됨)

브라우저에서 "오늘의 시간표" 화면 열어서 확인:
- 표가 이전과 똑같이 보이는지(월~금 5열, 교시 번호 왼쪽)
- 요일 헤더와 학사일정 배지, "오늘" 강조가 그대로인지
- 칸 클릭 → 수정 모달이 뜨는지, 저장이 되는지
- 칸을 드래그해서 다른 칸에 놓으면 교환 확인창이 뜨는지
- 헤더 줄과 첫 교시 줄 사이 높이가 어색하게 벌어지거나 겹치지 않는지(어긋나면
  `h-11` 값을 조정)

- [ ] **Step 4: Commit**

```bash
git add client/src/components/timetable/WeeklyGrid.tsx
git commit -m "refactor: 시간표를 표(table)에서 요일별 독립 열 구조로 변경"
```

---

### Task 3: 카드 트레이 + 점심시간 드래그

**Files:**
- Create: `client/src/components/timetable/DragCardTray.tsx`
- Modify: `client/src/components/timetable/WeeklyGrid.tsx`

**Interfaces:**
- Produces: `DragCardTray` 컴포넌트 — props
  `{ onCardDragStart: (kind: 'lunch' | 'makeup' | 'cancel') => void; onCardDragEnd: () => void; onTrayDrop: () => void; lunchDropActive: boolean }`.
  Task 4, 5가 같은 `onCardDragStart`/`onCardDragEnd`를 그대로 재사용한다.
- Consumes: Task 1의 `data.lunchAfterPeriod`.

- [ ] **Step 1: `DragCardTray.tsx` 작성**

```tsx
interface Props {
  onCardDragStart: (kind: 'lunch' | 'makeup' | 'cancel') => void;
  onCardDragEnd: () => void;
  onTrayDrop: () => void;
  lunchDropActive: boolean;
}

const CARD_STYLES: Record<'lunch' | 'makeup' | 'cancel', string> = {
  lunch: 'border-amber-200 bg-amber-50 text-amber-700',
  makeup: 'border-violet-200 bg-violet-50 text-violet-700',
  cancel: 'border-slate-300 bg-slate-100 text-slate-600',
};

const CARD_LABELS: Record<'lunch' | 'makeup' | 'cancel', string> = {
  lunch: '점심시간',
  makeup: '보강',
  cancel: '휴강',
};

/** 시간표 아래 카드 트레이. 점심시간 카드는 교시 사이 틈에, 보강·휴강 카드는
 *  칸 위에 드래그해서 놓는다. 이미 끼운 점심시간 줄을 다시 이 트레이로 드래그하면
 *  없앨 수 있다(그때는 lunchDropActive가 true가 되어 트레이가 옅게 강조된다). */
export default function DragCardTray({ onCardDragStart, onCardDragEnd, onTrayDrop, lunchDropActive }: Props) {
  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={onTrayDrop}
      className={`mt-3 flex gap-2 rounded-xl border-t border-slate-100 pt-3 transition ${
        lunchDropActive ? 'bg-rose-50/60' : ''
      }`}
    >
      {(['lunch', 'makeup', 'cancel'] as const).map((kind) => (
        <div
          key={kind}
          draggable
          onDragStart={() => onCardDragStart(kind)}
          onDragEnd={onCardDragEnd}
          className={`flex-1 cursor-grab select-none rounded-xl border px-3 py-2 text-center text-xs font-semibold active:cursor-grabbing ${CARD_STYLES[kind]}`}
        >
          {CARD_LABELS[kind]}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: `WeeklyGrid.tsx`에 state·핸들러 추가**

`const [pendingSwap, setPendingSwap] = useState<{ a: Cell; b: Cell } | null>(null);`
바로 아래에 추가:

```tsx
  const [draggingCard, setDraggingCard] = useState<'lunch' | 'makeup' | 'cancel' | null>(null);
  const [draggingLunchFromDay, setDraggingLunchFromDay] = useState<number | null>(null);
```

`function saveMakeup(...) { ... }` 함수 바로 아래에 추가:

```tsx
  /** 요일별 점심시간 표시줄 위치를 정하거나 옮긴다(화면 표시 전용, 요일당 1개). */
  function setLunchAfterPeriod(day: number, period: number) {
    update((prev) => ({ lunchAfterPeriod: { ...prev.lunchAfterPeriod, [day]: period } }));
  }

  /** 그 요일의 점심시간 표시줄을 없앤다. */
  function removeLunchAfterPeriod(day: number) {
    update((prev) => {
      const next = { ...prev.lunchAfterPeriod };
      delete next[day];
      return { lunchAfterPeriod: next };
    });
  }
```

`const canceledLessons = data.canceledLessons;` 근처(다른 `const ... = data...`
줄들 옆)에 추가:

```tsx
  const lunchAfterPeriod = data.lunchAfterPeriod;
```

- [ ] **Step 3: 요일 열 안에 점심 틈/표시줄 삽입**

Task 2에서 만든 요일별 `Array.from({ length: settings.periodCount }, (_, i) => { ... return (<div key={i} ...>...</div>); })` 블록을, React가 여러 형제 엘리먼트를
반환할 수 있도록 `Fragment`로 감싸고 그 안에 점심 틈을 추가한다. 파일 맨 위 import에
`Fragment`를 추가:

```tsx
import { Fragment, useEffect, useState } from 'react';
```

`Array.from({ length: settings.periodCount }, (_, i) => { ... return ( <div key={i} ...> ... </div> ); })`의
`return (` 부분을 아래처럼 바꾼다(칸 `<div>` 자체는 그대로 두고, 그 뒤에 점심 틈을
붙인다):

```tsx
                  return (
                    <Fragment key={i}>
                      <div
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => {
                          if (dragging && !(dragging.day === day && dragging.period === i)) {
                            setPendingSwap({ a: dragging, b: { day, period: i } });
                          }
                          setDragging(null);
                        }}
                        className={`rounded-lg p-1 ${isNow ? 'ring-2 ring-mint-300' : ''}`}
                      >
                        {/* ...버튼 내용은 Task 2와 동일, 그대로 둔다... */}
                      </div>
                      {i < settings.periodCount - 1 &&
                        (lunchAfterPeriod[day] === i ? (
                          <div
                            draggable
                            onDragStart={() => {
                              setDraggingCard('lunch');
                              setDraggingLunchFromDay(day);
                            }}
                            onDragEnd={() => {
                              setDraggingCard(null);
                              setDraggingLunchFromDay(null);
                            }}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => {
                              setLunchAfterPeriod(day, i);
                              setDraggingCard(null);
                              setDraggingLunchFromDay(null);
                            }}
                            className="cursor-grab rounded bg-amber-100 py-1 text-center text-[10px] font-semibold text-amber-700 active:cursor-grabbing"
                          >
                            점심시간
                          </div>
                        ) : draggingCard === 'lunch' ? (
                          <div
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => {
                              setLunchAfterPeriod(day, i);
                              setDraggingCard(null);
                              setDraggingLunchFromDay(null);
                            }}
                            className="h-3 rounded border border-dashed border-amber-300 bg-amber-50/70"
                          />
                        ) : null)}
                    </Fragment>
                  );
```

(칸 `<div>` 안의 `<button>...</button>` 내용은 Task 2에서 작성한 것을 그대로
유지 — 바깥 `<div>` → `<Fragment>`로 감싸고 뒤에 점심 틈만 추가하는 것뿐이다.)

- [ ] **Step 4: 카드 트레이를 화면에 배치**

`WeeklyGrid.tsx`의 import에 추가:

```tsx
import DragCardTray from './DragCardTray';
```

표를 감싼 `<div className="overflow-x-auto">...</div>` 바로 아래, `{editing && ...}`
모달 블록 위에 추가:

```tsx
      <DragCardTray
        onCardDragStart={setDraggingCard}
        onCardDragEnd={() => {
          setDraggingCard(null);
          setDraggingLunchFromDay(null);
        }}
        onTrayDrop={() => {
          if (draggingCard === 'lunch' && draggingLunchFromDay != null) {
            removeLunchAfterPeriod(draggingLunchFromDay);
          }
          setDraggingCard(null);
          setDraggingLunchFromDay(null);
        }}
        lunchDropActive={draggingLunchFromDay != null}
      />
```

- [ ] **Step 5: 타입 체크**

Run: `cd "client" && npx tsc --noEmit`
Expected: 에러 없이 종료.

- [ ] **Step 6: 개발 서버에서 확인**

- 점심시간 카드를 수요일 3·4교시 사이 틈에 드롭 → 그 자리에 "점심시간" 줄이
  생기고, 그 아래 4교시부터 한 칸씩 밀리는지. 월·화·목·금은 그대로인지.
- 같은 카드를 화요일 1·2교시 사이에도 드롭 → 화요일도 독립적으로 반영되는지.
- 수요일 점심줄을 다시 카드 트레이 쪽으로 드래그 → 없어지고 수요일이 원래
  자리로 돌아오는지.
- 수요일 점심줄을 다른 틈(예: 4·5교시 사이)으로 바로 드래그 → 위치가 옮겨지는지.

- [ ] **Step 7: Commit**

```bash
git add client/src/components/timetable/DragCardTray.tsx client/src/components/timetable/WeeklyGrid.tsx
git commit -m "feat: 점심시간 카드 드래그로 요일별 표시줄 넣기/옮기기/빼기"
```

---

### Task 4: 보강 카드 드래그 → 입력창 → 저장

**Files:**
- Create: `client/src/components/timetable/MakeupDropForm.tsx`
- Modify: `client/src/components/timetable/WeeklyGrid.tsx`

**Interfaces:**
- Consumes: Task 3의 `draggingCard`, `setDraggingCard`; 기존 `saveMakeup(dateKey, period, subject, room)`.
- Produces: `MakeupDropForm` 컴포넌트 — props
  `{ top: number; left: number; onCancel: () => void; onSave: (subject: string, room: string) => void }`.

- [ ] **Step 1: `MakeupDropForm.tsx` 작성**

```tsx
import { useState } from 'react';

interface Props {
  top: number;
  left: number;
  onCancel: () => void;
  onSave: (subject: string, room: string) => void;
}

/** 보강 카드를 칸에 드롭했을 때 그 칸 근처에 뜨는 작은 입력창. 과목·교실을 입력해
 *  저장하면 기존 "칸 클릭 → 보강 저장"과 완전히 같은 데이터가 남는다. */
export default function MakeupDropForm({ top, left, onCancel, onSave }: Props) {
  const [subject, setSubject] = useState('');
  const [room, setRoom] = useState('');

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onCancel} />
      <div
        style={{ top, left }}
        className="fixed z-50 w-56 rounded-xl border border-violet-200 bg-white p-3 shadow-xl"
      >
        <p className="mb-2 text-xs font-semibold text-violet-600">보강 추가</p>
        <div className="mb-2 flex gap-1.5">
          <input
            autoFocus
            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-violet-400"
            placeholder="과목"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
          <input
            className="w-16 shrink-0 rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-violet-400"
            placeholder="반"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
          />
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => onSave(subject.trim(), room.trim())}
            disabled={!subject.trim()}
            className="flex-1 rounded-lg bg-violet-500 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            저장
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg border border-slate-200 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50"
          >
            취소
          </button>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: `WeeklyGrid.tsx`에 state 추가**

`const [draggingLunchFromDay, setDraggingLunchFromDay] = useState<number | null>(null);`
바로 아래에 추가:

```tsx
  const [makeupDrop, setMakeupDrop] = useState<{ dateKey: string; period: number; top: number; left: number } | null>(
    null,
  );
```

import에 추가:

```tsx
import MakeupDropForm from './MakeupDropForm';
```

- [ ] **Step 3: 칸의 `onDrop`에 보강 분기 추가**

Task 2/3에서 만든 칸 `<div>`의 `onDrop` 핸들러를 아래로 교체(맨 앞에 보강 분기
추가, 이벤트 파라미터 `e`를 받도록 시그니처 변경):

```tsx
                        onDrop={(e) => {
                          if (draggingCard === 'makeup') {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setMakeupDrop({ dateKey: cellDateKey, period: i, top: rect.bottom + 4, left: rect.left });
                            setDraggingCard(null);
                            return;
                          }
                          if (dragging && !(dragging.day === day && dragging.period === i)) {
                            setPendingSwap({ a: dragging, b: { day, period: i } });
                          }
                          setDragging(null);
                        }}
```

- [ ] **Step 4: 입력창을 화면에 배치**

`<DragCardTray ... />` 바로 아래에 추가:

```tsx
      {makeupDrop && (
        <MakeupDropForm
          top={makeupDrop.top}
          left={makeupDrop.left}
          onCancel={() => setMakeupDrop(null)}
          onSave={(subject, room) => {
            saveMakeup(makeupDrop.dateKey, makeupDrop.period, subject, room);
            setMakeupDrop(null);
          }}
        />
      )}
```

- [ ] **Step 5: 타입 체크**

Run: `cd "client" && npx tsc --noEmit`
Expected: 에러 없이 종료.

- [ ] **Step 6: 개발 서버에서 확인**

- 보강 카드를 빈 칸에 드롭 → 그 칸 근처에 입력창이 뜨는지, 과목 입력 후 저장하면
  "보강 · 과목" 배지가 그 칸에 뜨는지(클릭으로 넣은 보강과 똑같이 보이는지).
- 보강 카드를 이미 수업이 채워진 칸에 드롭해도 똑같이 동작하는지.
- 입력창에서 "취소" 누르면 아무것도 저장 안 되는지.
- 화면 가장자리 칸에 드롭했을 때 입력창이 화면 밖으로 잘리지 않는지(잘리면
  `left`/`top` 계산에 `window.innerWidth` 보정 추가 — 이번 태스크 범위 밖이면
  다음 개선 과제로 남긴다).

- [ ] **Step 7: Commit**

```bash
git add client/src/components/timetable/MakeupDropForm.tsx client/src/components/timetable/WeeklyGrid.tsx
git commit -m "feat: 보강 카드를 칸에 드래그하면 입력창에서 바로 보강 등록"
```

---

### Task 5: 휴강 카드 드래그 → 즉시 적용

**Files:**
- Modify: `client/src/components/timetable/WeeklyGrid.tsx`

**Interfaces:**
- Consumes: Task 3의 `draggingCard`; 기존 `toggleCanceled(dateKey, period, subject, className)`.

- [ ] **Step 1: 칸의 `onDrop`에 휴강 분기 추가**

Task 4에서 만든 `onDrop` 핸들러의 보강 분기 바로 아래에 추가:

```tsx
                        onDrop={(e) => {
                          if (draggingCard === 'makeup') {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setMakeupDrop({ dateKey: cellDateKey, period: i, top: rect.bottom + 4, left: rect.left });
                            setDraggingCard(null);
                            return;
                          }
                          if (draggingCard === 'cancel') {
                            toggleCanceled(cellDateKey, i, slot.subject.trim(), slot.room.trim());
                            setDraggingCard(null);
                            return;
                          }
                          if (dragging && !(dragging.day === day && dragging.period === i)) {
                            setPendingSwap({ a: dragging, b: { day, period: i } });
                          }
                          setDragging(null);
                        }}
```

- [ ] **Step 2: 타입 체크**

Run: `cd "client" && npx tsc --noEmit`
Expected: 에러 없이 종료.

- [ ] **Step 3: 개발 서버에서 확인**

- 휴강 카드를 빈 칸/채워진 칸 각각에 드롭 → 입력창 없이 바로 "휴강" 배지가 뜨는지.
- 이미 휴강인 칸에 휴강 카드를 다시 드롭 → 휴강이 풀리는지(토글 확인).
- 학사일정으로 이미 자동 휴강된 칸에 드롭해도 앱이 죽지 않는지(기존
  `toggleCanceled`가 수동 휴강 목록만 다루므로 자동 휴강 표시엔 영향 없어야 함).

- [ ] **Step 4: Commit**

```bash
git add client/src/components/timetable/WeeklyGrid.tsx
git commit -m "feat: 휴강 카드를 칸에 드래그하면 즉시 휴강 처리"
```

---

### Task 6: 업데이트 소식 반영 + 최종 통합 확인

**Files:**
- Modify: `client/src/components/WhatsNewModal.tsx`

- [ ] **Step 1: 새 항목 추가 + 버전 올리기**

`client/src/components/WhatsNewModal.tsx`의 `WHATS_NEW_VERSION`을 올리고,
`ITEMS` 배열 맨 앞에 새 항목을 추가한다:

```tsx
export const WHATS_NEW_VERSION = '2026-08-27-1';

const ITEMS = [
  {
    title: '오늘의 시간표 — 점심·보강·휴강 드래그 카드',
    desc: '시간표 아래 점심시간·보강·휴강 카드를 드래그해서 적용할 수 있어요. 점심시간은 요일마다 원하는 교시 사이에 넣을 수 있고 그 요일만 시각적으로 밀려요. 보강·휴강은 칸에 바로 드래그하면 적용돼요.',
  },
  {
    title: '오늘의 시간표 — 휴강·보강·점심 버튼',
    desc: '시간표 칸을 클릭하면 휴강·보강·점심을 한 줄에서 고를 수 있어요. 휴강·보강은 그 날짜에만 적용되고, 점심은 매주 반복 시간표에 저장돼서 계속 보여요(눈에 띄는 노란색으로 표시).',
  },
```

(이후 기존 항목들은 그대로 둔다.)

- [ ] **Step 2: 타입 체크**

Run: `cd "client" && npx tsc --noEmit`
Expected: 에러 없이 종료.

- [ ] **Step 3: 전체 빌드 확인**

Run: `cd "client" && npm run build`
Expected: 에러 없이 빌드 완료(`tsc --noEmit && vite build` 둘 다 통과).

- [ ] **Step 4: 최종 통합 수동 확인 (스펙 검증 항목 전부)**

개발 서버에서 순서대로 확인:
1. 점심시간 카드를 수요일 3교시 뒤에 드롭 → 수요일만 밀리고 나머지 요일은 그대로.
2. 화요일 1교시 뒤에도 독립적으로 점심줄 추가.
3. 점심줄을 카드 트레이로 드래그해서 제거 → 해당 요일 원상 복귀.
4. 보강 카드를 빈 칸/채워진 칸에 드롭 → 입력창 → 저장 → 배지 확인.
5. 휴강 카드 드롭 → 즉시 배지, 재드롭 시 해제.
6. 기존 칸 교환 드래그가 카드 드래그와 안 섞이는지.
7. 새로고침 후에도 점심줄·보강·휴강이 그대로 남아있는지(서버 저장 확인).

- [ ] **Step 5: Commit**

```bash
git add client/src/components/WhatsNewModal.tsx
git commit -m "docs: 업데이트 소식에 점심·보강·휴강 드래그 카드 안내 추가"
```

- [ ] **Step 6: Push**

```bash
git push
```
