import { describe, expect, test } from 'vitest';
import { eventsOnDay, eventTimeLabel, filterEventsByKeywords } from './events';
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

describe('filterEventsByKeywords', () => {
  test('키워드가 없으면 전부 통과시킨다', () => {
    const events = [ev({ id: 'a', title: '상담' }), ev({ id: 'b', title: '수업' })];
    expect(filterEventsByKeywords(events, [])).toEqual(events);
  });

  test('제목에 키워드가 든 일정만 남긴다', () => {
    const res = filterEventsByKeywords(
      [ev({ id: 'a', title: '김송연 상담' }), ev({ id: 'b', title: '학년협의회' })],
      ['상담'],
    );
    expect(res.map((e) => e.id)).toEqual(['a']);
  });

  test('키워드가 여러 개면 하나라도 맞으면 남긴다', () => {
    const res = filterEventsByKeywords(
      [
        ev({ id: 'a', title: '김송연 상담' }),
        ev({ id: 'b', title: '학년협의회' }),
        ev({ id: 'c', title: '개학식' }),
      ],
      ['상담', '협의회'],
    );
    expect(res.map((e) => e.id)).toEqual(['a', 'b']);
  });

  test('대소문자를 구분하지 않는다', () => {
    const res = filterEventsByKeywords([ev({ id: 'a', title: 'Zoom 회의' })], ['zoom']);
    expect(res.map((e) => e.id)).toEqual(['a']);
  });

  test('키워드 앞뒤 공백은 무시한다', () => {
    const res = filterEventsByKeywords([ev({ id: 'a', title: '김송연 상담' })], ['  상담  ']);
    expect(res.map((e) => e.id)).toEqual(['a']);
  });

  test('빈 키워드는 무시한다', () => {
    const events = [ev({ id: 'a', title: '상담' }), ev({ id: 'b', title: '수업' })];
    expect(filterEventsByKeywords(events, ['   '])).toEqual(events);
  });

  test('제목에 없고 설명에만 있으면 남기지 않는다', () => {
    const res = filterEventsByKeywords(
      [ev({ id: 'a', title: '학년협의회', description: '상담 관련 안건' })],
      ['상담'],
    );
    expect(res).toHaveLength(0);
  });
});
