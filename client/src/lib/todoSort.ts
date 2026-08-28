import type { Todo } from '../types';

/** 마감일이 있으면 빠른 날짜순으로 앞에, 마감일이 없으면 등록순(원래 배열 순서) 그대로 뒤에 붙인다. */
export function sortTodosByDueDate(todos: Todo[]): Todo[] {
  const dated = todos.filter((t) => t.dueDate);
  const undated = todos.filter((t) => !t.dueDate);
  dated.sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : a.dueDate! > b.dueDate! ? 1 : 0));
  return [...dated, ...undated];
}
