import { useEffect, useState } from 'react';
import { endOfMonth, format, startOfMonth } from 'date-fns';
import { api } from '../lib/api';
import type { School, SchoolScheduleItem } from '../types';

/**
 * 표시 중인 달의 나이스 학사일정을 가져온다.
 * 학사일정은 학교가 정하는 정보라 앱에 저장하지 않고 필요할 때마다 조회한다.
 * (서버에서 6시간 캐시하므로 달을 오가도 나이스를 반복 호출하지 않는다)
 */
export function useSchoolSchedule(school: School | undefined, month: Date, enabled: boolean) {
  const [schedule, setSchedule] = useState<SchoolScheduleItem[]>([]);
  const monthKey = format(month, 'yyyy-MM');

  useEffect(() => {
    if (!school || !enabled) {
      setSchedule([]);
      return;
    }
    let cancelled = false;
    const base = new Date(`${monthKey}-01T00:00:00`);
    const from = format(startOfMonth(base), 'yyyy-MM-dd');
    const to = format(endOfMonth(base), 'yyyy-MM-dd');

    api
      .schoolSchedule(school, from, to)
      .then((r) => {
        if (!cancelled) setSchedule(r.schedule);
      })
      .catch(() => {
        // 캘린더 위 부가 정보이므로 실패해도 토스트로 방해하지 않는다
        if (!cancelled) setSchedule([]);
      });

    return () => {
      cancelled = true;
    };
  }, [school, monthKey, enabled]);

  return schedule;
}
