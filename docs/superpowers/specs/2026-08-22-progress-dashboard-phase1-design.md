# 주간 수업 진도계획표 — 1단계(데이터 기반) 설계

## 배경

교사용 "주간 수업 진도계획표" 요청을 받았다. 원본 요청은 상단 요약바 + 3분할 대시보드
카드 + 시간표 그리드(팝오버 편집) + 접이식 차시별 내용 패널 + 다크모드까지 포함하는
화면 하나를 통째로 만드는 큰 작업이라, 한 번에 설계하지 않고 4조각으로 나누기로
사용자와 합의했다.

1. **데이터 기반 다지기** ← 이 문서의 범위
2. 진도 추적 핵심 — 차시별 수업 내용 입력, 시간표 그리드 실시간 연동
3. 대시보드 요약 — 오늘의 수업/반별 진도/지필고사 D-day 카드
4. 편의 기능 — 셀 클릭 팝오버, 접이식 패널, 다크모드

## 핵심 전제 (사용자 확정)

- 한 과목을 **여러 반에 가르치는 교과 선생님**을 기준으로 한다. 반마다 진도가 다를 수
  있다("진도 격차" 개념의 전제).
- 반은 자유입력이 아니라 **목록으로 관리**한다(진도 집계 정확성 때문).
- 진도(현재 차시)는 **반 + 과목 조합별로 따로** 추적한다.
- 차시별 수업 내용(단원명 등)은 **과목마다 하나만** 작성한다 — 같은 과목이면 반이
  달라도 콘텐츠는 공유하고, 반마다 다른 건 "지금 몇 차시까지 나갔는지"뿐이다.
  (콘텐츠 입력 자체는 2단계 범위. 1단계에서는 "총 차시" 숫자만 과목에 붙는다.)
- 정상 수업일이 지나면 차시가 **자동으로** 올라간다. 방학·휴업일은 자동으로 건너뛴다.
  선생님은 계획과 다를 때(결손·수행평가)만 손대면 된다 — 이건 2·4단계에서 다룬다.

## 기존 코드와의 관계 — 완전히 분리

지금 있는 "오늘의 시간표"(`client/src/views/TimetableView.tsx`, `Timetable`/`PeriodSlot`
타입)는 요일별 교시에 과목·교실 자유입력 텍스트만 있고 반 개념이 없다. 이 기능을
확장하는 대신 **새 데이터셋을 완전히 따로 만든다**:

- 반 개념이 필요 없는 선생님(지금 시간표만 쓰는 분)은 전혀 영향받지 않는다.
- 두 기능이 서로 다른 텍스트("과목" 필드 vs 구조화된 "과목" 목록)를 혼동할 일이 없다.

사이드바에 새 메뉴 **"진도계획표"**(`ViewId: 'progress'`)를 추가해 별도 화면으로 만든다.

## 데이터 모델 (`client/src/types.ts`에 추가)

```ts
export interface SchoolClass {
  id: string;
  name: string; // 예: '1-1'
}

export interface ProgressSubject {
  id: string;
  name: string; // 예: '수학'
  totalLessons: number; // 총 차시(1단계에서는 직접 입력값)
}

/** 요일(1=월~5=금) → 교시 인덱스별 배정. 배정 없으면 null. */
export type ProgressTimetable = Record<number, Array<{ classId: string; subjectId: string } | null>>;

/** 반+과목 조합의 진도 위치 */
export interface ClassProgress {
  classId: string;
  subjectId: string;
  currentLesson: number; // 0 = 아직 시작 안 함
  /** 자동 진행 계산이 마지막으로 반영한 날짜(YYYY-MM-DD, 이 날짜까지는 이미 반영됨) */
  lastAdvancedDate?: string;
}
```

`AppData`(같은 파일)에 다음 필드를 추가한다: `progressClasses: SchoolClass[]`,
`progressSubjects: ProgressSubject[]`, `progressTimetable: ProgressTimetable`,
`classProgress: ClassProgress[]`. 그리드 크기(교시 수·교시 시간)는 기존
`settings.periodCount`/`periodTimes`를 그대로 재사용한다(새 시간 설정을 만들지 않는다).

## 자동 진행 계산 (`client/src/lib/progress.ts`, 신규)

순수 함수로 만들어 단위 테스트한다:

```ts
/** classId+subjectId가 배정된 요일(1~5)별 교시 수. 같은 요일에 두 시간 있으면 2. */
export function weeklyOccurrences(
  timetable: ProgressTimetable,
  classId: string,
  subjectId: string,
): Record<number, number> { ... }

/**
 * fromExclusive 다음날부터 toExclusive 전날까지, noClassDates에 없는 날짜만 세어
 * 그날 요일의 occurrences만큼 차시를 더한다.
 */
export function countElapsedLessons(
  occurrences: Record<number, number>,
  fromExclusive: string | undefined, // undefined면 세지 않음(신규 행은 오늘부터 시작)
  toExclusive: string, // 보통 오늘 날짜 — 즉 어제까지 계산
  noClassDates: Set<string>,
): number { ... }
```

