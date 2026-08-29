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
  refetch: () => Promise<void>;
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
    // 저장 대기 중(800ms 디바운스)인 변경사항을, 탭이 백그라운드로 가거나
    // 앱이 닫히는 순간 즉시 전송한다. 예: 모바일에서 초과근무 버튼을 누르자마자
    // 화면을 끄면 타이머가 돌기 전에 앱이 종료되어 기록이 유실될 수 있었다.
    const flushImmediately = () => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      if (Object.keys(pending.current).length === 0) return;
      const toSend = pending.current;
      pending.current = {};
      api.putData(toSend, { keepalive: true }).catch(() => {
        pending.current = { ...toSend, ...pending.current };
      });
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushImmediately();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', flushImmediately);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', flushImmediately);
    };
  }, []);

  const loadFromServer = useCallback(async () => {
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
        setData(migrated);
        await api.putData({ ...local, settings: migrated.settings });
      } else {
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
        setData(defaultAppData());
      }
      // 그 외 오류도 기본값 유지(토스트 없음).
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFromServer();
  }, [loadFromServer]);

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

  const refetch = useCallback(() => loadFromServer(), [loadFromServer]);

  const value = useMemo<DataValue>(
    () => ({ data, loading, update, refetch }),
    [data, loading, update, refetch],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useData는 DataProvider 안에서만 사용할 수 있습니다.');
  return c;
}
