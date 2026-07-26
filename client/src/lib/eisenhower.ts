import { differenceInCalendarDays, parseISO } from 'date-fns';
import type { Todo } from '../types';

export type QuadrantId = 'do' | 'plan' | 'quick' | 'later';

export interface QuadrantMeta {
  id: QuadrantId;
  title: string;
  hint: string;
  important: boolean;
  urgent: boolean;
}

/** 화면 배치 순서(왼쪽 위 → 오른쪽 아래) */
export const QUADRANTS: QuadrantMeta[] = [
  { id: 'do', title: '지금 급해요!', hint: '중요하고 급함', important: true, urgent: true },
  { id: 'plan', title: '미리 챙겨둬요', hint: '중요하지만 급하지 않음', important: true, urgent: false },
  { id: 'quick', title: '후딱 해치워요', hint: '급하지만 중요하지 않음', important: false, urgent: true },
  { id: 'later', title: '천천히 해도 돼요', hint: '급하지도 중요하지도 않음', important: false, urgent: false },
];

/**
 * 할 일이 긴급한지 판정한다.
 * 수동 고정(urgentOverride)이 있으면 그 값을, 없으면 마감일 기준으로 자동 판정한다.
 * 마감일이 지난 항목은 언제나 긴급으로 본다.
 */
export function isUrgent(todo: Todo, urgentDays: number, today: Date = new Date()): boolean {
  if (todo.urgentOverride !== undefined) return todo.urgentOverride;
  if (!todo.dueDate) return false;
  const daysLeft = differenceInCalendarDays(parseISO(todo.dueDate), today);
  return daysLeft < urgentDays;
}

export function isImportant(todo: Todo): boolean {
  return todo.important === true;
}

export function quadrantOf(important: boolean, urgent: boolean): QuadrantId {
  if (important) return urgent ? 'do' : 'plan';
  return urgent ? 'quick' : 'later';
}

export function quadrantOfTodo(todo: Todo, urgentDays: number, today?: Date): QuadrantId {
  return quadrantOf(isImportant(todo), isUrgent(todo, urgentDays, today));
}

/** 수동 고정이 실제로 적용되고 있는지(= 자동 판정과 달라 의미가 있는지) */
export function hasUrgentOverride(todo: Todo): boolean {
  return todo.urgentOverride !== undefined;
}

/**
 * 항목을 특정 분면으로 옮겼을 때의 다음 상태를 만든다.
 * 목적지의 긴급값이 자동 판정과 같으면 불필요한 고정을 남기지 않는다.
 */
export function moveToQuadrant(
  todo: Todo,
  target: QuadrantId,
  urgentDays: number,
  today: Date = new Date(),
): Todo {
  const meta = QUADRANTS.find((q) => q.id === target);
  if (!meta) return todo;

  const next: Todo = { ...todo, important: meta.important };
  const auto = isUrgent({ ...todo, urgentOverride: undefined }, urgentDays, today);
  if (auto === meta.urgent) delete next.urgentOverride;
  else next.urgentOverride = meta.urgent;
  return next;
}

/** 수동 고정을 해제해 자동 판정으로 되돌린다. */
export function clearUrgentOverride(todo: Todo): Todo {
  const next = { ...todo };
  delete next.urgentOverride;
  return next;
}
