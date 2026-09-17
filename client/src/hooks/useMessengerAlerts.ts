import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { MessengerAlert } from '../types';

const POLL_MS = 15_000;

/** 로그인 상태일 때만(enabled) 15초마다 메신저 알리미 대기 카드를 폴링한다. */
export function useMessengerAlerts(enabled: boolean) {
  const [alerts, setAlerts] = useState<MessengerAlert[]>([]);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const { alerts } = await api.listMessengerAlerts();
      setAlerts(alerts);
    } catch {
      /* 폴링 실패는 조용히 무시하고 다음 주기에 재시도한다. */
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setAlerts([]);
      return;
    }
    void refresh();
    const id = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(id);
  }, [enabled, refresh]);

  return { alerts, refresh };
}
