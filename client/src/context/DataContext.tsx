import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { api, ApiError } from '../lib/api';
import { defaultAppData, collectLocalStorage } from '../lib/appData';
import { normalizeSettings } from '../lib/storage';
import type { AppData } from '../types';

interface DataValue {
  data: AppData;
  loading: boolean;
  update: (patch: Partial<AppData> | ((prev: AppData) => Partial<AppData>)) => void;
}
const Ctx = createContext<DataValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(defaultAppData);
  const [loading, setLoading] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<Partial<AppData>>({});

  const scheduleFlush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      const toSend = pending.current;
      pending.current = {};
      api.putData(toSend).catch(() => {
        // 실패분을 다시 대기열에 병합(최신 pending이 우선) 후 재시도 예약
        pending.current = { ...toSend, ...pending.current };
        scheduleFlush();
      });
    }, 800);
  }, []);

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
          const migrated = {
            ...state,
            ...local,
            settings: normalizeSettings({ ...state.settings, ...(local.settings ?? {}) }),
            overtimeLogs: state.overtimeLogs ?? [],
            overtimePunches: state.overtimePunches ?? [],
          };
          if (!cancelled) {
            setData(migrated);
            await api.putData({ ...local, settings: migrated.settings });
          }
        } else if (!cancelled) {
          setData({
            ...state,
            settings: normalizeSettings(state.settings),
            overtimeLogs: state.overtimeLogs ?? [],
            overtimePunches: state.overtimePunches ?? [],
          });
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

  const update = useCallback(
    (patch: Partial<AppData> | ((prev: AppData) => Partial<AppData>)) => {
      setData((prev) => {
        const p = typeof patch === 'function' ? patch(prev) : patch;
        pending.current = { ...pending.current, ...p };
        return { ...prev, ...p };
      });
      scheduleFlush();
    },
    [scheduleFlush],
  );

  const value = useMemo<DataValue>(() => ({ data, loading, update }), [data, loading, update]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useData는 DataProvider 안에서만 사용할 수 있습니다.');
  return c;
}
