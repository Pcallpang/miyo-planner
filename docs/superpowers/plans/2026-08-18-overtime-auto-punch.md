# 초과근무 원터치 자동 계산 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 초과근무 원터치 버튼을 2단계(출근 찍기 → 퇴근 찍기)에서 세션별 1클릭으로 바꾼다. 아침은 출근 시각만 찍으면 설정된 종료 시각(기본 08:50)까지, 저녁은 설정된 시작 시각(기본 17:50)부터 퇴근 시각까지 자동 계산된다.

**Architecture:** `Settings`에 `morningOvertimeEndTime`/`eveningOvertimeStartTime` 두 필드를 추가하고, `overtime.ts`에 순수 함수 `buildMorningPunchLog`/`buildEveningPunchLog`를 추가해 시각 비교·로그 생성 로직을 테스트 가능하게 분리한다. `OvertimeCard`는 이 순수 함수를 호출해 결과가 `null`이면 에러 토스트, 아니면 로그를 즉시 저장한다. 기존 2단계 `OvertimePunch` 대기 상태 UI는 제거하되, 데이터 스키마(`OvertimePunch` 타입, `overtimePunches` 필드)는 하위 호환을 위해 그대로 둔다.

**Tech Stack:** React 19 + TypeScript (client), vitest, Node.js `node --test` (server), Tailwind.

## Global Constraints

- 아침 초과근무 종료 시각 기본값: `'08:50'`
- 저녁 초과근무 시작 시각 기본값: `'17:50'`
- 시각은 모두 `HH:mm` 문자열 포맷으로 다룬다 (기존 `OvertimeLog.startTime`/`endTime`과 동일).
- `normalizeSettings()`가 저장된 설정에 기본값을 머지하므로 별도 마이그레이션 코드는 작성하지 않는다.
- `OvertimePunch` 타입과 `overtimePunches` 데이터 필드는 삭제하지 않는다(하위 호환).

---

### Task 1: Settings에 시각 필드 추가

**Files:**
- Modify: `client/src/types.ts:49-64` (`Settings` 인터페이스)
- Modify: `client/src/lib/storage.ts:12-31` (`defaultSettings()`)
- Modify: `server/lib/appState.js:1-13` (`DEFAULT_SETTINGS`)

**Interfaces:**
- Produces: `Settings.morningOvertimeEndTime: string`, `Settings.eveningOvertimeStartTime: string` — 이후 Task 2, 3에서 사용.

- [ ] **Step 1: `types.ts`의 `Settings`에 필드 추가**

`client/src/types.ts`의 `Settings` 인터페이스에서 `overtimeHourlyRate: number;` 줄 바로 아래에 추가:

```ts
  /** 아침 초과근무 자동 종료 시각(HH:mm). 출근만 찍으면 이 시각까지 계산됨 */
  morningOvertimeEndTime: string;
  /** 저녁 초과근무 시작 시각(HH:mm). 이 시각부터 퇴근 시각까지 자동 계산됨 */
  eveningOvertimeStartTime: string;
```

- [ ] **Step 2: `storage.ts`의 `defaultSettings()`에 기본값 추가**

`client/src/lib/storage.ts`의 `defaultSettings()` 반환 객체에서 `overtimeHourlyRate: 0,` 줄 바로 아래에 추가:

```ts
    morningOvertimeEndTime: '08:50',
    eveningOvertimeStartTime: '17:50',
```

- [ ] **Step 3: `server/lib/appState.js`의 `DEFAULT_SETTINGS`에 기본값 추가**

`server/lib/appState.js`의 `DEFAULT_SETTINGS` 객체에서 `overtimeHourlyRate: 0,` 줄 바로 아래에 추가:

```js
  morningOvertimeEndTime: '08:50',
  eveningOvertimeStartTime: '17:50',
```

- [ ] **Step 4: 타입체크 및 서버 테스트 실행**

Run: `npm run build -w client`
Expected: 타입 에러 없이 성공 (다른 파일에서 아직 새 필드를 안 써도 옵션 아님/필수 필드라 다른 `Settings` 리터럴이 있으면 에러가 날 수 있음 — 있다면 해당 리터럴에도 필드를 추가한다)

Run: `node --test server/lib/appState.test.js`
Expected: 기존 테스트 모두 PASS (필드 개수 등을 하드코딩해 검증하지 않으므로 그대로 통과해야 함)