실제 반영은 화면을 열 때 한 번: 각 `ClassProgress` 행에 대해
`countElapsedLessons(...)`로 오른 차시 수를 구해 `currentLesson`에 더하고
`lastAdvancedDate`를 오늘로 갱신한다. `noClassDates`는 학교가 등록돼 있으면 나이스
학사일정(`noClass===true`)에서, 등록 안 돼 있으면 사용자 지정 휴일(`holidays`)만으로
구성한다 — 학교 미등록이어도 기능 자체는 동작해야 한다.

새로 만든 `ClassProgress` 행은 `lastAdvancedDate`를 즉시 오늘 날짜로 채워 넣는다
(과거로 소급해 세지 않는다 — 학기 중간에 켜도 갑자기 몇십 차시가 튀지 않게).

## 빈틈 보완: 진도 직접 입력

학기 중간에 이 기능을 처음 켜면 실제 진도를 알 수 없다. `ClassProgress.currentLesson`을
화면에서 직접 숫자로 입력/수정할 수 있게 한다(1단계 범위 — 3·4단계의 팝오버 UI가
생기기 전까지 이게 유일한 수동 보정 수단).

## 화면 구성 (1단계 — 카드·그리드 디자인 없이 기능만)

`client/src/views/ProgressView.tsx` + `client/src/components/progress/` 아래
소구성요소 (기존 `components/dashboard/` 폴더 구조와 동일한 패턴):

- `ClassManager.tsx` — 반 추가/이름수정/삭제 목록
- `SubjectManager.tsx` — 과목 추가/이름수정/총차시수정/삭제 목록
- `AssignmentGrid.tsx` — 요일×교시 표, 칸마다 반 선택 + 과목 선택 드롭다운 2개
  (선택 안 하면 빈 칸)
- `ProgressList.tsx` — 배정된 반+과목 조합별로 "현재/총 차시", 진행률(%), 직접 수정
  입력칸

## 서버 변경 (필요 최소)

`app_state` 테이블은 사용자당 JSON 한 덩어리(`state jsonb`)라 스키마 마이그레이션은
필요 없다. 다만 `server/lib/appState.js`의 `KEYS` 허용 목록과 `defaultAppState()`에
새 필드 4개를 추가해야 한다 — 안 하면 저장 시 조용히 버려진다.

## 내비게이션 변경

- `client/src/types.ts`의 `ViewId`에 `'progress'` 추가.
- `client/src/App.tsx`: `ProgressView` import + 라우팅 한 줄 + `MORE_VIEWS`에 추가
  (모바일 "더보기" 시트에서 접근 가능하도록, `timetable`/`procurement`와 동일하게).
- `client/src/components/Sidebar.tsx`: `ITEM_DEFS`에 `progress` 항목 추가
  (아이콘 `ClipboardList`, lucide-react). `sidebarOrder.ts`의 `SidebarItemId` 유니언과
  `DEFAULT_SIDEBAR_ORDER`에도 추가 — 기존에 순서를 커스터마이즈해둔 사용자도
  `resolveSidebarOrder`가 새 항목을 자동으로 끝에 붙여주므로 안전하다.
- `client/src/components/MoreSheet.tsx`: 같은 항목 추가.

## 테스트 계획

`client/src/lib/progress.test.ts`:
- `weeklyOccurrences`: 배정 없음 → 빈 값 / 한 요일 1교시 / 같은 요일 2교시(더블) /
  다른 반+과목은 무시
- `countElapsedLessons`: 방학 없이 5일 모두 수업 / 방학이 껴서 일부 제외 / 주 2회
  수업(화·목만 카운트) / `fromExclusive` undefined면 0 / 범위가 뒤바뀌거나 비어있으면 0

컴포넌트(반/과목 관리, 배정 그리드)는 기존 프로젝트 관례상 컴포넌트 단위 테스트가
없으므로(다른 뷰들도 다 그렇다) 개발 서버로 직접 확인한다: 반·과목 등록 → 그리드에
배정 → 진도 목록에 뜨는지 → 새로고침 후 유지되는지 → "기본 순서로"처럼 사이드바에
새 메뉴가 자연스럽게 나오는지.

## 이번 조각에서 하지 않는 것

- 차시별 수업 내용 입력(2단계)
- 대시보드 요약 카드·지필고사 D-day(3단계)
- 셀 클릭 팝오버(결손/수행평가 처리), 접이식 패널, 다크모드(4단계)
