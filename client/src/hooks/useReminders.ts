import { useEffect, useRef } from 'react';
import { getDueReminders } from '../lib/reminders';
import type { GEvent } from '../types';

/**
 * 다가오는 시간제 일정을 leadMinutes 전에 브라우저 알림으로 띄운다.
 * 이미 알린 일정은 세션 동안 다시 알리지 않는다.
 */
export function useReminders(events: GEvent[], leadMinutes: number) {
  const notified = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (leadMinutes <= 0 || typeof Notification === 'undefined') return;
    if (Notification.permission === 'default') void Notification.requestPermission();

    const check = () => {
      if (Notification.permission !== 'granted') return;
      for (const r of getDueReminders(events, new Date(), leadMinutes, notified.current)) {
        notified.current.add(r.id);
        const t = new Date(r.start);
        const hhmm = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
        new Notification(r.title, { body: `${hhmm} 시작 예정입니다.`, tag: r.id });
      }
    };

    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, [events, leadMinutes]);
}