- [ ] **Step 5: Commit**

```bash
git add client/src/types.ts client/src/lib/storage.ts server/lib/appState.js
git commit -m "feat: 초과근무 아침 종료·저녁 시작 시각 설정 필드 추가"
```

---

### Task 2: `overtime.ts`에 원터치 로그 생성 순수 함수 추가

**Files:**
- Modify: `client/src/lib/overtime.ts`
- Test: `client/src/lib/overtime.test.ts`

**Interfaces:**
- Consumes: `OvertimeLog` 타입 (`../types`), Task 1에서 만든 `Settings.morningOvertimeEndTime`/`eveningOvertimeStartTime` (호출부에서 넘겨줌).
- Produces:
  - `buildMorningPunchLog(date: string, now: string, endTime: string): OvertimeLog | null`
  - `buildEveningPunchLog(date: string, now: string, startTime: string): OvertimeLog | null`
  
  두 함수 모두 조건을 만족하지 않으면 `null`을 반환하고, 만족하면 `id`(`crypto.randomUUID()`)와 `createdAt`(`new Date().toISOString()`)을 채운 완전한 `OvertimeLog`를 반환한다. Task 3의 `OvertimeCard`가 이 함수들을 사용.

- [ ] **Step 1: 실패하는 테스트 작성**

`client/src/lib/overtime.test.ts` 맨 아래(`estimatedPay` describe 블록 다음)에 추가:

```ts
import { buildEveningPunchLog, buildMorningPunchLog } from './overtime';
```

위 import는 기존 최상단 import 블록에 합친다. 즉 파일 상단의 import 문을 아래처럼 교체:

```ts
import { describe, expect, test } from 'vitest';
import {
  durationMinutes,
  monthlyTotalMinutes,
  formatDuration,
  estimatedPay,
  buildMorningPunchLog,
  buildEveningPunchLog,
  OVERTIME_MONTHLY_CAP_MINUTES,
} from './overtime';
import type { OvertimeLog } from '../types';
```

그리고 파일 맨 끝에 아래 describe 블록들을 추가:

```ts
describe('buildMorningPunchLog', () => {
  test('현재 시각이 종료 시각 전이면 시작=현재, 종료=설정된 종료 시각인 로그를 만든다', () => {
    const result = buildMorningPunchLog('2026-08-18', '07:10', '08:50');
    expect(result).not.toBeNull();
    expect(result?.date).toBe('2026-08-18');
    expect(result?.session).toBe('아침');
    expect(result?.startTime).toBe('07:10');
    expect(result?.endTime).toBe('08:50');
    expect(typeof result?.id).toBe('string');
    expect(typeof result?.createdAt).toBe('string');
  });

  test('현재 시각이 종료 시각과 같거나 지났으면 null을 반환한다', () => {
    expect(buildMorningPunchLog('2026-08-18', '08:50', '08:50')).toBeNull();
    expect(buildMorningPunchLog('2026-08-18', '09:00', '08:50')).toBeNull();
  });
});

describe('buildEveningPunchLog', () => {
  test('현재 시각이 시작 시각 뒤면 시작=설정된 시작 시각, 종료=현재인 로그를 만든다', () => {
    const result = buildEveningPunchLog('2026-08-18', '19:30', '17:50');
    expect(result).not.toBeNull();
    expect(result?.date).toBe('2026-08-18');
    expect(result?.session).toBe('저녁');
    expect(result?.startTime).toBe('17:50');
    expect(result?.endTime).toBe('19:30');
    expect(typeof result?.id).toBe('string');
    expect(typeof result?.createdAt).toBe('string');
  });

  test('현재 시각이 시작 시각과 같거나 이전이면 null을 반환한다', () => {
    expect(buildEveningPunchLog('2026-08-18', '17:50', '17:50')).toBeNull();
    expect(buildEveningPunchLog('2026-08-18', '17:00', '17:50')).toBeNull();
  });
});
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

Run: `npm run test -w client -- overtime.test.ts`
Expected: FAIL — `buildMorningPunchLog`/`buildEveningPunchLog`를 찾을 수 없다는 에러 (아직 `overtime.ts`에 없음)

- [ ] **Step 3: `overtime.ts`에 함수 구현**

`client/src/lib/overtime.ts`의 `todayYMD` 함수 뒤(파일 끝)에 추가:

```ts

