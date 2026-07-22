import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api, ApiError } from '../lib/api';
import { defaultAppData, collectLocalStorage } from '../lib/appData';
import type { AppData } from '../types';

interface DataValue {
  data: AppData;
  loading: boolean;
  update: (patch: Partial<AppData>) => void;
}
const Ctx = createContext<DataValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(defaultAppData);
  const [loading, setLoading] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<Partial<AppData>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { state } = await api.getData();
        // 첫 로그인 이관: 서버가 기본값(빈 todos 등)이고 로컬에 데이터가 있으면 올림
        const local = collectLocalStorage();
        const serverEmpty =
          state.todos.length === 0 &&
          state.memos.length === 0 &&
          Object.keys(state.timetable).length === 0 &&
          state.meetings.length === 0;
        if (local && serverEmpty) {
          const migrated = { ...state, ...local };
          if (!cancelled) setData(migrated);
          await api.putData(local);
        } else if (!cancelled) {
          setData(state);
        }
      } catch (e) {
        // 미인증(401)이면 기본값으로 두고 조용히 넘어간다. 로그인 후 재마운트되어 다시 로드된다.
        if (e instanceof ApiError && e.status === 401) {
          if (!cancelled) setData(defaultAppData());
        }
        // 그 외 오류도 기본값 유지(토스트 없음).
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function update(patch: Partial<AppData>) {
    setData((prev) => ({ ...prev, ...patch }));
    pending.current = { ...pending.current, ...patch };
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const toSend = pending.current;
      pending.current = {};
      void api.putData(toSend);
    }, 800);
  }

  return <Ctx.Provider value={{ data, loading, update }}>{children}</Ctx.Provider>;
}

export function useData() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useData는 DataProvider 안에서만 사용할 수 있습니다.');
  return c;
}
