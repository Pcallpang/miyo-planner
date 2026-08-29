import { describe, expect, test } from 'vitest';
import { effectiveSlot, toWeekday } from './scheduleSlot';
import type { SwapOverride, Timetable } from '../types';

const timetable: Timetable = {
  1: [{ subject: '수학', room: '3-1' }, { subject: '영어', room: '3-1' }],
};

describe('toWeekday', () => {
  test('평일은 1~5', () => {
    expect(toWeekday('2026-08-24')).toBe(1); // 월요일
  });
  test('주말은 null', () => {
    expect(toWeekday('2026-08-29')).toBe(null); // 토요일
  });
});

describe('effectiveSlot', () => {
  test('교환 기록이 없으면 반복 시간표를 그대로 돌려준다', () => {
    expect(effectiveSlot(timetable, [], '2026-08-24', 0)).toEqual({ subject: '수학', room: '3-1' });
  });

  test('그 날짜·교시에 교환 기록이 있으면 그것으로 덮어쓴다', () => {
    const overrides: SwapOverride[] = [{ date: '2026-08-24', period: 0, subject: '과학', room: '3-2' }];
    expect(effectiveSlot(timetable, overrides, '2026-08-24', 0)).toEqual({ subject: '과학', room: '3-2' });
  });

  test('주말 날짜는 빈 칸을 돌려준다', () => {
    expect(effectiveSlot(timetable, [], '2026-08-29', 0)).toEqual({ subject: '', room: '' });
  });
});
