import { describe, expect, test } from 'vitest';
import { eventsOnDay, eventTimeLabel } from './events';
import type { GEvent } from '../types';

function ev(over: Partial<GEvent>): GEvent {
  return {
    id: 'e',
    calendarId: 'primary',
    title: '회의',
    start: '2026-07-22T09:00:00',
    end: '2026-07-22T10:00:00',
    allDay: false,
    location: '',
    description: '',
    ...over,
  };
}

describe('eventsOnDay', () => {
  const day = new Date('2026-07-22T00:00:00');

  test('같은 날 시간제 일정을 포함한다', () => {
    const res = eventsOnDay([ev({ id: 'a' })], day);
    expect(res.map((e) => e.id)).toEqual(['a']);
  });

  test('다른 날 일정은 제외한다', () => {
    const res = eventsOnDay([ev({ id: 'a', start: '2026-07-23T09:00:00', end: '2026-07-23T10:00:00' })], day);
    expect(res).toHaveLength(0);
  });

  test('종일 일정을 먼저, 그 다음 시작 시간순으로 정렬한다', () => {
    const res = eventsOnDay(
      [
        ev({ id: 'late', start: '2026-07-22T14:00:00' }),
        ev({ id: 'allday', allDay: true, start: '2026-07-22', end: '2026-07-23' }),
        ev({ id: 'early', start: '2026-07-22T09:00:00' }),
      ],
      day,
    );
    expect(res.map((e) => e.id)).toEqual(['allday', 'early', 'late']);
  });
});

describe('eventTimeLabel', () => {
  test('종일 일정은 "종일"', () => {
    expect(eventTimeLabel(ev({ allDay: true, start: '2026-07-22', end: '2026-07-23' }))).toBe('종일');
  });

  test('시간제 일정은 시작~종료', () => {
    expect(eventTimeLabel(ev({ start: '2026-07-22T09:00:00', end: '2026-07-22T10:30:00' }))).toBe('09:00~10:30');
  });
});
