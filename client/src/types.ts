export type ViewId = 'dashboard' | 'matrix' | 'timetable' | 'memo' | 'settings';

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

export interface PeriodTime {
  start: string; // HH:mm
  end: string; // HH:mm
}

export interface PeriodSlot {
  subject: string;
  room: string;
}

/** 요일(1=월 ~ 5=금) → 교시별 과목/교실 */
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

export interface AppData {
  todos: Todo[];
  meetings: Meeting[];
  memos: MemoNote[];
  timetable: Timetable;
  settings: Settings;
  /** 사용자가 지정한 휴일(재량휴업일 등). YYYY-MM-DD → 라벨 */
  holidays: Record<string, string>;
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
