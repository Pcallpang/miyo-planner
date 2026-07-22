import { describe, expect, test } from 'vitest';
import { reconcileMeetings } from './meetingSync';
import type { GEvent, Meeting } from '../types';

const range = { min: '2026-07-01', max: '2026-08-31' };

function gevent(over: Partial<GEvent>): GEvent {
  return {
    id: 'g1',
    calendarId: 'primary',
    title: '협의회',
    start: '2026-07-29T15:00:00+09:00',
    end: '2026-07-29T16:00:00+09:00',
    allDay: false,
    location: '',
    description: '',
    ...over,
  };
}

function meeting(over: Partial<Meeting>): Meeting {
  return { id: 'm1', title: '협의회', date: '2026-07-29', time: '15:00', memo: '', ...over };
}

describe('reconcileMeetings', () => {
  test('googleEventId가 없는 회의록은 그대로 둔다', () => {
    const local = [meeting({ googleEventId: undefined, title: '개인메모' })];
    const { meetings, changed } = reconcileMeetings(local, [], range);
    expect(changed).toBe(false);
    expect(meetings[0].title).toBe('개인메모');
  });

  test('구글에서 제목·시간이 바뀌면 회의록에 반영한다', () => {
    const local = [meeting({ googleEventId: 'g1', title: '협의회', time: '15:00' })];
    const events = [gevent({ id: 'g1', title: '긴급 협의회', start: '2026-07-29T16:30:00+09:00' })];
    const { meetings, changed } = reconcileMeetings(local, events, range);
    expect(changed).toBe(true);
    expect(meetings[0].title).toBe('긴급 협의회');
    expect(meetings[0].time).toBe('16:30');
  });

  test('종일 일정으로 바뀌면 time을 비운다', () => {
    const local = [meeting({ googleEventId: 'g1', time: '15:00' })];
    const events = [gevent({ id: 'g1', allDay: true, start: '2026-07-30', end: '2026-07-31' })];
    const { meetings } = reconcileMeetings(local, events, range);
    expect(meetings[0].date).toBe('2026-07-30');
    expect(meetings[0].time).toBeUndefined();
  });

  test('구글에서 삭제되었고 범위 안이면 연동을 해제하되 메모는 보존한다', () => {
    const local = [meeting({ googleEventId: 'g1', memo: '중요 메모' })];
    const { meetings, changed } = reconcileMeetings(local, [], range);
    expect(changed).toBe(true);
    expect(meetings[0].googleEventId).toBeUndefined();
    expect(meetings[0].memo).toBe('중요 메모');
  });

  test('범위 밖의 회의록은 이벤트에 없어도 건드리지 않는다', () => {
    const local = [meeting({ googleEventId: 'g1', date: '2026-12-25' })];
    const { meetings, changed } = reconcileMeetings(local, [], range);
    expect(changed).toBe(false);
    expect(meetings[0].googleEventId).toBe('g1');
  });

  test('변경이 없으면 changed=false', () => {
    const local = [meeting({ googleEventId: 'g1', title: '협의회', time: '15:00', memo: '' })];
    const events = [gevent({ id: 'g1', title: '협의회', start: '2026-07-29T15:00:00+09:00', description: '' })];
    const { changed } = reconcileMeetings(local, events, range);
    expect(changed).toBe(false);
  });
});
