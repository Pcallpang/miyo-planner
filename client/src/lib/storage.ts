import { useEffect, useState } from 'react';
import type { Settings } from '../types';

export const STORAGE_KEYS = {
  todos: 'haru.todos',
  meetings: 'haru.meetings',
  memos: 'haru.memos',
  timetable: 'haru.timetable',
  settings: 'haru.settings',
} as const;

export function defaultSettings(): Settings {
  return {
    periodCount: 7,
    periodTimes: [
      { start: '09:00', end: '09:50' },
      { start: '10:00', end: '10:50' },
      { start: '11:00', end: '11:50' },
      { start: '12:00', end: '12:50' },
      { start: '13:50', end: '14:40' },
      { start: '14:50', end: '15:40' },
      { start: '15:50', end: '16:40' },
    ],
    weekStartsOn: 0,
    calendarId: 'primary',
    reminderMinutes: 10,
    urgentDays: 3,
    showSchoolSchedule: true,
    eventKeywords: [],
    overtimeHourlyRate: 0,
    morningOvertimeEndTime: '08:50',
    eveningOvertimeStartTime: '16:50',
    sidebarOrder: [],
  };
}

/** 저장본에 없는 새 설정 필드를 기본값으로 채운다(하위호환). */
export function normalizeSettings(s: Settings): Settings {
  return { ...defaultSettings(), ...s };
}

export function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** localStorage와 동기화되는 상태 훅 */
export function useLocalStorage<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => loadFromStorage(key, fallback));
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* 저장 공간 부족 등은 무시 */
    }
  }, [key, value]);
  return [value, setValue] as const;
}

export function clearAppData() {
  Object.values(STORAGE_KEYS).forEach((k) => localStorage.removeItem(k));
}
