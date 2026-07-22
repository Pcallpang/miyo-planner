import { describe, expect, test } from 'vitest';
import { getDueReminders } from './reminders';
import type { GEvent } from '../types';

const now = new Date('2026-07-22T09:00:00+09:00');

function ev(over: Partial<GEvent>): GEvent {
  return {
    id: 'e',
    calendarId: 'primary',
    title: '회의',
    start: '2026-07-22T09:10:00+09:00',
    end: '2026-07-22T10:00:00+09:00',
    allDay: false,
    location: '',
    description: '',
    ...over,
  };
}

describe('getDueReminders', () => {
  test('lead 시간 안(10분 뒤)의 일정은 알림 대상이다', () => {
    const due = getDueReminders([ev({ id: 'a', start: '2026-07-22T09:10:00+09:00' })], now, 30, new Set());
    expect(due.map((d) => d.id)).toEqual(['a']);
  });

  test('lead 시간 밖(40분 뒤)의 일정은 제외한다', () => {
    const due = getDueReminders([ev({ id: 'a', start: '2026-07-22T09:40:00+09:00' })], now, 30, new Set());
    expect(due).toHaveLength(0);
  });

  test('이미 시작한 일정은 제외한다', () => {
    const due = getDueReminders([ev({ id: 'a', start: '2026-07-22T08:59:00+09:00' })], now, 30, new Set());
    expect(due).toHaveLength(0);
  });

  test('종일 일정은 알림하지 않는다', () => {
    const due = getDueReminders([ev({ id: 'a', allDay: true, start: '2026-07-22' })], now, 30, new Set());
    expect(due).toHaveLength(0);
  });

  test('이미 알림한 일정은 다시 알리지 않는다', () => {
    const due = getDueReminders([ev({ id: 'a' })], now, 30, new Set(['a']));
    expect(due).toHaveLength(0);
  });

  test('lead가 0이면 알림하지 않는다', () => {
    const due = getDueReminders([ev({ id: 'a' })], now, 0, new Set());
    expect(due).toHaveLength(0);
  });
});
