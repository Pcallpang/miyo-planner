import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { STORAGE_KEYS, loadFromStorage } from '../../lib/storage';
import { getDayPhase } from '../../lib/schedule';
import type { Timetable } from '../../types';

export default function LiveStatusCard() {
  const { settings } = useApp();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const timetable = loadFromStorage<Timetable>(STORAGE_KEYS.timetable, {});
  const phase = getDayPhase(now, settings.periodTimes, settings.periodCount);
  const todaySlots = timetable[now.getDay()] ?? [];

  let title = '';
  let detail = '';
  switch (phase.kind) {
    case 'weekend':
      title = '주말';
      detail = '편안한 주말 보내세요.';
      break;
    case 'before':
      title = '일과 전';
      detail = `오늘 일과는 ${settings.periodTimes[0]?.start ?? ''}에 시작합니다.`;
      break;
    case 'period': {
      const slot = todaySlots[phase.index];
      title = `${phase.index + 1}교시`;
      detail = slot?.subject
        ? `${slot.subject}${slot.room ? ` · ${slot.room}` : ''} (${settings.periodTimes[phase.index]?.start}~${settings.periodTimes[phase.index]?.end})`
        : `${settings.periodTimes[phase.index]?.start}~${settings.periodTimes[phase.index]?.end}`;
      break;
    }
    case 'break': {
      const next = todaySlots[phase.nextIndex];
      title = '쉬는 시간';
      detail = `다음은 ${phase.nextIndex + 1}교시${next?.subject ? ` ${next.subject}` : ''} (${settings.periodTimes[phase.nextIndex]?.start} 시작)`;
      break;
    }
    case 'after':
      title = '일과 후';
      detail = '수고하셨습니다. 오늘 하루도 고생 많으셨어요.';
      break;
  }

  return (
    <section className="rounded-2xl bg-gradient-to-br from-mint-50 to-sky-50 p-6 shadow-sm ring-1 ring-mint-100">
      <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-slate-700">
        <Clock size={17} className="text-mint-500" />
        실시간 일과
      </h2>
      <p className="text-xl font-bold text-mint-700">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{detail}</p>
    </section>
  );
}