/** 아침 원터치 로그 생성. now가 endTime 이후(같은 시각 포함)면 null. */
export function buildMorningPunchLog(date: string, now: string, endTime: string): OvertimeLog | null {
  if (now >= endTime) return null;
  return {
    id: crypto.randomUUID(),
    date,
    session: '아침',
    startTime: now,
    endTime,
    createdAt: new Date().toISOString(),
  };
}

/** 저녁 원터치 로그 생성. now가 startTime 이전(같은 시각 포함)이면 null. */
export function buildEveningPunchLog(date: string, now: string, startTime: string): OvertimeLog | null {
  if (now <= startTime) return null;
  return {
    id: crypto.randomUUID(),
    date,
    session: '저녁',
    startTime,
    endTime: now,
    createdAt: new Date().toISOString(),
  };
}
```

- [ ] **Step 4: 테스트 실행하여 통과 확인**

Run: `npm run test -w client -- overtime.test.ts`
Expected: PASS — 모든 테스트 통과

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/overtime.ts client/src/lib/overtime.test.ts
git commit -m "feat: 원터치 초과근무 로그 생성 순수 함수 추가"
```

---

### Task 3: `OvertimeCard` 버튼을 1클릭 동작으로 교체 + 시각 설정 UI

**Files:**
- Modify: `client/src/components/dashboard/OvertimeCard.tsx`
- Modify: `client/src/views/DashboardView.tsx:34-39,175-182`

**Interfaces:**
- Consumes: `buildMorningPunchLog`, `buildEveningPunchLog` (Task 2, `../../lib/overtime`), `todayYMD`, `nowHHmm` (기존), `Settings.morningOvertimeEndTime`/`eveningOvertimeStartTime` (Task 1, `useApp()`의 `settings`/`setSettings`를 통해 접근).
- Produces: 없음 (최종 UI 컴포넌트).

- [ ] **Step 1: `OvertimeCard.tsx`에서 punch 관련 props·상태 제거, import 정리**

`client/src/components/dashboard/OvertimeCard.tsx` 상단 import를 아래로 교체:

```tsx
import { useState, type Dispatch, type SetStateAction } from 'react';
import { AlarmClock, Coins, Pencil, Plus, Sunrise, Sunset, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import EmptyMiyo from '../EmptyMiyo';
import {
  buildEveningPunchLog,
  buildMorningPunchLog,
  durationMinutes,
  estimatedPay,
  formatDuration,
  monthlyTotalMinutes,
  nowHHmm,
  OVERTIME_MONTHLY_CAP_MINUTES,
  todayYMD,
} from '../../lib/overtime';
import type { OvertimeLog, OvertimeSession } from '../../types';
```

(`OvertimePunch` import 제거)

`const SESSIONS: OvertimeSession[] = ['아침', '저녁'];`와 `const SESSION_ICON = { 아침: Sunrise, 저녁: Sunset } as const;` 두 줄은 이제 아무 데서도 참조되지 않으므로 삭제한다(`noUnusedLocals: true`라 남겨두면 빌드 에러). `SESSION_BADGE`는 기록 목록 배지에서 계속 쓰이므로 그대로 둔다.

`Props` 인터페이스에서 `punches`/`setPunches` 줄을 제거해 아래로 교체:

```tsx
interface Props {
  logs: OvertimeLog[];
  setLogs: Dispatch<SetStateAction<OvertimeLog[]>>;
  onAdd: () => void;
  onEdit: (log: OvertimeLog) => void;
}
```

컴포넌트 선언부를 교체:

```tsx
export default function OvertimeCard({ logs, setLogs, onAdd, onEdit }: Props) {
```

- [ ] **Step 2: `punchFor`/`togglePunch`를 세션별 1클릭 핸들러로 교체**

기존 `punchFor`, `togglePunch` 함수 전체(Props: `punches`, `setPunches` 참조하던 부분)를 아래로 교체:

```tsx
  function recordMorning() {
    const log = buildMorningPunchLog(todayYMD(), nowHHmm(), settings.morningOvertimeEndTime);
    if (!log) {
      showToast('error', `이미 ${settings.morningOvertimeEndTime}이 지났습니다.`);
      return;
    }
    setLogs((prev) => [...prev, log]);
    showToast('success', `아침 초근을 기록했습니다. (${log.startTime}~${log.endTime})`);
  }

  function recordEvening() {
    const log = buildEveningPunchLog(todayYMD(), nowHHmm(), settings.eveningOvertimeStartTime);
    if (!log) {
      showToast('error', `아직 ${settings.eveningOvertimeStartTime} 전입니다.`);
      return;
    }
    setLogs((prev) => [...prev, log]);
    showToast('success', `저녁 초근을 기록했습니다. (${formatDuration(durationMinutes(log))})`);
  }
```

