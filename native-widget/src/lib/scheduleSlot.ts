import type { PeriodSlot, SwapOverride, Timetable } from '../types';

/** Date.getDay()(0=일~6=토)를 이 앱의 요일 표기(1=월~5=금)로. 주말이면 null. */
export function toWeekday(ymd: string): number | null {
  const dow = new Date(`${ymd}T00:00:00`).getDay();
  return dow >= 1 && dow <= 5 ? dow : null;
}

/** timetable(반복 패턴)과 swapOverrides(그 날짜만의 예외)를 합쳐, 특정 날짜·교시에
 *  실제로 보여줄 과목/반을 계산한다. */
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
