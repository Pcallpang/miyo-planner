import { defaultSettings } from './storage';
import type { AppData } from '../types';

export function defaultAppData(): AppData {
  return {
    todos: [],
    meetings: [],
    memos: [],
    timetable: {},
    settings: defaultSettings(),
    holidays: {},
    overtimeLogs: [],
    overtimePunches: [],
    subjectProgress: [],
    canceledLessons: [],
  };
}

/** 기존 localStorage 데이터를 모아 이관용 AppData로 만든다(없으면 null). */
export function collectLocalStorage(): Partial<AppData> | null {
  const read = <T>(k: string): T | undefined => {
    try {
      const v = localStorage.getItem(k);
      return v ? (JSON.parse(v) as T) : undefined;
    } catch {
      return undefined;
    }
  };
  const todos = read('haru.todos');
  const meetings = read('haru.meetings');
  const memos = read('haru.memos');
  const timetable = read('haru.timetable');
  const settings = read('haru.settings');
  const holidays = read('haru.holidays');
  const out: Partial<AppData> = {};
  if (todos) out.todos = todos as AppData['todos'];
  if (meetings) out.meetings = meetings as AppData['meetings'];
  if (memos) out.memos = memos as AppData['memos'];
  if (timetable) out.timetable = timetable as AppData['timetable'];
  if (settings) out.settings = settings as AppData['settings'];
  if (holidays) out.holidays = holidays as AppData['holidays'];
  return Object.keys(out).length ? out : null;
}