- [ ] **Step 3: 원터치 버튼 JSX를 1클릭 버튼으로 교체**

기존 "원터치 출퇴근 버튼" 영역:

```tsx
      {/* 원터치 출퇴근 버튼 */}
      <div className="mb-3 grid grid-cols-2 gap-2">
        {SESSIONS.map((session) => {
          const active = punchFor(session);
          const Icon = SESSION_ICON[session];
          return (
            <button
              key={session}
              onClick={() => togglePunch(session)}
              className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-xs font-semibold transition ${
                active
                  ? 'border-mint-400 bg-mint-50 text-mint-700'
                  : 'border-slate-200 text-slate-500 hover:border-mint-200 hover:bg-mint-50/50'
              }`}
            >
              <Icon size={16} />
              {active ? `${session} 퇴근 찍기 (${active.startTime}~)` : `${session} 출근 찍기`}
            </button>
          );
        })}
      </div>
```

를 아래로 교체:

```tsx
      {/* 원터치 버튼: 아침은 출근만, 저녁은 퇴근만 찍으면 나머지 시각은 자동 계산 */}
      <div className="mb-3 grid grid-cols-2 gap-2">
        <button
          onClick={recordMorning}
          className="flex flex-col items-center gap-1 rounded-xl border border-slate-200 px-2 py-2.5 text-xs font-semibold text-slate-500 transition hover:border-mint-200 hover:bg-mint-50/50"
        >
          <Sunrise size={16} />
          아침 초근 기록
        </button>
        <button
          onClick={recordEvening}
          className="flex flex-col items-center gap-1 rounded-xl border border-slate-200 px-2 py-2.5 text-xs font-semibold text-slate-500 transition hover:border-mint-200 hover:bg-mint-50/50"
        >
          <Sunset size={16} />
          저녁 퇴근 찍기
        </button>
      </div>
```

- [ ] **Step 4: 아침 종료/저녁 시작 시각 인라인 편집 UI 추가**

컴포넌트 최상단, `editingRate`/`rateInput` state 선언부 바로 아래에 state 추가:

```tsx
  const [editingMorningEnd, setEditingMorningEnd] = useState(false);
  const [morningEndInput, setMorningEndInput] = useState('');
  const [editingEveningStart, setEditingEveningStart] = useState(false);
  const [eveningStartInput, setEveningStartInput] = useState('');
```

`saveRate` 함수 바로 아래에 저장 핸들러 2개 추가:

```tsx
  function saveMorningEnd() {
    if (!morningEndInput) {
      showToast('error', '시각을 입력해 주세요.');
      return;
    }
    setSettings((prev) => ({ ...prev, morningOvertimeEndTime: morningEndInput }));
    setEditingMorningEnd(false);
  }

  function saveEveningStart() {
    if (!eveningStartInput) {
      showToast('error', '시각을 입력해 주세요.');
      return;
    }
    setSettings((prev) => ({ ...prev, eveningOvertimeStartTime: eveningStartInput }));
    setEditingEveningStart(false);
  }
