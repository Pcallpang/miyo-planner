import type { Todo } from '../types';

/** 완료 표시된 항목을 이만큼 지난 뒤 자동으로 완전히 삭제한다. */
export const DONE_RETENTION_DAYS = 3;

/** 체크박스 토글 시 완료 시각(completedAt)을 함께 기록/해제한다 — 3일 자동삭제 기준이 된다. */
export function toggleTodoDone(todo: Todo): Todo {
  if (todo.done) {
    return { ...todo, done: false, completedAt: undefined };
  }
  return { ...todo, done: true, completedAt: new Date().toISOString() };
}

/** 완료된 지 DONE_RETENTION_DAYS일이 지난 항목을 걸러낸다. */
export function purgeOldCompletedTodos(todos: Todo[], now: number = Date.now()): Todo[] {
  const retentionMs = DONE_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  return todos.filter((t) => {
    if (!t.done || !t.completedAt) return true;
    return now - new Date(t.completedAt).getTime() < retentionMs;
  });
}
