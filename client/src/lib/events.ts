import { endOfDay, format, parseISO, startOfDay } from 'date-fns';
import type { GEvent } from '../types';

/** 해당 날짜에 걸치는 일정 (종일 일정의 end는 exclusive) */
export function eventsOnDay(events: GEvent[], day: Date): GEvent[] {
  const dayStart = startOfDay(day).getTime();
  const dayEnd = endOfDay(day).getTime();
  return events
    .filter((ev) => {
      const s = parseISO(ev.start).getTime();
      const e = parseISO(ev.end).getTime();
      if (ev.allDay) return s <= dayStart && dayStart < e;
      return s <= dayEnd && e >= dayStart;
    })
    .sort((a, b) => {
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
      return a.start.localeCompare(b.start);
    });
}

export function eventTimeLabel(ev: GEvent): string {
  if (ev.allDay) return '종일';
  const s = format(parseISO(ev.start), 'HH:mm');
  const e = format(parseISO(ev.end), 'HH:mm');
  return `${s}~${e}`;
}

/** GEvent → 수정 폼 초기값 */
export function eventToForm(ev: GEvent) {
  const start = parseISO(ev.start);
  const end = parseISO(ev.end);
  return {
    title: ev.title,
    date: format(start, 'yyyy-MM-dd'),
    allDay: ev.allDay,
    startTime: ev.allDay ? '' : format(start, 'HH:mm'),
    endTime: ev.allDay ? '' : format(end, 'HH:mm'),
    location: ev.location,
    description: ev.description,
  };
}
