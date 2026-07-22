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
import { addMonths, endOfMonth, startOfMonth } from 'date-fns';
import { api } from '../lib/api';
import { useData } from './DataContext';
import type { CalendarInfo, GEvent, ServerStatus, Settings } from '../types';

export interface Toast {
  id: number;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface AppContextValue {
  status: ServerStatus | null;
  refreshStatus: () => Promise<void>;
  connectGoogle: () => Promise<void>;
  disconnectGoogle: () => Promise<void>;

  settings: Settings;
  setSettings: (updater: (prev: Settings) => Settings) => void;

  calendars: CalendarInfo[];
  events: GEvent[];
  eventsLoading: boolean;
  /** 현재 events가 커버하는 날짜 범위 (YYYY-MM-DD). 미연동/미로드 시 null */
  eventsRange: { min: string; max: string } | null;
  /** 해당 월(± 1개월)의 일정을 불러온다 */
  ensureEvents: (month: Date) => Promise<void>;
  refreshEvents: () => Promise<void>;

  toasts: Toast[];
  showToast: (type: Toast['type'], message: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

let toastSeq = 0;

export function AppProvider({ children }: { children: ReactNode }) {
  const { data, update } = useData();
  const settings = data.settings;
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [calendars, setCalendars] = useState<CalendarInfo[]>([]);
  const [events, setEvents] = useState<GEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsRange, setEventsRange] = useState<{ min: string; max: string } | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const rangeRef = useRef<{ min: string; max: string; month: Date } | null>(null);

  const showToast = useCallback((type: Toast['type'], message: string) => {
    const id = ++toastSeq;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const setSettings = useCallback(
    (updater: (prev: Settings) => Settings) => update({ settings: updater(settings) }),
    [update, settings],
  );

  const refreshStatus = useCallback(async () => {
    try {
      setStatus(await api.status());
    } catch {
      setStatus(null);
    }
  }, []);

  const loadRange = useCallback(
    async (month: Date, calendarId: string) => {
      const min = startOfMonth(addMonths(month, -1)).toISOString();
      const max = endOfMonth(addMonths(month, 1)).toISOString();
      rangeRef.current = { min, max, month };
      setEventsLoading(true);
      try {
        const { events: list } = await api.events(calendarId, min, max);
        setEvents(list);
        setEventsRange({ min: min.slice(0, 10), max: max.slice(0, 10) });
      } catch (e) {
        showToast('error', e instanceof Error ? e.message : '일정을 불러오지 못했습니다.');
      } finally {
        setEventsLoading(false);
      }
    },
    [showToast],
  );

  const ensureEvents = useCallback(
    async (month: Date) => {
      if (!status?.connected) return;
      const r = rangeRef.current;
      const min = startOfMonth(month).toISOString();
      const max = endOfMonth(month).toISOString();
      if (r && r.min <= min && r.max >= max) return;
      await loadRange(month, settings.calendarId);
    },
    [status?.connected, settings.calendarId, loadRange],
  );

  const refreshEvents = useCallback(async () => {
    if (!status?.connected) return;
    await loadRange(rangeRef.current?.month ?? new Date(), settings.calendarId);
  }, [status?.connected, settings.calendarId, loadRange]);

  const connectGoogle = useCallback(async () => {
    try {
      const { url } = await api.authUrl();
      window.location.href = url;
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : '연동을 시작하지 못했습니다.');
    }
  }, [showToast]);

  const disconnectGoogle = useCallback(async () => {
    try {
      await api.logout();
      setEvents([]);
      setCalendars([]);
      rangeRef.current = null;
      await refreshStatus();
      showToast('info', '구글 계정 연동이 해제되었습니다.');
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : '연동 해제에 실패했습니다.');
    }
  }, [refreshStatus, showToast]);

  // 초기 상태 확인 + OAuth 콜백 처리
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const auth = params.get('auth');
    if (auth) {
      window.history.replaceState(null, '', window.location.pathname);
      if (auth === 'success') showToast('success', '구글 계정이 연동되었습니다.');
      else showToast('error', params.get('message') || '구글 연동에 실패했습니다.');
    }
    void refreshStatus();
  }, [refreshStatus, showToast]);

  // 연동되면 캘린더 목록 + 이번 달 일정 로드
  useEffect(() => {
    if (!status?.connected) return;
    api
      .calendars()
      .then(({ calendars: list }) => setCalendars(list))
      .catch(() => setCalendars([]));
    void loadRange(new Date(), settings.calendarId);
  }, [status?.connected, settings.calendarId, loadRange]);

  const value = useMemo<AppContextValue>(
    () => ({
      status,
      refreshStatus,
      connectGoogle,
      disconnectGoogle,
      settings,
      setSettings,
      calendars,
      events,
      eventsLoading,
      eventsRange,
      ensureEvents,
      refreshEvents,
      toasts,
      showToast,
    }),
    [
      status,
      refreshStatus,
      connectGoogle,
      disconnectGoogle,
      settings,
      setSettings,
      calendars,
      events,
      eventsLoading,
      eventsRange,
      ensureEvents,
      refreshEvents,
      toasts,
      showToast,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp은 AppProvider 안에서만 사용할 수 있습니다.');
  return ctx;
}
