export type ViewId =
  | 'dashboard'
  | 'matrix'
  | 'school'
  | 'timetable'
  | 'memo'
  | 'procurement'
  | 'settings'
  | 'overtime';

export type TodoCategory = '업무' | '교과' | '개인';

export interface Todo {
  id: string;
  text: string;
  category: TodoCategory;
  done: boolean;
  dueDate?: string; // YYYY-MM-DD
  link?: string; // 관련 링크(URL)
  memo?: string; // 상세 메모
  /** 아이젠하워 매트릭스 세로축. 없으면 '중요하지 않음' */
  important?: boolean;
  /** 가로축 수동 고정. 없으면 마감일 기준 자동 판정 */
  urgentOverride?: boolean;
  createdAt: string;
}

export interface Meeting {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm
  memo: string;
  link?: string; // 관련 링크(URL)
  googleEventId?: string;
}

export interface MemoNote {
  id: string;
  text: string;
  updatedAt: string;
}

/** 사용자가 직접 등록하는 D-day. 여러 개 등록할 수 있고, 헤더에는 오늘과 가장
 *  가까운(지났으면 가장 최근에 지난) 것 하나만 보여준다. */
export interface Dday {
  id: string;
  label: string;
  date: string; // YYYY-MM-DD
}

export interface PeriodTime {
  start: string; // HH:mm
  end: string; // HH:mm
}

export interface PeriodSlot {
  subject: string;
  /** 반(예: "1-3"). 필드 이름은 이전 "교실" 시절 그대로 남아 있다. */
  room: string;
}

/** 요일(1=월 ~ 5=금) → 교시별 과목/반 */
export type Timetable = Record<number, PeriodSlot[]>;

export interface Settings {
  periodCount: number;
  periodTimes: PeriodTime[];
  weekStartsOn: 0 | 1;
  calendarId: string;
  /** 일정 시작 몇 분 전에 브라우저 알림을 띄울지. 0이면 끔. */
  reminderMinutes: number;
  /** 마감이 며칠 안쪽이면 '긴급'으로 볼지 (우선순위 매트릭스) */
  urgentDays: number;
  /** 나이스에서 급식·학사일정을 가져올 학교. 미선택이면 undefined */
  school?: School;
  /** 대시보드 캘린더에 학사일정을 겹쳐서 표시할지 */
  showSchoolSchedule: boolean;
  /** 캘린더 키워드 필터에 쓸 키워드. 제목에 이 중 하나라도 들어간 일정만 보인다 */
  eventKeywords: string[];
  /** 초과근무 예상 수당 계산용 시간당 단가(원). 미입력 시 0 */
  overtimeHourlyRate: number;
  /** 아침 초과근무 자동 종료 시각(HH:mm). 출근만 찍으면 이 시각까지 계산됨 */
  morningOvertimeEndTime: string;
  /** 저녁 초과근무 시작 시각(HH:mm). 이 시각부터 퇴근 시각까지 자동 계산됨 */
  eveningOvertimeStartTime: string;
  /** 사이드바 "나의 하루" 항목 순서. 비어 있으면 기본 순서를 쓴다. */
  sidebarOrder: string[];
}

/** 나이스 학교 식별 정보 */
export interface School {
  atptCode: string; // 시도교육청코드
  schoolCode: string; // 표준학교코드
  name: string;
  kind?: string; // 학교종류명 (초등학교/중학교/고등학교…)
  region?: string; // 소재지명
  address?: string;
}

export interface MealDish {
  name: string;
  /** 알레르기 유발식품 번호 */
  allergens: string[];
}

export interface Meal {
  date: string; // YYYY-MM-DD
  type: string; // 조식/중식/석식
  dishes: MealDish[];
  calorie: string;
  origin: string[];
}

export interface SchoolScheduleItem {
  date: string; // YYYY-MM-DD
  name: string;
  content: string;
  /** 수업이 없는 날(휴업일 등) */
  noClass: boolean;
}

export interface GEvent {
  id: string;
  calendarId: string;
  title: string;
  start: string; // ISO dateTime 또는 YYYY-MM-DD
  end: string;
  allDay: boolean;
  location: string;
  description: string;
}

export interface CalendarInfo {
  id: string;
  name: string;
  primary: boolean;
}

export interface ParsedEvent {
  title: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  allDay: boolean;
  location: string | null;
  memo: string;
  needsConfirmation: boolean;
}

export interface ParsedTodo {
  text: string;
  category: TodoCategory;
  dueDate: string | null;
}

