import { useEffect, useRef } from 'react';
import type { Todo } from '../types';

/** 서울 기준 오늘 날짜 YYYY-MM-DD */
function todaySeoul(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
}

/**
 * 마감일이 '오늘'인 미완료 할 일을 브라우저 알림으로 알린다.
 * 세션당 항목별 1회만 알린다. enabled=false면 동작하지 않는다.
 */
export function useTodoReminders(todos: Todo[], enabled: boolean) {
  const notified = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled || typeof Notification === 'undefined') return;
    if (Notification.permission === 'default') void Notification.requestPermission();

    const check = () => {
      if (Notification.permission !== 'granted') return;
      const today = todaySeoul();
      for (const t of todos) {
        if (t.done || t.dueDate !== today || notified.current.has(t.id)) continue;
        notified.current.add(t.id);
        new Notification('오늘 마감 할 일', { body: t.text, tag: `todo-${t.id}` });
      }
    };

    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, [todos, enabled]);
}
