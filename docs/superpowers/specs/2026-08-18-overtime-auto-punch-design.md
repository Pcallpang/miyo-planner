# 초과근무 원터치 자동 계산 설계

## 배경
현재 `OvertimeCard`의 원터치 출퇴근 버튼은 아침·저녁 모두 "출근 찍기 → 퇴근 찍기" 2단계로 동작한다(`OvertimePunch` 대기 상태 사용). 실제로는 아침은 출근 시각만 찍으면 종료 시각(교육공무직 규정상 8:50)이 정해져 있고, 저녁은 초과근무 시작 시각이 정해진 값(정규 근무 종료 시각)이므로 퇴근 시각만 찍으면 된다. 매번 두 번 누르는 대신 각 세션을 1클릭으로 끝낼 수 있게 한다.

## 목표
- 아침: "출근 찍기" 버튼 1클릭 → `startTime = 현재 시각`, `endTime = 설정된 아침 종료 시각(기본 08:50)`으로 즉시 기록 저장.
- 저녁: "퇴근 찍기" 버튼 1클릭 → `startTime = 설정된 저녁 시작 시각(기본 17:50)`, `endTime = 현재 시각`으로 즉시 기록 저장.
- 두 시각(아침 종료/저녁 시작)은 설정 가능해야 하며, 앱 내에서 언제든 수정할 수 있다.

## 비목표
- 자정을 넘기는 초과근무 계산(기존과 동일하게 다루지 않음).
- 기존 `OvertimePunch`(2단계 출퇴근 대기) 스키마 자체의 삭제 — 서버/스토리지 데이터 하위 호환을 위해 필드는 남겨두되 UI에서 더 이상 사용하지 않는다.

## 데이터 모델 변경
`Settings`에 필드 2개 추가:
- `morningOvertimeEndTime: string` (`HH:mm`) — 기본값 `'08:50'`
- `eveningOvertimeStartTime: string` (`HH:mm`) — 기본값 `'17:50'`

적용 위치:
- `client/src/types.ts` — `Settings` 인터페이스
- `client/src/lib/storage.ts` — `defaultSettings()`
- `server/lib/appState.js` — `DEFAULT_SETTINGS`

`normalizeSettings()`가 저장된 설정에 기본값을 머지하므로 기존 사용자도 자동으로 두 필드가 채워진다. 마이그레이션 코드 불필요.

## UI/동작 변경 (`OvertimeCard.tsx`)

### 버튼 동작
- `togglePunch(session)` 로직을 세션별 단일 함수로 교체:
  - `recordMorning()`: `nowHHmm() >= settings.morningOvertimeEndTime`이면 에러 토스트("이미 종료 시각이 지났습니다") 후 종료. 아니면 `OvertimeLog { date: todayYMD(), session: '아침', startTime: nowHHmm(), endTime: settings.morningOvertimeEndTime }`를 즉시 `logs`에 추가하고 성공 토스트.
  - `recordEvening()`: `nowHHmm() <= settings.eveningOvertimeStartTime`이면 에러 토스트("아직 초과근무 시작 시각 전입니다") 후 종료. 아니면 `OvertimeLog { date: todayYMD(), session: '저녁', startTime: settings.eveningOvertimeStartTime, endTime: nowHHmm() }`를 즉시 `logs`에 추가하고 성공 토스트.
- 버튼 라벨: 항상 "아침 초근 기록" / "저녁 퇴근 찍기" (더 이상 "출근 찍기 ↔ 퇴근 찍기(HH:mm~)" 상태 전환 없음).
- `punches`/`setPunches` prop, `punchFor`, `togglePunch`는 `OvertimeCard`에서 제거. `DashboardView.tsx`에서 `OvertimeCard`에 넘기던 `punches`/`setPunches` prop도 제거(단, `data.overtimePunches` 자체 읽기/쓰기 배관은 다른 곳에서 참조하지 않으므로 `DashboardView`의 관련 로컬 변수도 함께 정리).

### 시각 설정 UI
기존 "시간당 단가" 인라인 편집기(`editingRate`/`rateInput` 패턴)와 동일한 방식으로 두 개의 편집 가능한 텍스트 버튼을 추가:
- "아침 OO:OO에 자동 종료 (수정)" — 클릭 시 `<input type="time">`로 전환, 저장하면 `settings.morningOvertimeEndTime` 갱신.
- "저녁 OO:OO부터 계산 (수정)" — 클릭 시 `<input type="time">`로 전환, 저장하면 `settings.eveningOvertimeStartTime` 갱신.

위치: 원터치 버튼 영역 바로 아래, 기존 "시간당 단가" 편집 영역과 같은 스타일의 작은 텍스트 영역으로 배치.

## 테스트
`client/src/lib/overtime.ts`의 순수 함수는 변경 없음(`durationMinutes` 등 그대로 재사용). `OvertimeCard`의 버튼 클릭 로직은 컴포넌트 레벨이라 기존 테스트 스위트 패턴을 따라 필요 시 컴포넌트 테스트를 추가한다(현재 저장소에 컴포넌트 테스트 관례가 없다면 수동 확인으로 충분).

## 영향받지 않는 부분
- `overtime.ts`의 계산 함수들(`durationMinutes`, `monthlyTotalMinutes`, `estimatedPay` 등)은 그대로 사용.
- `OvertimeModal`(직접 입력 폼)은 변경 없음 — 수동 입력은 기존처럼 시작/종료 시각을 자유롭게 입력.
- `OvertimeLog`, `OvertimePunch` 타입 정의는 변경 없음(단 `OvertimePunch`는 UI에서 미사용 상태로 남음).
