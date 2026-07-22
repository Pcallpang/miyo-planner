import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { CalendarDays, Plus, RefreshCw } from 'lucide-react';
import EventModal from '../components/EventModal';
import MonthCalendar from '../components/MonthCalendar';
import { useApp } from '../context/AppContext';
import { eventsOnDay, eventTimeLabel } from '../lib/events';
import type { GEvent } from '../types';

export default function MonthlyView() {
  const { events, eventsLoading, settings, status, ensureEvents, refreshEvents, connectGoogle } =
    useApp();
  const [month, setMonth] = useState(() => new Date());
  const [selected, setSelected] = useState(() => new Date());
  const [modal, setModal] = useState<{ mode: 'new' } | { mode: 'edit'; event: GEvent } | null>(null);

  useEffect(() => {
    void ensureEvents(month);
  }, [month, ensureEvents]);

  const connected = Boolean(status?.connected);
  const dayEvents = eventsOnDay(events, selected);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800">
            <CalendarDays size={18} className="text-mint-500" />
            월간 일정
          </h2>
          <button
            onClick={() => void refreshEvents()}
            disabled={!connected || eventsLoading}
            className="flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-500 transition hover:border-mint-300 hover:text-mint-600 disabled:opacity-40"
          >
            <RefreshCw size={12} className={eventsLoading ? 'animate-spin' : ''} />
            새로고침
          </button>
        </div>

        {!connected && (
          <div className="mb-4 flex items-center justify-between rounded-xl bg-amber-50 px-4 py-3">
            <p className="text-sm text-amber-700">
              구글 계정을 연동하면 캘린더 일정을 보고 등록할 수 있습니다.
            </p>
            <button
              onClick={() => void connectGoogle()}
              className="shrink-0 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600"
            >
              연동하기
            </button>
          </div>
        )}

        <MonthCalendar
          month={month}
          onMonthChange={setMonth}
          selected={selected}
          onSelect={setSelected}
          events={events}
          weekStartsOn={settings.weekStartsOn}
        />
      </section>

      <section className="h-fit rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-700">
            {format(selected, 'M월 d일 (EEE)', { locale: ko })}
          </h3>
          <button
            onClick={() => setModal({ mode: 'new' })}
            disabled={!connected}
            className="flex items-center gap-1 rounded-full bg-mint-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-mint-600 disabled:opacity-40"
          >
            <Plus size={13} /> 일정 추가
          </button>
        </div>

        {dayEvents.length === 0 ? (
          <p className="py-4 text-sm text-slate-400">
            {connected ? '일정이 없습니다.' : '연동 후 일정이 표시됩니다.'}
          </p>
        ) : (
          <ul className="space-y-2">
            {dayEvents.map((ev) => (
              <li key={ev.id}>
                <button
                  onClick={() => setModal({ mode: 'edit', event: ev })}
                  className="w-full rounded-xl border border-slate-100 px-3.5 py-2.5 text-left transition hover:border-mint-300 hover:bg-mint-50/50"
                >
                  <p className="text-sm font-medium text-slate-700">{ev.title}</p>
                  <p className="text-xs text-slate-400">
                    {eventTimeLabel(ev)}
                    {ev.location && ` · ${ev.location}`}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {modal && (
        <EventModal
          event={modal.mode === 'edit' ? modal.event : undefined}
          defaultDate={format(selected, 'yyyy-MM-dd')}
          onClose={() => setModal(null)}
          onSaved={() => setModal(null)}
        />
      )}
    </div>
  );
}
