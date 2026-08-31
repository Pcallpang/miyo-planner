import { describe, expect, test } from 'vitest';
import { getDayPhase, getPhaseMessage, getNextPeriodIndex, addWeekday } from './schedule';
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

describe('getPhaseMessage', () => {
  test('주말 메시지', () => {
    expect(getPhaseMessage({ kind: 'weekend' }, times)).toBe('주말이에요. 편안한 하루 보내세요.');
  });

  test('일과 전 메시지는 첫 교시 시작 시각을 포함한다', () => {
    expect(getPhaseMessage({ kind: 'before' }, times)).toBe('아직 일과 전이에요. 09:00에 시작해요.');
  });

  test('일과 후 메시지', () => {
    expect(getPhaseMessage({ kind: 'after' }, times)).toBe('오늘 일과가 끝났어요. 수고하셨어요!');
  });

  test('쉬는 시간 메시지', () => {
    expect(getPhaseMessage({ kind: 'break', nextIndex: 1 }, times)).toBe('쉬는 시간이에요');
  });

  test('수업 중 메시지는 교시 번호와 과목을 포함한다', () => {
    expect(getPhaseMessage({ kind: 'period', index: 0 }, times, { subject: '수학', room: '201' })).toBe(
      '1교시 진행 중 · 수학 201',
    );
  });

  test('수업 중인데 과목이 미배정이면 교시 번호만 보여준다', () => {
    expect(getPhaseMessage({ kind: 'period', index: 0 }, times, { subject: '', room: '' })).toBe('1교시 진행 중');
  });
});

describe('getNextPeriodIndex', () => {
  test('일과 전이면 0교시(첫 교시)를 가리킨다', () => {
    expect(getNextPeriodIndex({ kind: 'before' }, 2)).toBe(0);
  });

  test('교시가 하나도 없으면 일과 전이어도 다음 교시가 없다', () => {
    expect(getNextPeriodIndex({ kind: 'before' }, 0)).toBeNull();
  });

  test('쉬는 시간이면 nextIndex를 그대로 가리킨다', () => {
    expect(getNextPeriodIndex({ kind: 'break', nextIndex: 1 }, 2)).toBe(1);
  });

  test('수업 중이면 다음 교시(index+1)를 가리킨다', () => {
    expect(getNextPeriodIndex({ kind: 'period', index: 0 }, 2)).toBe(1);
  });

  test('마지막 교시 수업 중이면 다음 교시가 없다', () => {
    expect(getNextPeriodIndex({ kind: 'period', index: 1 }, 2)).toBeNull();
  });

  test('일과 후/주말은 다음 교시가 없다', () => {
    expect(getNextPeriodIndex({ kind: 'after' }, 2)).toBeNull();
    expect(getNextPeriodIndex({ kind: 'weekend' }, 2)).toBeNull();
  });
});

describe('addWeekday', () => {
  test('평일 안에서는 하루씩 이동한다', () => {
    const result = addWeekday(new Date('2026-07-22T10:00'), 1); // 수 -> 목
    expect(result.toDateString()).toBe(new Date('2026-07-23T10:00').toDateString());
  });

  test('금요일 다음은 주말을 건너뛰어 월요일', () => {
    const result = addWeekday(new Date('2026-07-24T10:00'), 1); // 금 -> 월(27일)
    expect(result.toDateString()).toBe(new Date('2026-07-27T10:00').toDateString());
  });

  test('월요일 이전은 주말을 건너뛰어 금요일', () => {
    const result = addWeekday(new Date('2026-07-27T10:00'), -1); // 월 -> 금(24일)
    expect(result.toDateString()).toBe(new Date('2026-07-24T10:00').toDateString());
  });

  test('토요일에서 다음으로 가면 월요일', () => {
    const result = addWeekday(new Date('2026-07-25T10:00'), 1); // 토 -> 월(27일)
    expect(result.toDateString()).toBe(new Date('2026-07-27T10:00').toDateString());
  });
});
