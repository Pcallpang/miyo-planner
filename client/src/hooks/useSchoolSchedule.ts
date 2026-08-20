import { useEffect, useState } from 'react';
import { endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from 'date-fns';
import { api } from '../lib/api';
import type { School, SchoolScheduleItem } from '../types';

interface Result {
  schedule: SchoolScheduleItem[];
  /** 조회에 실패한 경우 사용자에게 보여줄 한국어 사유. 성공이면 null */
  error: string | null;
}

/**
 * 표시 중인 달의 나이스 학사일정을 가져온다.
 * 학사일정은 학교가 정하는 정보라 앱에 저장하지 않고 필요할 때마다 조회한다.
 * (서버에서 6시간 캐시하므로 달을 오가도 나이스를 반복 호출하지 않는다)
 *
 * 달력은 이전 달 끝자락·다음 달 첫머리 칸까지 그리므로(MonthCalendar 참고),
 * 조회 범위도 그 격자 전체에 맞춘다. 달 범위만 부르면 경계 칸이 늘 비어 보인다.
 */
export function useSchoolSchedule(
  school: School | undefined,
  month: Date,
  enabled: boolean,
  weekStartsOn: 0 | 1,
): Result {
  const [schedule, setSchedule] = useState<SchoolScheduleItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const monthKey = format(month, 'yyyy-MM');

  useEffect(() => {
    if (!school || !enabled) {
      setSchedule([]);
      setError(null);
      return;
    }
    let cancelled = false;
    const base = new Date(`${monthKey}-01T00:00:00`);
    const from = format(startOfWeek(startOfMonth(base), { weekStartsOn }), 'yyyy-MM-dd');
    const to = format(endOfWeek(endOfMonth(base), { weekStartsOn }), 'yyyy-MM-dd');

    api
      .schoolSchedule(school, from, to)
      .then((r) => {
        if (cancelled) return;
        setSchedule(r.schedule);
        setError(null);
      })
      .catch((e: unknown) => {
        // 캘린더 위 부가 정보이므로 토스트로 방해하지 않고, 달력 옆에 조용히 사유만 알린다
        if (cancelled) return;
        setSchedule([]);
        setError(e instanceof Error ? e.message : '학사일정을 불러오지 못했습니다.');
      });

    return () => {
      cancelled = true;
    };
  }, [school, monthKey, enabled, weekStartsOn]);

  return { schedule, error };
}
