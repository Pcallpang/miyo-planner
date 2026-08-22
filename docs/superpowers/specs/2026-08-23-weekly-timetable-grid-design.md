# 오늘의 시간표 — 주간 그리드 개편 설계

## 배경

지금 "오늘의 시간표"(`client/src/views/TimetableView.tsx`)는 요일 탭을 눌러 하루씩만
보고, 교시·시간·과목·교실이 한 표에 섞여 있다. 사용자 요청은:

1. 좌우 2열 배열 — 왼쪽 시간표 그리드 / 오른쪽 교시·시간 패널
2. 왼쪽은 세로 교시 × 가로 요일 그리드, 직접 입력 가능
3. 수업 시간이 바뀔 수 있으니 칸을 드래그로 옮길 수 있게
4. 나이스 학사일정을 반영해 수업 없는 날을 표시
5. 오른쪽은 교시·시간만 입력

(4)를 하려면 실제 날짜가 있어야 하므로, 화면을 "이번 주" 실제 날짜 기준으로
이전/다음 주 이동이 되게 바꾼다(사용자 확정). 요일 탭은 없앤다(사용자 확정).

## 데이터 모델 — 변경 없음

`Timetable`/`PeriodSlot`(`client/src/types.ts`)은 그대로 둔다. 시간표 자체는 여전히
"요일별 반복 패턴"이다(과목·교실은 매주 똑같이 반복). 이번 개편은 **화면**만 바꾼다 —
실제 날짜는 나이스 학사일정 오버레이를 그리는 용도로만 쓰고, 화면에서 벗어나면 사라지는
로컬 상태(보고 있는 주)일 뿐 저장되지 않는다.

`settings.periodCount`/`settings.periodTimes`도 그대로 재사용한다.

## 화면 구성

`client/src/views/TimetableView.tsx`를 다시 짜서 2열로 배치:

```tsx
<div className="flex flex-col gap-4 lg:flex-row">
  <WeeklyGrid />           {/* 왼쪽, 넉넉한 폭 */}
  <PeriodTimesPanel />     {/* 오른쪽, 고정 좁은 폭(w-64 정도) */}
</div>
```

### `client/src/components/timetable/WeeklyGrid.tsx` (신규)

- `SchoolView.tsx`와 같은 패턴으로 주 이동 관리:
  `startOfWeek(new Date(), { weekStartsOn: 1 })` 기준, `addDays`로 ±7일 이동,
  "오늘" 버튼으로 복귀. (일반 캘린더 설정의 `weekStartsOn`과 무관하게 학교 주간은
  항상 월요일 시작 — `SchoolView.tsx`가 이미 이렇게 한다.)
- 표: 세로 1~`periodCount`교시, 가로 월~금(그 주의 실제 날짜 5개).
  각 칸은 과목(위)·교실(아래) 두 줄 입력 — 지금 표의 두 입력을 세로로 쌓은 것뿐,
  데이터는 `updateSlot`(기존 로직 그대로 재사용)으로 저장.
- **드래그**: 칸 오른쪽 위에 작은 손잡이 아이콘(`GripVertical`, 사이드바 순서바꾸기와
  동일 관례)만 `draggable`로 둔다 — 칸 전체를 draggable로 하면 텍스트 선택·클릭과
  충돌한다. 손잡이에서 드래그를 시작해 다른 칸에 놓으면 **두 칸의 내용을 서로
  맞바꾼다**(swap, 사용자 확정) — 빈 칸에 놓으면 자연히 "이동"이 되고, 채워진 칸끼리는
  자리를 바꿔 데이터가 사라지지 않는다.
- **나이스 학사일정 오버레이**: `settings.school`이 있으면 그 주(월~금) 범위로
  `api.schoolSchedule(school, from, to)`를 불러 `noClass===true`인 날짜의 요일
  헤더에 배지(예: "방학")를 얹는다. 오늘 있는 `useSchoolSchedule` 훅은 "달" 단위라
  이 "주" 범위엔 맞지 않으니, `SchoolView.tsx`가 이미 하듯 이 컴포넌트 안에서 직접
  `api.schoolSchedule`을 불러온다(같은 패턴 재사용, 새 훅 안 만듦).
- 오늘이 이 주에 포함되면 오늘 열과 `getDayPhase`(기존 `lib/schedule.ts`)로 구한
  현재 교시 칸을 강조 표시(지금 있는 로직 재사용).

### `client/src/components/timetable/PeriodTimesPanel.tsx` (신규)

- 지금 표의 "교시" + "시간" 두 열만 뗀 좁은 목록. `updateTime`(기존 로직) 그대로
  재사용. 교시 수 자체를 늘리고 줄이는 건 지금처럼 환경 설정에서 한다(범위 밖).

## 검증

- 개발 서버에서 직접 확인: 과목·교실 입력 → 저장 → 새로고침해도 유지되는지,
  칸 드래그로 두 교시 내용이 맞바뀌는지, 이전/다음 주 이동 시 나이스 학사일정
  배지가 실제 날짜에 맞게 뜨는지, "오늘" 버튼으로 복귀하는지.
- `npx tsc --noEmit`, `npm test` 통과 확인(로직 재사용 위주라 새 단위 테스트 대상인
  순수 함수는 거의 없음 — 필요하면 드래그 스왑 로직만 별도 함수로 뽑아 테스트).
