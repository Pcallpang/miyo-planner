import type { PeriodTime } from '../types';

export type DayPhase =
  | { kind: 'weekend' }
  | { kind: 'before' }
  | { kind: 'period'; index: number } // 0-based
  | { kind: 'break'; nextIndex: number }
  | { kind: 'after' };

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** 현재 시각 기준 일과 상태 판정 */
export function getDayPhase(now: Date, periodTimes: PeriodTime[], periodCount: number): DayPhase {
  const day = now.getDay();
  if (day === 0 || day === 6) return { kind: 'weekend' };

  const times = periodTimes.slice(0, periodCount);
  if (times.length === 0) return { kind: 'after' };

  const nowMin = now.getHours() * 60 + now.getMinutes();
  if (nowMin < toMinutes(times[0].start)) return { kind: 'before' };

  for (let i = 0; i < times.length; i++) {
    if (nowMin >= toMinutes(times[i].start) && nowMin < toMinutes(times[i].end)) {
      return { kind: 'period', index: i };
    }
    const next = times[i + 1];
    if (next && nowMin >= toMinutes(times[i].end) && nowMin < toMinutes(next.start)) {
      return { kind: 'break', nextIndex: i + 1 };
    }
  }
  return { kind: 'after' };
}

export const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
