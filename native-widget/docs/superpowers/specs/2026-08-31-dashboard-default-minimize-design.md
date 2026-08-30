# 오늘의 시간표 기본 노출 + 최소화 토글

## 배경

현재 `App.tsx`는 `getDayPhase()`가 반환한 상태에 따라 렌더링을 분기한다.
- `weekend` / `before` / `after`: 한 줄 안내 메시지만 표시.
- `period` / `break`: 오늘의 시간표 전체 목록을 표시.

즉 수업 시작 전(등교 전)이나 방과 후에는 시간표를 볼 수 없다. 사용자는
이 상태를 뒤집어서, 평소엔 항상 전체 시간표가 보이고, 필요할 때만
버튼으로 눌러서 지금의 "한 줄 메시지" 형태로 줄일 수 있길 원한다.

## 목표

1. **기본 화면 = 전체 시간표 대시보드.** 평일의 모든 phase(before / period /
   break / after)에서 오늘의 시간표 목록이 기본으로 보인다.
2. **최소화 토글 버튼.** 누르면 지금의 "한 줄 메시지 + 다음 시간표" 축소
   화면으로 바뀐다. 다시 누르면 전체 목록으로 돌아온다.
3. **최소화 상태는 재시작해도 유지된다** (opacity 설정과 동일한 저장 방식).

## 범위 밖

- 주말(`weekend`)은 그날의 시간표 데이터 자체가 없으므로(`toWeekday`가
  `null`) 전체 목록을 띄워도 빈 화면일 뿐이다. 주말은 펼침 상태에서도
  지금처럼 메시지만 보여준다(변경 없음).
- 최소화 화면의 시각 디자인(색상·애니메이션)은 기존 스타일을 그대로
  재사용하고 새로 만들지 않는다.

## 설계

### 1. 상태 저장 — `src/lib/widgetPrefs.ts`

기존 `getOpacity()/setOpacity()`와 동일한 패턴으로 추가:

```ts
export function getMinimized(): boolean;
export function setMinimized(value: boolean): void;
```

localStorage 키: `miyo:minimized` (boolean, 기본값 `false`).

### 2. 최소화 메시지/다음 교시 계산 — `src/lib/schedule.ts`

테스트 가능하도록 순수 함수로 분리한다.

```ts
export function getPhaseMessage(phase: DayPhase, settings, todaySlot?: PeriodSlot): string
export function getNextPeriodIndex(phase: DayPhase, periodCount: number): number | null
```

- `getPhaseMessage`: phase.kind별 한 줄 메시지.
  - `weekend`: "주말이에요. 편안한 하루 보내세요."
  - `before`: "아직 일과 전이에요. {첫교시 시작시각}에 시작해요."
  - `after`: "오늘 일과가 끝났어요. 수고하셨어요!"
  - `period`: "{index+1}교시 진행 중 · {과목}{반}" (과목 미배정이면 "{index+1}교시 진행 중")
  - `break`: "쉬는 시간이에요"
- `getNextPeriodIndex`: 다음 교시 인덱스, 없으면 `null`.
  - `before` → `0`
  - `period` → `index + 1` (periodCount 이상이면 `null`)
  - `break` → `nextIndex`
  - `after` / `weekend` → `null`

### 3. 렌더링 — `src/App.tsx`

- `minimized` state 추가 (`useState(() => getMinimized())`), 토글 핸들러가
  `setMinimizedState` + `setMinimized(value)` 동시 처리 (opacity와 동일 패턴).
- `WidgetControls`에 최소화 토글 버튼 추가 (⚙ 왼쪽, 아이콘 "－"/"⤢").
- 렌더 분기:
  - `phase.kind === 'weekend'` → 항상 메시지만 (최소화 버튼 상태 무시).
  - 그 외:
    - `minimized === false` → 기존 전체 목록 렌더링 그대로 사용 (현재
      `period`/`break`일 때 쓰던 `<ul>` 블록을 모든 평일 phase에 재사용).
    - `minimized === true` → `getPhaseMessage()` 한 줄 + (다음 교시가
      있으면) "다음 · N교시 과목·반 (HH:MM~HH:MM)" 한 줄.

## 테스트

- `schedule.test.ts`: `getPhaseMessage`, `getNextPeriodIndex` 각 phase별
  케이스 단위 테스트.
- `widgetPrefs.test.ts`: `getMinimized`/`setMinimized` 저장·기본값 테스트.
- 수동 확인: `npm run dev`(또는 기존 dev 스크립트)로 위젯을 띄워 토글
  버튼 클릭 시 화면 전환과 재시작 후 상태 유지 확인.
