const DEFAULT_SETTINGS = {
  periodCount: 7,
  periodTimes: [
    { start: '09:00', end: '09:50' }, { start: '10:00', end: '10:50' },
    { start: '11:00', end: '11:50' }, { start: '12:00', end: '12:50' },
    { start: '13:50', end: '14:40' }, { start: '14:50', end: '15:40' },
    { start: '15:50', end: '16:40' },
  ],
  weekStartsOn: 0,
  calendarId: 'primary',
  reminderMinutes: 10,
  overtimeHourlyRate: 0,
  morningOvertimeEndTime: '08:50',
  eveningOvertimeStartTime: '17:50',
};

export function defaultAppState() {
  return {
    todos: [],
    meetings: [],
    memos: [],
    timetable: {},
    settings: { ...DEFAULT_SETTINGS },
    holidays: {},
    overtimeLogs: [],
    overtimePunches: [],
  };
}

const KEYS = ['todos', 'meetings', 'memos', 'timetable', 'settings', 'holidays', 'overtimeLogs', 'overtimePunches'];

export function mergeAppState(existing, patch) {
  if (!patch || typeof patch !== 'object' || Object.keys(patch).length === 0) return existing;
  const out = { ...existing };
  for (const k of KEYS) if (k in patch) out[k] = patch[k];
  return out;
}
