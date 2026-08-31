import { useEffect, useRef } from 'react';
import { purgeOldCompletedTodos } from '../lib/todoDone';
import type { AppData, Todo } from '../types';

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1시간마다 확인

/** 완료된 지 3일 지난 To-Do를 주기적으로 걸러내 완전히 삭제한다. */
export function useCompletedTodoPurge(
  todos: Todo[],
  update: (patch: Partial<AppData> | ((prev: AppData) => Partial<AppData>)) => void,
) {
  const todosRef = useRef(todos);
  todosRef.current = todos;

  useEffect(() => {
    const check = () => {
      const current = todosRef.current;
      const purged = purgeOldCompletedTodos(current);
      if (purged.length !== current.length) update({ todos: purged });
    };
    check();
    const id = setInterval(check, CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [update]);
}
