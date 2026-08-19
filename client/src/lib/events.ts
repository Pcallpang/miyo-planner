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

/**
 * 제목에 키워드가 든 일정만 남긴다. 키워드가 여러 개면 하나라도 맞으면 통과(OR).
 * 대소문자와 키워드 앞뒤 공백은 무시하고, 비어 있는 키워드는 없는 셈 친다.
 */
export function filterEventsByKeywords(events: GEvent[], keywords: string[]): GEvent[] {
  const needles = keywords.map((k) => k.trim().toLowerCase()).filter(Boolean);
  if (needles.length === 0) return events;
  return events.filter((ev) => {
    const title = ev.title.toLowerCase();
    return needles.some((n) => title.includes(n));
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
