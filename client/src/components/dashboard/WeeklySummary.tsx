import { endOfWeek, format, isWithinInterval, parseISO, startOfWeek } from 'date-fns';
import { CalendarRange } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { eventTimeLabel } from '../../lib/events';
import type { Meeting, Todo } from '../../types';

interface Props {
  todos: Todo[];
  meetings: Meeting[];
}

export default function WeeklySummary({ todos, meetings }: Props) {
  const { events, settings, status } = useApp();
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: settings.weekStartsOn });
  const weekEnd = endOfWeek(now, { weekStartsOn: settings.weekStartsOn });
  const inWeek = (dateStr: string) => {
    try {
      return isWithinInterval(parseISO(dateStr), { start: weekStart, end: weekEnd });
    } catch {
      return false;
    }
  };

  const weekTodos = todos.filter((t) => t.dueDate && inWeek(t.dueDate));
  const weekMeetings = meetings
    .filter((m) => inWeek(m.date))
    .sort((a, b) => (a.date + (a.time ?? '')).localeCompare(b.date + (b.time ?? '')));
  const weekEvents = events
    .filter((ev) => inWeek(ev.start))
    .sort((a, b) => a.start.localeCompare(b.start));

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-800">
        <CalendarRange size={18} className="text-mint-500" />
        주간 요약 ({format(weekStart, 'MM/dd')} ~ {format(weekEnd, 'MM/dd')})
      </h2>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <div>
          <p className="mb-2 text-sm font-semibold text-mint-600">To-Do 마감</p>
          {weekTodos.length === 0 ? (
            <p className="text-sm text-slate-400">이번 주 마감 항목이 없습니다.</p>
          ) : (
            <ul className="space-y-1">
              {weekTodos.slice(0, 5).map((t) => (
                <li key={t.id} className="flex items-start gap-1.5 text-sm">
                  <span className="mt-0.5 shrink-0 text-xs font-medium text-slate-400">
                    {t.dueDate!.slice(5).replace('-', '/')}
                  </span>
                  <span
                    className={`line-clamp-2 min-w-0 break-words ${
                      t.done ? 'text-slate-300 line-through' : 'text-slate-600'
                    }`}
                  >
                    {t.text}
                  </span>
                </li>
              ))}
              {weekTodos.length > 5 && (
                <li className="text-xs text-slate-400">외 {weekTodos.length - 5}건</li>
              )}
            </ul>
          )}
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-amber-500">회의록 &amp; 일정</p>
          {weekMeetings.length === 0 ? (
            <p className="text-sm text-slate-400">이번 주 일정이 없습니다.</p>
          ) : (
            <ul className="space-y-1">
              {weekMeetings.slice(0, 5).map((m) => (
                <li key={m.id} className="flex items-start gap-1.5 text-sm">
                  <span className="mt-0.5 shrink-0 text-xs font-medium text-slate-400">
                    {m.date.slice(5).replace('-', '/')}
                    {m.time && ` ${m.time}`}
                  </span>
                  <span className="line-clamp-2 min-w-0 break-words text-slate-600">{m.title}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-sky-500">구글 캘린더</p>
          {!status?.connected ? (
            <p className="text-sm text-slate-400">구글 계정을 연동하면 일정이 표시됩니다.</p>
          ) : weekEvents.length === 0 ? (
            <p className="text-sm text-slate-400">이번 주 일정이 없습니다.</p>
          ) : (
            <ul className="space-y-1">
              {weekEvents.slice(0, 5).map((ev) => (
                <li key={ev.id} className="flex items-start gap-1.5 text-sm">
                  <span className="mt-0.5 shrink-0 text-xs font-medium text-slate-400">
                    {format(parseISO(ev.start), 'MM/dd')} {eventTimeLabel(ev)}
                  </span>
                  <span className="line-clamp-2 min-w-0 break-words text-slate-600">{ev.title}</span>
                </li>
              ))}
              {weekEvents.length > 5 && (
                <li className="text-xs text-slate-400">외 {weekEvents.length - 5}건</li>
              )}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
