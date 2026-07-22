export type ViewId = 'dashboard' | 'timetable' | 'monthly' | 'memo' | 'timer' | 'settings';

export type TodoCategory = '업무' | '교과' | '개인';

export interface Todo {
  id: string;
  text: string;
  category: TodoCategory;
  done: boolean;
  dueDate?: string; // YYYY-MM-DD
  createdAt: string;
}

export interface Meeting {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm
  memo: string;
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

export interface ServerStatus {
  googleConfigured: boolean;
  geminiConfigured: boolean;
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
