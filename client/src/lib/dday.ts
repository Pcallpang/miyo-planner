import { differenceInCalendarDays } from 'date-fns';
import type { Dday } from '../types';

/** target - today의 날짜 차이(자정 기준). 0이면 오늘, 양수면 미래, 음수면 이미 지남. */
export function ddayDiff(date: string, today: Date = new Date()): number {
  return differenceInCalendarDays(new Date(`${date}T00:00:00`), today);
}

/** "D-42" / "D-DAY" / "D+10" 형태로. */
export function ddayLabel(diff: number): string {
  if (diff === 0) return 'D-DAY';
  return diff > 0 ? `D-${diff}` : `D+${Math.abs(diff)}`;
}

/** 오늘과 가장 가까운(같은 거리면 아직 안 지난 쪽을 우선) 하나를 고른다. 없으면 undefined. */
export function nearestDday(ddays: Dday[], today: Date = new Date()): Dday | undefined {
  if (ddays.length === 0) return undefined;
  return [...ddays].sort((a, b) => {
    const da = ddayDiff(a.date, today);
    const db = ddayDiff(b.date, today);
    const diff = Math.abs(da) - Math.abs(db);
    if (diff !== 0) return diff;
    return db - da; // 거리가 같으면 아직 안 지난(양수) 쪽을 우선
  })[0];
}
