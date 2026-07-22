import { parseISO } from 'date-fns';
import type { GEvent } from '../types';

export interface Reminder {
  id: string;
  title: string;
  start: string;
}

/**
 * 지금(now) 기준 leadMinutes 이내에 시작하는 시간제 일정 중, 아직 알리지 않은 것을 반환한다.
 * - 종일 일정, 이미 시작한 일정, 이미 알린 일정, leadMinutes<=0 은 제외.
 */
export function getDueReminders(
  events: GEvent[],
  now: Date,
  leadMinutes: number,
  alreadyNotified: Set<string>,
): Reminder[] {
  if (leadMinutes <= 0) return [];
  const nowMs = now.getTime();
  const windowEnd = nowMs + leadMinutes * 60_000;

  return events
    .filter((ev) => !ev.allDay && !alreadyNotified.has(ev.id))
    .filter((ev) => {
      const startMs = parseISO(ev.start).getTime();
      return startMs >= nowMs && startMs <= windowEnd;
    })
    .map((ev) => ({ id: ev.id, title: ev.title, start: ev.start }));
}
