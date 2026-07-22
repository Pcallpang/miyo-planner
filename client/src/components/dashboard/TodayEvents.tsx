import { CalendarDays } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { eventsOnDay, eventTimeLabel } from '../../lib/events';

/** 오늘 구글 캘린더에 등록된 일정을 데일리 To-Do 상단에 표시(읽기 전용). */
export default function TodayEvents() {
  const { events, status } = useApp();
  if (!status?.connected) return null;
  const today = eventsOnDay(events, new Date());
  if (today.length === 0) return null;

  return (
    <div className="mb-3 rounded-xl bg-sky-50 p-3">
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-sky-600">
        <CalendarDays size={13} /> 오늘 일정 (캘린더)
      </p>
      <ul className="space-y-1">
        {today.map((ev) => (
          <li key={ev.id} className="flex items-center gap-2 text-sm">
            <span className="w-20 shrink-0 text-xs font-medium text-sky-500">{eventTimeLabel(ev)}</span>
            <span className="min-w-0 flex-1 truncate text-slate-700">{ev.title}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
