import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useApp } from '../context/AppContext';
import { STORAGE_KEYS, useLocalStorage } from '../lib/storage';
import { eventsOnDay, eventTimeLabel } from '../lib/events';
import { reconcileMeetings } from '../lib/meetingSync';
import MonthCalendar from '../components/MonthCalendar';
import LiveStatusCard from '../components/dashboard/LiveStatusCard';
import MeetingsCard from '../components/dashboard/MeetingsCard';
import TodoCard from '../components/dashboard/TodoCard';
import WeeklySummary from '../components/dashboard/WeeklySummary';
import type { Meeting, Todo } from '../types';

export default function DashboardView() {
  const { events, eventsRange, settings, ensureEvents, showToast } = useApp();
  const [todos, setTodos] = useLocalStorage<Todo[]>(STORAGE_KEYS.todos, []);
  const [meetings, setMeetings] = useLocalStorage<Meeting[]>(STORAGE_KEYS.meetings, []);
  const [month, setMonth] = useState(() => new Date());
  const [selected, setSelected] = useState(() => new Date());

  useEffect(() => {
    void ensureEvents(month);
  }, [month, ensureEvents]);

  // 구글 캘린더 변경(수정·삭제)을 연동된 회의록에 반영
  useEffect(() => {
    if (!eventsRange) return;
    const { meetings: next, changed } = reconcileMeetings(meetings, events, eventsRange);
    if (!changed) return;
    const detached = meetings.filter(
      (m) => m.googleEventId && !next.find((n) => n.id === m.id)?.googleEventId,
    ).length;
    setMeetings(next);
    if (detached > 0) {
      showToast('info', `구글에서 삭제된 일정 ${detached}건의 연동을 해제했습니다.`);
    }
  }, [events, eventsRange, meetings, setMeetings, showToast]);

  const selectedEvents = eventsOnDay(events, selected);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-6">
        <WeeklySummary todos={todos} meetings={meetings} />

        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
          <h2 className="mb-4 text-lg font-bold text-slate-800">캘린더</h2>
          <MonthCalendar
            month={month}
            onMonthChange={setMonth}
            selected={selected}
            onSelect={setSelected}
            events={events}
            weekStartsOn={settings.weekStartsOn}
            compact
          />
          <div className="mt-4 border-t border-slate-100 pt-4">
            <p className="mb-2 text-sm font-semibold text-slate-600">
              {format(selected, 'M월 d일 (EEE)', { locale: ko })} 일정
            </p>
            {selectedEvents.length === 0 ? (
              <p className="text-sm text-slate-400">일정이 없습니다.</p>
            ) : (
              <ul className="space-y-1.5">
                {selectedEvents.map((ev) => (
                  <li key={ev.id} className="flex items-center gap-2 text-sm">
                    <span className="w-24 shrink-0 text-xs font-medium text-mint-600">
                      {eventTimeLabel(ev)}
                    </span>
                    <span className="truncate text-slate-700">{ev.title}</span>
                    {ev.location && <span className="truncate text-xs text-slate-400">@ {ev.location}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      <div className="space-y-6">
        <LiveStatusCard />
        <TodoCard todos={todos} setTodos={setTodos} />
        <MeetingsCard meetings={meetings} setMeetings={setMeetings} />
      </div>
    </div>
  );
}
