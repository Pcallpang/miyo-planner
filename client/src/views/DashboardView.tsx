import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { format } from 'date-fns';
import { useApp } from '../context/AppContext';
import { useData } from '../context/DataContext';
import { reconcileMeetings } from '../lib/meetingSync';
import { getHoliday } from '../lib/holidays';
import MonthCalendar from '../components/MonthCalendar';
import LiveStatusCard from '../components/dashboard/LiveStatusCard';
import MeetingsCard from '../components/dashboard/MeetingsCard';
import TodoCard from '../components/dashboard/TodoCard';
import WeeklySummary from '../components/dashboard/WeeklySummary';
import TodoModal from '../components/TodoModal';
import MeetingModal from '../components/MeetingModal';
import DateActionModal from '../components/DateActionModal';
import type { Meeting, Todo, TodoCategory } from '../types';

export default function DashboardView() {
  const { events, eventsRange, settings, ensureEvents, showToast } = useApp();
  const { data, update } = useData();
  const todos = data.todos;
  const meetings = data.meetings;
  const setTodos: Dispatch<SetStateAction<Todo[]>> = (next) =>
    update((prev) => ({ todos: typeof next === 'function' ? next(prev.todos) : next }));
  const setMeetings: Dispatch<SetStateAction<Meeting[]>> = (next) =>
    update((prev) => ({ meetings: typeof next === 'function' ? next(prev.meetings) : next }));

  const [month, setMonth] = useState(() => new Date());
  const [selected, setSelected] = useState(() => new Date());
  const [dateAction, setDateAction] = useState<Date | null>(null);
  const [todoModal, setTodoModal] = useState<{ category: TodoCategory; date?: string } | null>(null);
  const [meetingModal, setMeetingModal] = useState<{ editing?: Meeting; date?: string } | null>(null);

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

  function selectDate(day: Date) {
    setSelected(day);
    setDateAction(day);
  }

  function toggleHoliday(day: Date) {
    const key = format(day, 'yyyy-MM-dd');
    update((prev) => {
      const h = { ...(prev.holidays ?? {}) };
      if (h[key]) {
        delete h[key];
        showToast('info', '휴일 지정을 해제했습니다.');
      } else {
        h[key] = '재량휴업일';
        showToast('success', '휴일로 지정했습니다.');
      }
      return { holidays: h };
    });
    setDateAction(null);
  }

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
            onSelect={selectDate}
            events={events}
            weekStartsOn={settings.weekStartsOn}
            holidays={data.holidays}
          />
        </section>
      </div>

      <div className="space-y-6">
        <LiveStatusCard />
        <TodoCard todos={todos} setTodos={setTodos} onAdd={(category) => setTodoModal({ category })} />
        <MeetingsCard
          meetings={meetings}
          setMeetings={setMeetings}
          onAdd={() => setMeetingModal({})}
          onEdit={(m) => setMeetingModal({ editing: m })}
        />
      </div>

      {/* 날짜 클릭 팝업 */}
      {dateAction && (
        <DateActionModal
          date={dateAction}
          holidayLabel={getHoliday(format(dateAction, 'yyyy-MM-dd'), data.holidays)}
          onClose={() => setDateAction(null)}
          onAddTodo={() => {
            setTodoModal({ category: '업무', date: format(dateAction, 'yyyy-MM-dd') });
            setDateAction(null);
          }}
          onAddMeeting={() => {
            setMeetingModal({ date: format(dateAction, 'yyyy-MM-dd') });
            setDateAction(null);
          }}
          onToggleHoliday={() => toggleHoliday(dateAction)}
        />
      )}

      {/* 새 할 일 추가 모달 */}
      {todoModal && (
        <TodoModal
          defaultCategory={todoModal.category}
          defaultDate={todoModal.date}
          onClose={() => setTodoModal(null)}
          onSave={(todo) => setTodos((prev) => [...prev, todo])}
        />
      )}

      {/* 새 회의 추가/수정 모달 */}
      {meetingModal && (
        <MeetingModal
          editing={meetingModal.editing}
          defaultDate={meetingModal.date}
          onClose={() => setMeetingModal(null)}
          onCommit={(meeting, isNew) =>
            setMeetings((prev) =>
              isNew ? [...prev, meeting] : prev.map((m) => (m.id === meeting.id ? meeting : m)),
            )
          }
        />
      )}
    </div>
  );
}