export interface ServerStatus {
  googleConfigured: boolean;
  /** 본인 키 또는 서버 기본 키로 Gemini 사용 가능한지 */
  geminiConfigured: boolean;
  /** 사용자가 본인 Gemini 키를 등록했는지 */
  geminiUserKey: boolean;
  connected: boolean;
  email: string | null;
  /** 현재 세션이 인증되었는지 (구글 로그인 완료 여부) */
  authenticated: boolean;
}

/** 시간표에 등장하는 (과목, 반) 조합마다 진도(차시)를 따로 관리한다 —
 *  같은 과목이라도 반마다 진도가 다를 수 있어, 오늘의 시간표 화면 전용으로 가볍게 둔다. */
export interface SubjectProgress {
  subject: string; // 시간표의 과목 이름과 매칭
  className: string; // 시간표의 반(구 "교실" 칸)과 매칭. 반을 안 적었으면 빈 문자열
  currentLesson: number; // 0부터 시작
  totalLessons: number;
}

/** 시간표는 요일마다 반복되지만, 학교 행사 등으로 특정 날짜 하루만 수업이 없어질 수 있다.
 *  그 하루만 휴강 처리하기 위한 예외 — 반복 시간표(timetable) 자체는 건드리지 않는다. */
export interface CanceledLesson {
  date: string; // YYYY-MM-DD
  period: number; // 0부터 시작, 그 요일의 PeriodSlot[] 안 인덱스
}

/** 다른 반/다른 선생님 수업과 "이 날짜만" 자리를 바꿨을 때 쓰는 예외. 그 특정
 *  날짜·교시 한 칸에서만 반복 시간표 내용을 덮어써 보여준다 — 반복 시간표(timetable)
 *  자체는 건드리지 않아 다른 주는 그대로 유지된다. 교환은 항상 두 칸(또는 한 칸과
 *  빈 자리) 사이에서 일어나므로, 관련된 (date, period) 각각에 독립된 항목이 생긴다 —
 *  관계를 따로 추적하지 않아도 칸 하나만 원래대로 되돌릴 수 있다. */
export interface SwapOverride {
  date: string; // YYYY-MM-DD
  period: number; // 0부터 시작
  subject: string; // 교환으로 이 날짜·교시에 표시할 과목(빈 문자열이면 그 시간이 빔)
  room: string;
}

/** 특정 날짜 한 교시에, 원래 시간표 내용과 별도로 "추가로" 진행하는 보강 수업.
 *  시간표 확인용 표시 전용이며 차시 계획표(SubjectProgress)와는 연동하지 않는다.
 *  칸 하나(date+period)에는 보강을 최대 1건만 두고, 새로 저장하면 이전 것을 덮어쓴다. */
export interface MakeupLesson {
  date: string; // YYYY-MM-DD
  period: number; // 0부터 시작
  subject: string;
  room: string;
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
  subjectProgress: SubjectProgress[];
  canceledLessons: CanceledLesson[];
  swapOverrides: SwapOverride[];
  makeupLessons: MakeupLesson[];
  /** 과목 이름 -> 차시별 한 줄 메모(index 0 = 1차시). 반이 달라도 같은 과목이면 공유한다. */
  subjectLessonNotes: Record<string, string[]>;
  /** "과목::반" -> 수동으로 고른 색상(SUBJECT_COLORS 팔레트 인덱스). 지정 안 하면
   *  같은 과목의 다른 반과 같은 색을 자동 배정. */
  subjectColors: Record<string, number>;
  ddays: Dday[];
}

export type OvertimeSession = '아침' | '저녁';

export interface OvertimeLog {
  id: string;
  date: string; // YYYY-MM-DD
  session: OvertimeSession;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  memo?: string;
  createdAt: string;
}

/** 원터치 출퇴근 체크 중 "출근만 찍힌" 진행 중 상태. 세션당 최대 1건. */
export interface OvertimePunch {
  date: string; // YYYY-MM-DD
  session: OvertimeSession;
  startTime: string; // HH:mm
}

/** 상품 캡쳐 이미지에서 Gemini가 추출한 상품 정보 */
export interface ExtractedProductItem {
  name: string;
  spec: string;
  unit: string;
  qty: number;
  unitPrice: number;
  vendor: string;
}

/** 품의서 장바구니/발행에 담기는 품목 */
export interface ProcurementItem {
  name: string;
  spec: string;
  unit: string;
  qty: number;
  unitPrice: number;
  vendor: string;
  sourceUrl: string;
}

export interface EventInput {
  title: string;
  date: string;
  endDate?: string;
  startTime?: string | null;
  endTime?: string | null;
  allDay: boolean;
  location?: string;
  description?: string;
  calendarId: string;
}