```

"시간당 단가" 영역(`{/* 시간당 단가 */}` `<div>` 전체) 바로 뒤에 아래 블록 추가:

```tsx
      {/* 아침 종료 시각 */}
      <div className="mb-1.5 text-xs text-slate-400">
        {editingMorningEnd ? (
          <div className="flex items-center gap-2">
            <input
              type="time"
              autoFocus
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs outline-none focus:border-mint-400"
              value={morningEndInput}
              onChange={(e) => setMorningEndInput(e.target.value)}
            />
            <button onClick={saveMorningEnd} className="font-semibold text-mint-600">
              저장
            </button>
            <button onClick={() => setEditingMorningEnd(false)} className="text-slate-400">
              취소
            </button>
          </div>
        ) : (
          <button
            onClick={() => {
              setMorningEndInput(settings.morningOvertimeEndTime);
              setEditingMorningEnd(true);
            }}
            className="underline-offset-2 hover:text-mint-600 hover:underline"
          >
            아침 {settings.morningOvertimeEndTime}에 자동 종료 (수정)
          </button>
        )}
      </div>

      {/* 저녁 시작 시각 */}
      <div className="mb-3 text-xs text-slate-400">
        {editingEveningStart ? (
          <div className="flex items-center gap-2">
            <input
              type="time"
              autoFocus
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs outline-none focus:border-mint-400"
              value={eveningStartInput}
              onChange={(e) => setEveningStartInput(e.target.value)}
            />
            <button onClick={saveEveningStart} className="font-semibold text-mint-600">
              저장
            </button>
            <button onClick={() => setEditingEveningStart(false)} className="text-slate-400">
              취소
            </button>
          </div>
        ) : (
          <button
            onClick={() => {
              setEveningStartInput(settings.eveningOvertimeStartTime);
              setEditingEveningStart(true);
            }}
            className="underline-offset-2 hover:text-mint-600 hover:underline"
          >
            저녁 {settings.eveningOvertimeStartTime}부터 계산 (수정)
          </button>
        )}
      </div>
```

- [ ] **Step 5: `DashboardView.tsx`에서 punches 배관 제거**

`client/src/views/DashboardView.tsx`에서 아래 두 줄(34-39행 부근)을 제거:

```tsx
  const overtimePunches = data.overtimePunches;
```
와
```tsx
  const setOvertimePunches: Dispatch<SetStateAction<typeof overtimePunches>> = (next) =>
    update((prev) => ({ overtimePunches: typeof next === 'function' ? next(prev.overtimePunches) : next }));
```

결과적으로 해당 부분은 아래처럼 남는다:

```tsx
  const overtimeLogs = data.overtimeLogs;
  const setOvertimeLogs: Dispatch<SetStateAction<OvertimeLog[]>> = (next) =>
    update((prev) => ({ overtimeLogs: typeof next === 'function' ? next(prev.overtimeLogs) : next }));
```

`<OvertimeCard>` 호출부에서 `punches`/`setPunches` prop 두 줄을 제거:

```tsx
        <OvertimeCard
          logs={overtimeLogs}
          setLogs={setOvertimeLogs}
          onAdd={() => setOvertimeModal({})}
          onEdit={(log) => setOvertimeModal({ editing: log })}
```

- [ ] **Step 6: 타입체크**

Run: `npm run build -w client`
Expected: 타입 에러 없이 성공 (미사용 변수/props 에러가 없어야 함)

- [ ] **Step 7: 전체 테스트 실행**

Run: `npm test`
Expected: 서버·클라이언트 테스트 모두 PASS

- [ ] **Step 8: 개발 서버로 수동 확인**

Run: `npm run dev -w client` (백그라운드 실행 후 브라우저에서 대시보드 확인)
- "아침 초근 기록" 버튼 클릭 → 목록에 `현재시각~08:50`(또는 설정값) 로그가 즉시 추가되는지 확인
- "저녁 퇴근 찍기" 버튼 클릭 → 목록에 `17:50~현재시각`(또는 설정값) 로그가 즉시 추가되는지 확인
- "아침 HH:mm에 자동 종료 (수정)" / "저녁 HH:mm부터 계산 (수정)" 클릭 → 시각 변경 후 저장되는지, 이후 버튼 클릭 시 반영되는지 확인
- 확인 후 dev 서버 종료

- [ ] **Step 9: Commit**

```bash
git add client/src/components/dashboard/OvertimeCard.tsx client/src/views/DashboardView.tsx
git commit -m "feat: 초과근무 원터치 버튼을 1클릭 자동 계산으로 변경"
```

---

## Post-Plan Verification

- [ ] `npm test` (루트) 전체 통과
- [ ] `npm run build -w client` 통과
- [ ] 스펙(`docs/superpowers/specs/2026-08-18-overtime-auto-punch-design.md`)의 모든 요구사항이 반영됐는지 확인:
  - 아침 1클릭 → 08:50(설정 가능) 자동 종료 ✓ (Task 2, 3)
  - 저녁 1클릭 → 17:50(설정 가능)부터 자동 계산 ✓ (Task 2, 3)
  - 설정 화면(카드 내 인라인)에서 두 시각 변경 가능 ✓ (Task 3 Step 4)
  - `OvertimePunch` 스키마 보존, UI만 미사용으로 전환 ✓ (Task 3에서 타입/서버 필드 미변경)
