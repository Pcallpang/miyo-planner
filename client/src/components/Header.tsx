import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { LogIn, Plus } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useData } from '../context/DataContext';
import { getDayPhase } from '../lib/schedule';
import { ddayDiff, ddayLabel } from '../lib/dday';
import DdayModal from './DdayModal';
import type { PeriodTime, Timetable } from '../types';

function phaseLabel(now: Date, periodTimes: PeriodTime[], count: number, timetable: Timetable) {
  const phase = getDayPhase(now, periodTimes, count);
  switch (phase.kind) {
    case 'weekend':
      return '주말';
    case 'before':
      return '일과 전';
    case 'period': {
      // 현재 교시의 과목·교실을 함께 표시. 둘 다 비어 있으면 '공강'.
      const slot = timetable[now.getDay()]?.[phase.index];
      const parts = [slot?.subject, slot?.room].filter((s): s is string => Boolean(s && s.trim()));
      return `${phase.index + 1}교시 · ${parts.length ? parts.join(' · ') : '공강'}`;
    }
    case 'break':
      return '쉬는 시간';
    case 'after':
      return '일과 후';
  }
}

export default function Header() {
  const { status, connectGoogle, settings } = useApp();
  const { data } = useData();
  const [now, setNow] = useState(() => new Date());
  const [ddayOpen, setDdayOpen] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const sortedDdays = [...data.ddays].sort((a, b) => ddayDiff(a.date, now) - ddayDiff(b.date, now));

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-slate-200/70 bg-white/80 px-6 py-3.5 backdrop-blur lg:px-8">
      <div className="flex min-w-0 flex-1 items-baseline gap-3">
        <span className="shrink-0 text-base font-semibold text-slate-700">
          {format(now, 'M월 d일 (EEE)', { locale: ko })}
        </span>
        <span className="shrink-0 text-xl font-bold tabular-nums text-mint-600">
          {format(now, 'HH:mm:ss')}
        </span>
        <span className="hidden shrink-0 rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-semibold text-sky-600 sm:inline-block">
          {phaseLabel(now, settings.periodTimes, settings.periodCount, data.timetable)}
        </span>
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto pb-0.5">
          {sortedDdays.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setDdayOpen(true)}
              className="flex shrink-0 items-center gap-1 rounded-full border border-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-500 transition hover:border-amber-300 hover:text-amber-600"
            >
              <span className="text-amber-600">{ddayLabel(ddayDiff(d.date, now))}</span>
              <span className="hidden font-normal text-slate-400 sm:inline">{d.label}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setDdayOpen(true)}
            className="flex shrink-0 items-center gap-1 rounded-full border border-dashed border-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-400 transition hover:border-amber-300 hover:text-amber-600"
          >
            <Plus size={12} />
            {sortedDdays.length === 0 && 'D-day'}
          </button>
        </div>
      </div>

      {ddayOpen && <DdayModal onClose={() => setDdayOpen(false)} />}

      {status?.connected ? (
        <span className="flex items-center gap-2 rounded-full border border-mint-200 bg-mint-50 px-3 py-1.5 text-xs font-medium text-mint-700 sm:px-3.5">
          <span className="h-2 w-2 shrink-0 rounded-full bg-mint-500" />
          <span className="hidden sm:inline">{status.email ?? '구글 계정 연동됨'}</span>
        </span>
      ) : (
        <button
          onClick={() => void connectGoogle()}
          className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm transition hover:border-mint-300 hover:text-mint-700 sm:px-4"
        >
          <LogIn size={15} />
          <span className="hidden sm:inline">구글 계정 연동</span>
        </button>
      )}
    </header>
  );
}
