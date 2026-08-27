import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useData } from '../../context/DataContext';
import { getDayPhase } from '../../lib/schedule';

export default function LiveStatusCard() {
  const { settings } = useApp();
  const { data } = useData();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const timetable = data.timetable;
  const phase = getDayPhase(now, settings.periodTimes, settings.periodCount);
  const todaySlots = timetable[now.getDay()] ?? [];

  // 수업이 잡혀 있는 교시면 빡미요, 그 밖(공강·쉬는 시간·일과 전후·주말)이면 무뚝미요
  const inClass = phase.kind === 'period' && Boolean(todaySlots[phase.index]?.subject);

  let title = '';
  let detail = '';
  let nextDetail = '';
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
      const nextIndex = phase.index + 1;
      const nextSlot = todaySlots[nextIndex];
      const nextTime = settings.periodTimes[nextIndex];
      if (nextTime) {
        nextDetail = `다음 ${nextIndex + 1}교시 ${nextSlot?.subject ? `${nextSlot.subject}${nextSlot.room ? ` · ${nextSlot.room}` : ''}` : ''} (${nextTime.start}~)`;
      }
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
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xl font-bold text-mint-700">{title}</p>
          <p className="mt-1 text-sm text-slate-500">{detail}</p>
          {nextDetail && <p className="mt-0.5 text-xs text-slate-400">{nextDetail}</p>}
        </div>
        <img
          src={inClass ? '/ppak-miyo.png' : '/mudduk-miyo.png'}
          alt={inClass ? '수업 중인 미요' : '쉬고 있는 미요'}
          width={64}
          height={64}
          draggable={false}
          className="h-16 w-16 shrink-0 object-contain"
        />
      </div>
    </section>
  );
}
