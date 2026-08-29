import { describe, expect, test } from 'vitest';
import { getDayPhase } from './schedule';
import type { PeriodTime } from '../types';

const times: PeriodTime[] = [
  { start: '09:00', end: '09:50' },
  { start: '10:00', end: '10:50' },
];

describe('getDayPhase', () => {
  test('토요일은 주말', () => {
    expect(getDayPhase(new Date('2026-07-25T10:00'), times, 2).kind).toBe('weekend');
  });

  test('첫 교시 전은 일과 전', () => {
    expect(getDayPhase(new Date('2026-07-22T08:30'), times, 2).kind).toBe('before');
  });

  test('교시 시간 안이면 해당 교시', () => {
    expect(getDayPhase(new Date('2026-07-22T09:30'), times, 2)).toEqual({ kind: 'period', index: 0 });
  });

  test('교시 사이는 쉬는 시간이고 다음 교시를 가리킨다', () => {
    expect(getDayPhase(new Date('2026-07-22T09:55'), times, 2)).toEqual({ kind: 'break', nextIndex: 1 });
  });

  test('마지막 교시 후는 일과 후', () => {
    expect(getDayPhase(new Date('2026-07-22T11:30'), times, 2).kind).toBe('after');
  });

  test('periodCount로 교시 수를 제한한다', () => {
    expect(getDayPhase(new Date('2026-07-22T10:30'), times, 1).kind).toBe('after');
  });
});
