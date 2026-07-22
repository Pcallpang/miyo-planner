import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { LogIn } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getDayPhase } from '../lib/schedule';

function phaseLabel(now: Date, periodTimes: { start: string; end: string }[], count: number) {
  const phase = getDayPhase(now, periodTimes, count);
  switch (phase.kind) {
    case 'weekend':
      return '주말';
    case 'before':
      return '일과 전';
    case 'period':
      return `${phase.index + 1}교시`;
    case 'break':
      return '쉬는 시간';
    case 'after':
      return '일과 후';
  }
}

export default function Header() {
  const { status, connectGoogle, settings } = useApp();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200/70 bg-white/80 px-6 py-3.5 backdrop-blur lg:px-8">
      <div className="flex items-baseline gap-3">
        <span className="text-base font-semibold text-slate-700">
          {format(now, 'M월 d일 (EEE)', { locale: ko })}
        </span>
        <span className="text-xl font-bold tabular-nums text-mint-600">
          {format(now, 'HH:mm:ss')}
        </span>
        <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-semibold text-sky-600">
          {phaseLabel(now, settings.periodTimes, settings.periodCount)}
        </span>
      </div>

      {status?.connected ? (
        <span className="flex items-center gap-2 rounded-full border border-mint-200 bg-mint-50 px-3.5 py-1.5 text-xs font-medium text-mint-700">
          <span className="h-2 w-2 rounded-full bg-mint-500" />
          {status.email ?? '구글 계정 연동됨'}
        </span>
      ) : (
        <button
          onClick={() => void connectGoogle()}
          className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-medium text-slate-600 shadow-sm transition hover:border-mint-300 hover:text-mint-700"
        >
          <LogIn size={15} />
          구글 계정 연동
        </button>
      )}
    </header>
  );
}
