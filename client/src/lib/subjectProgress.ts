import type { CanceledLesson, PeriodSlot, SwapOverride, Timetable } from '../types';

/** 시간표에서 그 (과목, 반) 조합이 배정된 요일(1~5)별 교시 수. 같은 요일에 두 번 있으면 2. */
export function weeklyOccurrences(
  timetable: Timetable,
  subject: string,
  className: string,
): Record<number, number> {
  const result: Record<number, number> = {};
  for (const day of [1, 2, 3, 4, 5]) {
    const count = (timetable[day] ?? []).filter(
      (s) => s.subject.trim() === subject && s.room.trim() === className,
    ).length;
    if (count > 0) result[day] = count;
  }
  return result;
}

/** YYYY-MM-DD 날짜 문자열에 하루를 더한다 */
export function addDay(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Date.getDay()(0=일~6=토)를 이 앱의 요일 표기(1=월~5=금)로. 주말이면 null. */
export function toWeekday(ymd: string): number | null {
  const dow = new Date(`${ymd}T00:00:00`).getDay();
  return dow >= 1 && dow <= 5 ? dow : null;
}

/** timetable(반복 패턴)과 swapOverrides(그 날짜만의 예외)를 합쳐, 특정 날짜·교시에
 *  실제로 보여줄 과목/반을 계산한다. override가 있으면 그것을, 없으면 반복 시간표의
 *  해당 요일·교시를 쓴다. */
export function effectiveSlot(
  timetable: Timetable,
  swapOverrides: SwapOverride[],
  date: string,
  period: number,
): PeriodSlot {
  const override = swapOverrides.find((o) => o.date === date && o.period === period);
  if (override) return { subject: override.subject, room: override.room };
  const weekday = toWeekday(date);
  if (weekday === null) return { subject: '', room: '' };
  return (timetable[weekday] ?? [])[period] ?? { subject: '', room: '' };
}

/**
 * (과목, 반) 하나에 대해, 그 날짜의 "반복 시간표 기준 배정 차시 수"를 얼마나 빼거나
 * 더할지 날짜별로 계산한다. 양수 = 그만큼 빼서 센다(휴강, 또는 교환으로 이 수업이
 * 그 날짜에서 빠짐), 음수 = 그만큼 더해서 센다(교환으로 이 수업이 그 날짜에 새로
 * 들어옴). countLessonsUntil의 마지막 인자에 그대로 넘긴다.
 *
 * 휴강 판정은 교환이 반영된 실제 화면 내용(effectiveSlot) 기준이다 — 그래야 "교환으로
 * 들어온 수업을 그 날짜만 휴강 처리"한 경우에도 정확히 그 수업의 차시만 깎인다.
 */
export function lessonAdjustmentByDate(
  timetable: Timetable,
  canceled: CanceledLesson[],
  swapOverrides: SwapOverride[],
  subject: string,
  className: string,
): Record<string, number> {
  const result: Record<string, number> = {};
  const add = (date: string, delta: number) => {
    result[date] = (result[date] ?? 0) + delta;
  };

  for (const c of canceled) {
    const slot = effectiveSlot(timetable, swapOverrides, c.date, c.period);
    if (slot.subject.trim() === subject && slot.room.trim() === className) add(c.date, 1);
  }

  for (const o of swapOverrides) {
    const weekday = toWeekday(o.date);
    if (weekday === null) continue;
    const original = (timetable[weekday] ?? [])[o.period];
    const originalIsOurs = original?.subject.trim() === subject && original?.room.trim() === className;
    const overrideIsOurs = o.subject.trim() === subject && o.room.trim() === className;
    if (originalIsOurs && !overrideIsOurs) add(o.date, 1); // 이 자리에서 교환으로 빠짐
    else if (!originalIsOurs && overrideIsOurs) add(o.date, -1); // 이 자리에 교환으로 새로 들어옴
  }

  return result;
}

/**
 * 휴강 처리된 항목 중 이 (과목, 반)에 해당하는 것만 걸러, 날짜별 휴강 교시 수를 센다.
 * 휴강은 특정 날짜 하나의 특정 교시만 가리키므로, 그 교시가 실제 이 (과목, 반)인지
 * 시간표에서 확인해야 한다(반복 시간표가 바뀌면 예전 휴강 기록은 자연히 무시된다).
 */
export function canceledCountByDate(
  timetable: Timetable,
  canceled: CanceledLesson[],
  subject: string,
  className: string,
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const c of canceled) {
    const weekday = toWeekday(c.date);
    if (weekday === null) continue;
    const slot = (timetable[weekday] ?? [])[c.period];
    if (slot && slot.subject.trim() === subject && slot.room.trim() === className) {
      result[c.date] = (result[c.date] ?? 0) + 1;
    }
  }
  return result;
}

/**
 * fromInclusive부터 toExclusive 전날까지, noClassDates에 없는 평일만 세어 그날 요일에
 * 배정된 교시 수(occurrences)만큼 더한다. "오늘부터 시험 전날까지" 총 차시 계산에 쓴다 —
 * fromInclusive는 포함, toExclusive(시험일 등 기준일)는 제외된다. adjustmentByDate에 그
 * 날짜가 있으면 그 값만큼 빼서 더한다(휴강처럼 양수면 빼고, 교환으로 그 날짜에 수업이
 * 새로 생긴 경우처럼 음수면 오히려 더한다) — lessonAdjustmentByDate가 만드는 값을 그대로
 * 넘기면 휴강과 교환을 함께 반영한 총 차시가 나온다.
 */
export function countLessonsUntil(
  occurrences: Record<number, number>,
  fromInclusive: string,
  toExclusive: string,
  noClassDates: Set<string>,
  adjustmentByDate: Record<string, number> = {},
): number {
  let total = 0;
  let cursor = fromInclusive;
  while (cursor < toExclusive) {
    if (!noClassDates.has(cursor)) {
      const weekday = toWeekday(cursor);
      if (weekday !== null) {
        const occurred = occurrences[weekday] ?? 0;
        const adjustment = adjustmentByDate[cursor] ?? 0;
        total += Math.max(0, occurred - adjustment);
      }
    }
    cursor = addDay(cursor);
  }
  return total;
}
