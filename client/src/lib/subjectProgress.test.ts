import { describe, expect, test } from 'vitest';
import { canceledCountByDate, countLessonsUntil, weeklyOccurrences } from './subjectProgress';
import type { CanceledLesson, Timetable } from '../types';

describe('weeklyOccurrences', () => {
  test('과목+반 조합이 배정된 요일마다 교시 수를 센다', () => {
    const timetable: Timetable = {
      1: [{ subject: '수학', room: '1-3' }, { subject: '영어', room: '1-3' }],
      2: [{ subject: '수학', room: '1-3' }],
      3: [],
      4: [{ subject: '수학', room: '1-3' }, { subject: '수학', room: '1-3' }],
      5: [{ subject: '영어', room: '1-3' }],
    };
    expect(weeklyOccurrences(timetable, '수학', '1-3')).toEqual({ 1: 1, 2: 1, 4: 2 });
  });

  test('같은 과목이어도 반이 다르면 세지 않는다', () => {
    const timetable: Timetable = {
      1: [{ subject: '수학', room: '1-3' }],
      2: [{ subject: '수학', room: '1-4' }],
      3: [],
      4: [],
      5: [],
    };
    expect(weeklyOccurrences(timetable, '수학', '1-3')).toEqual({ 1: 1 });
  });

  test('시간표에 없는 과목+반 조합은 빈 객체를 준다', () => {
    const timetable: Timetable = { 1: [], 2: [], 3: [], 4: [], 5: [] };
    expect(weeklyOccurrences(timetable, '과학', '1-1')).toEqual({});
  });
});

describe('countLessonsUntil', () => {
  // 2026-08-24는 월요일
  const occurrences = { 1: 2, 3: 1 }; // 월요일 2교시, 수요일 1교시

  test('월~수 한 주를 세면 월(2)+수(1)=3', () => {
    // 8/24(월) 포함 ~ 8/27(목) 제외 => 8/24,25,26 카운트
    expect(countLessonsUntil(occurrences, '2026-08-24', '2026-08-27', new Set())).toBe(3);
  });

  test('휴업일은 그 요일이어도 세지 않는다', () => {
    expect(
      countLessonsUntil(occurrences, '2026-08-24', '2026-08-27', new Set(['2026-08-24'])),
    ).toBe(1); // 월요일(8/24) 제외되어 수요일(8/26) 1차시만 남음
  });

  test('주말은 요일 배정이 없어도 자동으로 건너뛴다', () => {
    // 8/28(금) ~ 8/31(월, 제외): 토(29)/일(30) 지나 8/31은 제외되므로 이 구간엔 월/수가 없다
    expect(countLessonsUntil(occurrences, '2026-08-28', '2026-08-31', new Set())).toBe(0);
  });

  test('fromInclusive와 toExclusive가 같으면 0', () => {
    expect(countLessonsUntil(occurrences, '2026-08-24', '2026-08-24', new Set())).toBe(0);
  });

  test('두 주에 걸친 기간도 누적해서 센다', () => {
    // 8/24(월) ~ 9/3(목, 제외): 1주차 월,수 + 2주차 월(8/31),수(9/2)
    expect(countLessonsUntil(occurrences, '2026-08-24', '2026-09-03', new Set())).toBe(6);
  });

  test('canceledByDate에 있는 날짜는 그만큼 빼고 센다', () => {
    // 8/24(월) 2교시 중 1교시가 휴강 -> 그날은 1만 인정
    expect(
      countLessonsUntil(occurrences, '2026-08-24', '2026-08-27', new Set(), { '2026-08-24': 1 }),
    ).toBe(2); // 월(2-1=1) + 수(1) = 2
  });

  test('휴강 수가 배정 수보다 많아도 음수로 내려가지 않는다', () => {
    expect(
      countLessonsUntil(occurrences, '2026-08-24', '2026-08-25', new Set(), { '2026-08-24': 5 }),
    ).toBe(0);
  });
});

describe('canceledCountByDate', () => {
  const timetable: Timetable = {
    1: [{ subject: '수학', room: '1-3' }, { subject: '영어', room: '1-3' }],
    2: [{ subject: '수학', room: '1-4' }],
  };

  test('그 (과목, 반)에 실제로 해당하는 휴강만 날짜별로 센다', () => {
    // 2026-08-24는 월요일, 2026-08-25는 화요일
    const canceled: CanceledLesson[] = [
      { date: '2026-08-24', period: 0 }, // 월 1교시 = 수학/1-3
      { date: '2026-08-24', period: 1 }, // 월 2교시 = 영어/1-3 (다른 과목)
      { date: '2026-08-25', period: 0 }, // 화 1교시 = 수학/1-4 (다른 반)
    ];
    expect(canceledCountByDate(timetable, canceled, '수학', '1-3')).toEqual({ '2026-08-24': 1 });
  });

  test('같은 날짜에 같은 (과목, 반) 교시가 두 번 취소되면 합산한다', () => {
    const doubleTimetable: Timetable = {
      1: [{ subject: '수학', room: '1-3' }, { subject: '수학', room: '1-3' }],
    };
    const canceled: CanceledLesson[] = [
      { date: '2026-08-24', period: 0 },
      { date: '2026-08-24', period: 1 },
    ];
    expect(canceledCountByDate(doubleTimetable, canceled, '수학', '1-3')).toEqual({ '2026-08-24': 2 });
  });

  test('일치하는 게 없으면 빈 객체를 준다', () => {
    expect(canceledCountByDate(timetable, [], '수학', '1-3')).toEqual({});
  });
});
