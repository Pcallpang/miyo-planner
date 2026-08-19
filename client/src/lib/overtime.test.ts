import { describe, expect, test } from 'vitest';
import {
  durationMinutes,
  monthlyTotalMinutes,
  monthlyCappedTotalMinutes,
  dailyCappedMinutes,
  formatDuration,
  estimatedPay,
  buildMorningPunchLog,
  buildEveningPunchLog,
  OVERTIME_MONTHLY_CAP_MINUTES,
  DAILY_OVERTIME_CAP_MINUTES,
} from './overtime';
import type { OvertimeLog } from '../types';

function log(over: Partial<OvertimeLog> = {}): OvertimeLog {
  return {
    id: '1',
    date: '2026-08-10',
    session: '아침',
    startTime: '07:00',
    endTime: '08:30',
    createdAt: '2026-08-10T00:00:00.000Z',
    ...over,
  };
}

describe('durationMinutes', () => {
  test('종료-시작을 분 단위로 계산한다', () => {
    expect(durationMinutes(log({ startTime: '07:00', endTime: '08:30' }))).toBe(90);
  });

  test('종료가 시작보다 빠르면 0을 반환한다', () => {
    expect(durationMinutes(log({ startTime: '08:00', endTime: '07:30' }))).toBe(0);
  });

  test('시작과 종료가 같으면 0을 반환한다', () => {
    expect(durationMinutes(log({ startTime: '08:00', endTime: '08:00' }))).toBe(0);
  });
});

describe('monthlyTotalMinutes', () => {
  const logs: OvertimeLog[] = [
    log({ id: '1', date: '2026-08-05', session: '아침', startTime: '07:00', endTime: '08:00' }), // 60
    log({ id: '2', date: '2026-08-20', session: '저녁', startTime: '17:00', endTime: '19:00' }), // 120
    log({ id: '3', date: '2026-07-30', session: '저녁', startTime: '17:00', endTime: '18:00' }), // 다른 달, 제외
  ];

  test('같은 연/월의 로그만 합산한다', () => {
    expect(monthlyTotalMinutes(logs, new Date('2026-08-15T00:00:00'))).toBe(180);
  });

  test('session을 주면 해당 세션만 합산한다', () => {
    expect(monthlyTotalMinutes(logs, new Date('2026-08-15T00:00:00'), '아침')).toBe(60);
    expect(monthlyTotalMinutes(logs, new Date('2026-08-15T00:00:00'), '저녁')).toBe(120);
  });

  test('57시간 상한 상수는 3420분이다', () => {
    expect(OVERTIME_MONTHLY_CAP_MINUTES).toBe(3420);
  });
});

describe('dailyCappedMinutes / monthlyCappedTotalMinutes', () => {
  test('하루 상한 상수는 240분(4시간)이다', () => {
    expect(DAILY_OVERTIME_CAP_MINUTES).toBe(240);
  });

  test('하루 합계가 4시간 이하면 그대로 인정한다', () => {
    const logs: OvertimeLog[] = [
      log({ id: '1', date: '2026-08-18', session: '아침', startTime: '07:00', endTime: '08:30' }), // 90
    ];
    expect(dailyCappedMinutes(logs, '2026-08-18')).toBe(90);
  });

  test('아침+저녁 합계가 4시간을 넘으면 4시간만 인정한다', () => {
    const logs: OvertimeLog[] = [
      log({ id: '1', date: '2026-08-18', session: '아침', startTime: '07:00', endTime: '08:50' }), // 110
      log({ id: '2', date: '2026-08-18', session: '저녁', startTime: '17:50', endTime: '21:30' }), // 220
    ];
    expect(dailyRawSum(logs)).toBe(330);
    expect(dailyCappedMinutes(logs, '2026-08-18')).toBe(240);
  });

  test('월 합계는 날짜별 상한을 적용한 뒤 합산한다', () => {
    const logs: OvertimeLog[] = [
      log({ id: '1', date: '2026-08-18', session: '아침', startTime: '07:00', endTime: '08:50' }), // 110
      log({ id: '2', date: '2026-08-18', session: '저녁', startTime: '17:50', endTime: '21:30' }), // 220 → 이 날은 240으로 캡
      log({ id: '3', date: '2026-08-19', session: '아침', startTime: '07:00', endTime: '08:00' }), // 60, 캡 안 걸림
    ];
    expect(monthlyCappedTotalMinutes(logs, new Date('2026-08-01T00:00:00'))).toBe(240 + 60);
  });

  function dailyRawSum(logs: OvertimeLog[]): number {
    return logs.reduce((sum, l) => sum + durationMinutes(l), 0);
  }
});

describe('formatDuration', () => {
  test('시간과 분을 함께 표기한다', () => {
    expect(formatDuration(90)).toBe('1시간 30분');
  });

  test('분이 0이면 시간만 표기한다', () => {
    expect(formatDuration(120)).toBe('2시간');
  });

  test('1시간 미만이면 분만 표기한다', () => {
    expect(formatDuration(45)).toBe('45분');
  });

  test('0분은 "0분"으로 표기한다', () => {
    expect(formatDuration(0)).toBe('0분');
  });
});

describe('estimatedPay', () => {
  test('시간당 단가 × 시간으로 계산한다', () => {
    expect(estimatedPay(90, 12000)).toBe(18000); // 1.5h × 12000
  });

  test('단가가 0이면 0원', () => {
    expect(estimatedPay(120, 0)).toBe(0);
  });
});

describe('buildMorningPunchLog', () => {
  test('현재 시각이 종료 시각 전이면 시작=현재, 종료=설정된 종료 시각인 로그를 만든다', () => {
    const result = buildMorningPunchLog('2026-08-18', '07:10', '08:50');
    expect(result).not.toBeNull();
    expect(result?.date).toBe('2026-08-18');
    expect(result?.session).toBe('아침');
    expect(result?.startTime).toBe('07:10');
    expect(result?.endTime).toBe('08:50');
    expect(typeof result?.id).toBe('string');
    expect(typeof result?.createdAt).toBe('string');
  });

  test('현재 시각이 종료 시각과 같거나 지났으면 null을 반환한다', () => {
    expect(buildMorningPunchLog('2026-08-18', '08:50', '08:50')).toBeNull();
    expect(buildMorningPunchLog('2026-08-18', '09:00', '08:50')).toBeNull();
  });
});

describe('buildEveningPunchLog', () => {
  test('현재 시각이 시작 시각 뒤면 시작=설정된 시작 시각, 종료=현재인 로그를 만든다', () => {
    const result = buildEveningPunchLog('2026-08-18', '19:30', '17:50');
    expect(result).not.toBeNull();
    expect(result?.date).toBe('2026-08-18');
    expect(result?.session).toBe('저녁');
    expect(result?.startTime).toBe('17:50');
    expect(result?.endTime).toBe('19:30');
    expect(typeof result?.id).toBe('string');
    expect(typeof result?.createdAt).toBe('string');
  });

  test('현재 시각이 시작 시각과 같거나 이전이면 null을 반환한다', () => {
    expect(buildEveningPunchLog('2026-08-18', '17:50', '17:50')).toBeNull();
    expect(buildEveningPunchLog('2026-08-18', '17:00', '17:50')).toBeNull();
  });
});
