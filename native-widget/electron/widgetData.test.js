import { describe, it, expect } from 'vitest';
import { toWidgetData } from './widgetData';

const fullState = {
  timetable: { 1: [{ subject: '수학', room: '3-1' }] },
  settings: {
    periodCount: 7,
    periodTimes: [{ start: '09:00', end: '09:50' }],
    calendarId: 'primary',
    overtimeHourlyRate: 12000,
    reminderMinutes: 10,
  },
  canceledLessons: [{ date: '2026-08-29', period: 2 }],
  swapOverrides: [{ date: '2026-08-29', period: 3, subject: '과학', room: '실험실' }],
  makeupLessons: [{ date: '2026-08-29', period: 4, subject: '국어', room: '3-2' }],
  subjectColors: { 수학: 2 },
  // 위젯이 쓰지 않는 민감한 개인 데이터
  todos: [{ id: '1', text: '병원 예약' }],
  memos: [{ id: 'm1', text: '비밀 메모' }],
  meetings: [{ id: 'g1', title: '학부모 상담' }],
  overtimeLogs: [{ date: '2026-08-28', minutes: 60 }],
  overtimePunches: [{ date: '2026-08-28' }],
  subjectLessonNotes: { 수학: '진도 메모' },
  subjectProgress: [{ subject: '수학' }],
  holidays: { '2026-09-01': '개교기념일' },
  lunchAfterPeriod: { 1: 4 },
  ddays: [{ id: 'd1', title: '수능' }],
};

describe('toWidgetData', () => {
  it('위젯이 쓰는 6개 필드만 남긴다', () => {
    expect(Object.keys(toWidgetData(fullState)).sort()).toEqual([
      'canceledLessons', 'makeupLessons', 'settings', 'subjectColors', 'swapOverrides', 'timetable',
    ]);
  });

  it('할 일·메모·회의·초과근무 등 민감 데이터를 떨어뜨린다', () => {
    const narrowed = toWidgetData(fullState);
    for (const key of ['todos', 'memos', 'meetings', 'overtimeLogs', 'overtimePunches',
      'subjectLessonNotes', 'subjectProgress', 'holidays', 'lunchAfterPeriod', 'ddays']) {
      expect(narrowed).not.toHaveProperty(key);
    }
  });

  it('settings는 교시 수와 교시 시간만 남긴다', () => {
    expect(toWidgetData(fullState).settings).toEqual({
      periodCount: 7,
      periodTimes: [{ start: '09:00', end: '09:50' }],
    });
  });

  it('화면에 쓰는 값은 그대로 보존한다', () => {
    const narrowed = toWidgetData(fullState);
    expect(narrowed.timetable).toEqual(fullState.timetable);
    expect(narrowed.canceledLessons).toEqual(fullState.canceledLessons);
    expect(narrowed.swapOverrides).toEqual(fullState.swapOverrides);
    expect(narrowed.makeupLessons).toEqual(fullState.makeupLessons);
    expect(narrowed.subjectColors).toEqual(fullState.subjectColors);
  });
});
