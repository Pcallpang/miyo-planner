import { describe, expect, test } from 'vitest';
import {
  durationMinutes,
  monthlyTotalMinutes,
  monthlyCappedTotalMinutes,
  countedMinutesForLog,
  dailyCappedMinutes,
  formatDuration,
  estimatedPay,
  payableHours,
  buildMorningPunchLog,
  buildEveningPunchLog,
  monthlyPayHistory,
  cumulativePay,
  OVERTIME_MONTHLY_CAP_MINUTES,
  DAILY_OVERTIME_CAP_MINUTES,
  DAILY_OVERTIME_GRACE_MINUTES,
  GRACE_RULE_EFFECTIVE_DATE,
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

  test('방과후 차감(afterSchoolMinutes)만큼 자동으로 빠진다', () => {
    expect(durationMinutes(log({ startTime: '17:00', endTime: '19:00', afterSchoolMinutes: 50 }))).toBe(70); // 120-50
  });

  test('방과후 차감이 전체 시간보다 크면 0을 반환한다', () => {
    expect(durationMinutes(log({ startTime: '17:00', endTime: '17:30', afterSchoolMinutes: 50 }))).toBe(0); // 30-50 → 0
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

  test('하루 공제 상수는 60분(1시간)이다', () => {
    expect(DAILY_OVERTIME_GRACE_MINUTES).toBe(60);
  });

  test('아침 초근만 1시간 미만이면 산입 불가능(0분)', () => {
    const logs: OvertimeLog[] = [
      log({ id: '1', date: '2026-09-18', session: '아침', startTime: '07:30', endTime: '08:00' }), // 30
    ];
    expect(dailyCappedMinutes(logs, '2026-09-18')).toBe(0);
  });

  test('저녁 초근만 1시간 미만이면 산입 불가능(0분)', () => {
    const logs: OvertimeLog[] = [
      log({ id: '1', date: '2026-09-18', session: '저녁', startTime: '17:00', endTime: '17:40' }), // 40
    ];
    expect(dailyCappedMinutes(logs, '2026-09-18')).toBe(0);
  });

  test('아침 초근만 1시간 이상이면 1시간 초과분만 산입', () => {
    const logs: OvertimeLog[] = [
      log({ id: '1', date: '2026-09-18', session: '아침', startTime: '07:00', endTime: '08:30' }), // 90
    ];
    expect(dailyCappedMinutes(logs, '2026-09-18')).toBe(30); // 90 - 60
  });

  test('저녁 초근만 1시간 이상이면 1시간 초과분만 산입', () => {
    const logs: OvertimeLog[] = [
      log({ id: '1', date: '2026-09-18', session: '저녁', startTime: '17:00', endTime: '19:00' }), // 120
    ];
    expect(dailyCappedMinutes(logs, '2026-09-18')).toBe(60); // 120 - 60
  });

  test('아침이 1시간 이상이면 저녁은 1시간 미만이어도 그대로 산입된다', () => {
    const logs: OvertimeLog[] = [
      log({ id: '1', date: '2026-09-18', session: '아침', startTime: '07:00', endTime: '08:30' }), // 90
      log({ id: '2', date: '2026-09-18', session: '저녁', startTime: '17:00', endTime: '17:20' }), // 20
    ];
    // 아침 초과분(30) + 저녁 전액(20) = 50
    expect(dailyCappedMinutes(logs, '2026-09-18')).toBe(50);
  });

  test('아침+저녁 둘 다 1시간 미만이면 합계에서 공제를 뺀 나머지만 산입', () => {
    const logs: OvertimeLog[] = [
      log({ id: '1', date: '2026-09-18', session: '아침', startTime: '07:00', endTime: '07:40' }), // 40
      log({ id: '2', date: '2026-09-18', session: '저녁', startTime: '17:00', endTime: '17:40' }), // 40
    ];
    expect(dailyCappedMinutes(logs, '2026-09-18')).toBe(20); // (40+40) - 60
  });

  test('아침+저녁 합계가 4시간을 넘으면 4시간만 인정한다', () => {
    const logs: OvertimeLog[] = [
      log({ id: '1', date: '2026-09-18', session: '아침', startTime: '07:00', endTime: '08:50' }), // 110
      log({ id: '2', date: '2026-09-18', session: '저녁', startTime: '17:50', endTime: '21:30' }), // 220
    ];
    expect(dailyRawSum(logs)).toBe(330);
    expect(dailyCappedMinutes(logs, '2026-09-18')).toBe(240); // (330-60)=270 → 240으로 캡
  });

  test('월 합계는 날짜별로 공제·상한을 적용한 뒤 합산한다', () => {
    const logs: OvertimeLog[] = [
      log({ id: '1', date: '2026-09-18', session: '아침', startTime: '07:00', endTime: '08:50' }), // 110
      log({ id: '2', date: '2026-09-18', session: '저녁', startTime: '17:50', endTime: '21:30' }), // 220 → 이 날은 (330-60)=270 → 240으로 캡
      log({ id: '3', date: '2026-09-19', session: '아침', startTime: '07:00', endTime: '08:00' }), // 60 → (60-60)=0
    ];
    expect(monthlyCappedTotalMinutes(logs, new Date('2026-09-01T00:00:00'))).toBe(240 + 0);
  });

  test('GRACE_RULE_EFFECTIVE_DATE 이전 날짜(예: 8월)는 공제 없이 예전 방식 그대로 계산한다', () => {
    const logs: OvertimeLog[] = [
      log({ id: '1', date: '2026-08-18', session: '아침', startTime: '07:30', endTime: '08:00' }), // 30분, 새 규칙이면 0
    ];
    expect(dailyCappedMinutes(logs, '2026-08-18')).toBe(30);
  });

  test('GRACE_RULE_EFFECTIVE_DATE 당일부터 새 규칙(공제)이 적용된다', () => {
    const logs: OvertimeLog[] = [
      log({ id: '1', date: GRACE_RULE_EFFECTIVE_DATE, session: '아침', startTime: '07:30', endTime: '08:00' }), // 30분
    ];
    expect(dailyCappedMinutes(logs, GRACE_RULE_EFFECTIVE_DATE)).toBe(0);
  });

  function dailyRawSum(logs: OvertimeLog[]): number {
    return logs.reduce((sum, l) => sum + durationMinutes(l), 0);
  }
});

describe('countedMinutesForLog', () => {
  test('아침만 1시간 이상이면 그 로그는 초과분만 인정된다', () => {
    const logs: OvertimeLog[] = [
      log({ id: '1', date: '2026-09-18', session: '아침', startTime: '07:00', endTime: '08:30' }), // 90
    ];
    expect(countedMinutesForLog(logs, logs[0])).toBe(30);
  });

  test('아침 1시간 이상 + 저녁 20분 → 아침 로그는 초과분, 저녁 로그는 전액', () => {
    const logs: OvertimeLog[] = [
      log({ id: '1', date: '2026-09-18', session: '아침', startTime: '07:00', endTime: '08:30' }), // 90
      log({ id: '2', date: '2026-09-18', session: '저녁', startTime: '17:00', endTime: '17:20' }), // 20
    ];
    expect(countedMinutesForLog(logs, logs[0])).toBe(30);
    expect(countedMinutesForLog(logs, logs[1])).toBe(20);
  });

  test('둘 다 1시간 미만이면 공제가 아침에서 먼저 빠지고 남은 만큼 저녁에서 빠진다', () => {
    const logs: OvertimeLog[] = [
      log({ id: '1', date: '2026-09-18', session: '아침', startTime: '07:00', endTime: '07:40' }), // 40
      log({ id: '2', date: '2026-09-18', session: '저녁', startTime: '17:00', endTime: '17:40' }), // 40
    ];
    // 공제 60분 중 40분은 아침에서, 남은 20분은 저녁에서 소진 → 아침 0, 저녁 20
    expect(countedMinutesForLog(logs, logs[0])).toBe(0);
    expect(countedMinutesForLog(logs, logs[1])).toBe(20);
  });

  test('하루 4시간 상한에 걸리면 두 로그 몫을 비율대로 줄여도 합계는 상한과 일치한다', () => {
    const logs: OvertimeLog[] = [
      log({ id: '1', date: '2026-09-18', session: '아침', startTime: '07:00', endTime: '11:40' }), // 280
      log({ id: '2', date: '2026-09-18', session: '저녁', startTime: '17:00', endTime: '18:40' }), // 100
    ];
    // 공제 후: 아침 220, 저녁 100, 합 320 → 240으로 캡, 비율 0.75 → 아침 165, 저녁 75
    const morning = countedMinutesForLog(logs, logs[0]);
    const evening = countedMinutesForLog(logs, logs[1]);
    expect(morning).toBe(165);
    expect(evening).toBe(75);
    expect(morning + evening).toBe(DAILY_OVERTIME_CAP_MINUTES);
  });
});

describe('monthlyPayHistory / cumulativePay', () => {
  // 8월·7월은 GRACE_RULE_EFFECTIVE_DATE(9월 1일) 이전이라 공제 없이 예전 방식(4시간 상한만)으로 계산된다.
  const logs: OvertimeLog[] = [
    log({ id: '1', date: '2026-08-05', session: '아침', startTime: '07:00', endTime: '09:00' }), // 8월: 120분 → 2시간
    log({ id: '2', date: '2026-07-10', session: '저녁', startTime: '17:00', endTime: '20:00' }), // 7월: 180분 → 3시간
  ];

  test('기록이 있는 달만, 최신순으로 반환한다', () => {
    const history = monthlyPayHistory(logs, 10000);
    expect(history.map((h) => h.monthKey)).toEqual(['2026-08', '2026-07']);
  });

  test('달마다 인정 시간·시간 수·예상 수당을 계산한다(과거 달은 공제 없이)', () => {
    const history = monthlyPayHistory(logs, 10000);
    expect(history[0]).toEqual({ monthKey: '2026-08', minutes: 120, hours: 2, pay: 20000 });
    expect(history[1]).toEqual({ monthKey: '2026-07', minutes: 180, hours: 3, pay: 30000 });
  });

  test('누적 예상 수당은 모든 달의 합이다', () => {
    expect(cumulativePay(logs, 10000)).toBe(50000);
  });

  test('기록이 없으면 빈 배열·0원', () => {
    expect(monthlyPayHistory([], 10000)).toEqual([]);
    expect(cumulativePay([], 10000)).toBe(0);
  });
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

describe('payableHours', () => {
  test('분 단위는 절삭한다', () => {
    expect(payableHours(8 * 60 + 19)).toBe(8);
    expect(payableHours(90)).toBe(1);
  });

  test('한 시간을 못 채우면 0시간', () => {
    expect(payableHours(59)).toBe(0);
    expect(payableHours(0)).toBe(0);
  });

  test('정확히 떨어지면 그대로', () => {
    expect(payableHours(120)).toBe(2);
  });
});

describe('estimatedPay', () => {
  test('분을 절삭한 시간 수 × 단가로 계산한다', () => {
    // 8시간 19분 → 8시간만 인정
    expect(estimatedPay(8 * 60 + 19, 14213)).toBe(8 * 14213);
  });

  test('1시간 30분은 1시간으로 친다', () => {
    expect(estimatedPay(90, 12000)).toBe(12000);
  });

  test('한 시간을 못 채우면 0원', () => {
    expect(estimatedPay(59, 12000)).toBe(0);
  });

  test('단가가 0이면 0원', () => {
    expect(estimatedPay(120, 0)).toBe(0);
  });

  test('절삭은 월 합계에 한 번만 적용된다 (날짜별로 버리지 않는다)', () => {
    // 하루 1시간 50분씩 3일 = 5시간 30분 → 5시간.
    // 날짜별로 버렸다면 1시간씩 3일 = 3시간이 됐을 것이다.
    expect(estimatedPay(3 * 110, 10000)).toBe(5 * 10000);
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
