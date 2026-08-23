import type { CanceledLesson, Timetable } from '../types';

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
function toWeekday(ymd: string): number | null {
  const dow = new Date(`${ymd}T00:00:00`).getDay();
  return dow >= 1 && dow <= 5 ? dow : null;
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
 * fromInclusive는 포함, toExclusive(시험일 등 기준일)는 제외된다. canceledByDate에 그 날짜가
 * 있으면(학교 행사로 그날만 휴강된 경우) 해당 교시 수만큼 빼고 더한다.
 */
export function countLessonsUntil(
  occurrences: Record<number, number>,
  fromInclusive: string,
  toExclusive: string,
  noClassDates: Set<string>,
  canceledByDate: Record<string, number> = {},
): number {
  let total = 0;
  let cursor = fromInclusive;
  while (cursor < toExclusive) {
    if (!noClassDates.has(cursor)) {
      const weekday = toWeekday(cursor);
      if (weekday !== null) {
        const occurred = occurrences[weekday] ?? 0;
        const canceled = canceledByDate[cursor] ?? 0;
        total += Math.max(0, occurred - canceled);
      }
    }
    cursor = addDay(cursor);
  }
  return total;
}
