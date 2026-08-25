import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { format } from 'date-fns';
import { CalendarRange, Filter, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useData } from '../context/DataContext';
import { api } from '../lib/api';
import { reconcileMeetings } from '../lib/meetingSync';
import { eventsOnDay, filterEventsByKeywords } from '../lib/events';
import { getHoliday } from '../lib/holidays';
import { useSchoolSchedule } from '../hooks/useSchoolSchedule';
import MonthCalendar from '../components/MonthCalendar';
import EventModal from '../components/EventModal';
import LiveStatusCard from '../components/dashboard/LiveStatusCard';
import MeetingsCard from '../components/dashboard/MeetingsCard';
import OvertimeCard from '../components/dashboard/OvertimeCard';
import TodoCard from '../components/dashboard/TodoCard';
import WeeklySummary from '../components/dashboard/WeeklySummary';
import TodoModal from '../components/TodoModal';
import MeetingModal from '../components/MeetingModal';
import OvertimeModal from '../components/OvertimeModal';
import DateActionModal from '../components/DateActionModal';
import type { GEvent, Meeting, OvertimeLog, Todo, TodoCategory } from '../types';

export default function DashboardView() {
  const { events, eventsRange, settings, setSettings, status, ensureEvents, refreshEvents, showToast } =
    useApp();
  const { data, update } = useData();
  const todos = data.todos;
  const meetings = data.meetings;
  const setTodos: Dispatch<SetStateAction<Todo[]>> = (next) =>
    update((prev) => ({ todos: typeof next === 'function' ? next(prev.todos) : next }));
  const setMeetings: Dispatch<SetStateAction<Meeting[]>> = (next) =>
    update((prev) => ({ meetings: typeof next === 'function' ? next(prev.meetings) : next }));
  const overtimeLogs = data.overtimeLogs;
  const setOvertimeLogs: Dispatch<SetStateAction<OvertimeLog[]>> = (next) =>
    update((prev) => ({ overtimeLogs: typeof next === 'function' ? next(prev.overtimeLogs) : next }));

  const [month, setMonth] = useState(() => new Date());
  const [selected, setSelected] = useState(() => new Date());
  const [dateAction, setDateAction] = useState<Date | null>(null);
  const [todoModal, setTodoModal] = useState<{ category: TodoCategory; date?: string; editing?: Todo } | null>(null);
  const [meetingModal, setMeetingModal] = useState<{ editing?: Meeting; date?: string } | null>(null);
  const [overtimeModal, setOvertimeModal] = useState<{ editing?: OvertimeLog } | null>(null);
  const [eventModal, setEventModal] = useState<
    { mode: 'new'; date: string } | { mode: 'edit'; event: GEvent } | null
  >(null);
  /** 키워드 필터 On/Off. 저장하지 않아 접속 때마다 꺼진 상태로 시작한다. */
  const [keywordFilterOn, setKeywordFilterOn] = useState(false);
  const [keywordInput, setKeywordInput] = useState('');

  const keywords = settings.eventKeywords;
  const visibleEvents = keywordFilterOn ? filterEventsByKeywords(events, keywords) : events;
  const hiddenCount = events.length - visibleEvents.length;

  function addKeyword() {
    const k = keywordInput.trim();
    if (!k || keywords.includes(k)) {
      setKeywordInput('');
      return;
    }
    setSettings((prev) => ({ ...prev, eventKeywords: [...prev.eventKeywords, k] }));
    setKeywordInput('');
  }

  function removeKeyword(k: string) {
    setSettings((prev) => ({ ...prev, eventKeywords: prev.eventKeywords.filter((x) => x !== k) }));
  }

  useEffect(() => {
    void ensureEvents(month);
  }, [month, ensureEvents]);

  const { schedule: schoolSchedule, error: scheduleError } = useSchoolSchedule(
    settings.school,
    month,
    settings.showSchoolSchedule,
    settings.weekStartsOn,
  );

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

  // 날짜가 지난 회의록&일정은 자동으로 목록에서 정리한다(연동된 구글 캘린더 일정 자체는 건드리지 않는다)
  useEffect(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const pastCount = meetings.filter((m) => m.date < today).length;
    if (pastCount === 0) return;
    setMeetings((prev) => prev.filter((m) => m.date >= today));
    showToast('info', `지난 회의록 ${pastCount}건을 정리했습니다.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetings]);

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

  /** 구글 캘린더 일정 삭제 */
  async function deleteEvent(ev: GEvent) {
    if (!window.confirm(`'${ev.title}' 일정을 구글 캘린더에서 삭제할까요?`)) return;
    try {
      await api.deleteEvent(ev.id, ev.calendarId);
      await refreshEvents();
      showToast('success', '일정이 삭제되었습니다.');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : '삭제에 실패했습니다.');
    }
  }

  /** 회의록&일정 삭제 (구글 연동돼 있으면 캘린더 일정도 함께) */
  async function deleteMeeting(m: Meeting) {
    if (!window.confirm(`'${m.title}'을(를) 삭제할까요?`)) return;
    if (m.googleEventId && status?.connected) {
      try {
        await api.deleteEvent(m.googleEventId, settings.calendarId);
        await refreshEvents();
      } catch {
        showToast('error', '구글 캘린더 일정 삭제에는 실패했습니다. 캘린더에서 직접 확인해 주세요.');
      }
    }
    setMeetings((prev) => prev.filter((x) => x.id !== m.id));
  }

  function deleteTodo(todo: Todo) {
    if (!window.confirm(`'${todo.text}'을(를) 삭제할까요?`)) return;
    setTodos((prev) => prev.filter((t) => t.id !== todo.id));
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-6">
        <WeeklySummary todos={todos} meetings={meetings} />

        <section className="hidden rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100 lg:block">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-slate-800">캘린더</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setKeywordFilterOn((v) => !v)}
                aria-pressed={keywordFilterOn}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${
                  keywordFilterOn
                    ? 'border-mint-300 bg-mint-50 text-mint-700'
                    : 'border-slate-200 text-slate-500 hover:border-mint-200 hover:text-mint-600'
                }`}
              >
                <Filter size={12} />
                키워드
                {keywords.length > 0 && (
                  <span className="rounded-full bg-mint-500 px-1.5 text-[10px] font-semibold text-white">
                    {keywords.length}
                  </span>
                )}
              </button>
            {settings.school && (
              <button
                onClick={() =>
                  setSettings((prev) => ({ ...prev, showSchoolSchedule: !prev.showSchoolSchedule }))
                }
                aria-pressed={settings.showSchoolSchedule}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${
                  settings.showSchoolSchedule
                    ? 'border-amber-300 bg-amber-50 text-amber-700'
                    : 'border-slate-200 text-slate-500 hover:border-amber-200 hover:text-amber-600'
                }`}
              >
                <CalendarRange size={12} />
                학사일정 겹쳐보기
              </button>
            )}
            </div>
          </div>

          {keywordFilterOn && (
            <div className="mb-4 rounded-xl bg-slate-50 px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-1.5">
                {keywords.map((k) => (
                  <span
                    key={k}
                    className="flex items-center gap-1 rounded-full bg-mint-100 py-1 pl-2.5 pr-1.5 text-xs font-medium text-mint-700"
                  >
                    {k}
                    <button onClick={() => removeKeyword(k)} aria-label={`${k} 삭제`} className="rounded-full p-0.5 hover:bg-mint-200">
                      <X size={11} />
                    </button>
                  </span>
                ))}
                <input
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addKeyword();
                    }
                  }}
                  onBlur={addKeyword}
                  placeholder={keywords.length ? '키워드 추가' : '예: 상담'}
                  className="min-w-[7rem] flex-1 bg-transparent px-1 py-1 text-xs text-slate-700 outline-none placeholder:text-slate-400"
                />
              </div>
              {/* 키워드를 걸어둔 걸 잊고 '일정이 왜 없지' 하고 헤매지 않도록 알린다. */}
              <p className="mt-1.5 text-[11px] text-slate-400">
                {keywords.length === 0
                  ? '키워드를 입력하고 Enter를 누르면 제목에 그 말이 든 일정만 보입니다.'
                  : `제목에 키워드가 든 일정만 표시 중 · ${hiddenCount}개 숨김`}
              </p>
            </div>
          )}
          {/* 학사일정은 부가 정보라 토스트로 막지 않고, 왜 비었는지만 조용히 알린다 */}
          {scheduleError && (
            <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
              학사일정을 불러오지 못했습니다 — {scheduleError}
            </p>
          )}
          <MonthCalendar
            month={month}
            onMonthChange={setMonth}
            selected={selected}
            onSelect={selectDate}
            events={visibleEvents}
            weekStartsOn={settings.weekStartsOn}
            holidays={data.holidays}
            schoolSchedule={schoolSchedule}
          />
        </section>
      </div>

      <div className="min-w-0 space-y-6">
        <LiveStatusCard />
        <TodoCard
          todos={todos}
          setTodos={setTodos}
          onAdd={(category) => setTodoModal({ category })}
          onEdit={(todo) => setTodoModal({ category: todo.category, editing: todo })}
        />
        <MeetingsCard
          meetings={meetings}
          setMeetings={setMeetings}
          onAdd={() => setMeetingModal({})}
          onEdit={(m) => setMeetingModal({ editing: m })}
        />
        {/* lg 미만에서는 하단 탭바의 전용 화면(OvertimeView)으로 들어가므로 여기선 숨긴다. */}
        <div className="hidden lg:block">
          <OvertimeCard
            logs={overtimeLogs}
            setLogs={setOvertimeLogs}
            onAdd={() => setOvertimeModal({})}
            onEdit={(log) => setOvertimeModal({ editing: log })}
          />
        </div>
      </div>

      {/* 날짜 클릭 팝업 */}
      {dateAction && (
        <DateActionModal
          date={dateAction}
          holidayLabel={getHoliday(format(dateAction, 'yyyy-MM-dd'), data.holidays)}
          events={eventsOnDay(visibleEvents, dateAction)}
          todos={todos.filter((t) => t.dueDate === format(dateAction, 'yyyy-MM-dd'))}
          meetings={meetings.filter((m) => m.date === format(dateAction, 'yyyy-MM-dd'))}
          schoolSchedule={schoolSchedule.filter((s) => s.date === format(dateAction, 'yyyy-MM-dd'))}
          connected={Boolean(status?.connected)}
          onAddEvent={() => {
            setEventModal({ mode: 'new', date: format(dateAction, 'yyyy-MM-dd') });
            setDateAction(null);
          }}
          onEditEvent={(ev) => {
            setEventModal({ mode: 'edit', event: ev });
            setDateAction(null);
          }}
          onDeleteEvent={(ev) => void deleteEvent(ev)}
          onEditTodo={(todo) => {
            setTodoModal({ category: todo.category, editing: todo });
            setDateAction(null);
          }}
          onDeleteTodo={deleteTodo}
          onEditMeeting={(m) => {
            setMeetingModal({ editing: m });
            setDateAction(null);
          }}
          onDeleteMeeting={(m) => void deleteMeeting(m)}
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

      {/* 새 할 일 추가/수정 모달 */}
      {todoModal && (
        <TodoModal
          editing={todoModal.editing}
          defaultCategory={todoModal.category}
          defaultDate={todoModal.date}
          onClose={() => setTodoModal(null)}
          onSave={(todo) =>
            setTodos((prev) =>
              todoModal.editing ? prev.map((t) => (t.id === todo.id ? todo : t)) : [...prev, todo],
            )
          }
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

      {/* 초과근무 직접 입력/수정 모달 */}
      {overtimeModal && (
        <OvertimeModal
          editing={overtimeModal.editing}
          onClose={() => setOvertimeModal(null)}
          onSave={(log) =>
            setOvertimeLogs((prev) =>
              overtimeModal.editing ? prev.map((l) => (l.id === log.id ? log : l)) : [...prev, log],
            )
          }
        />
      )}

      {/* 구글 캘린더 일정 추가/수정 모달 */}
      {eventModal && (
        <EventModal
          event={eventModal.mode === 'edit' ? eventModal.event : undefined}
          defaultDate={eventModal.mode === 'new' ? eventModal.date : undefined}
          onClose={() => setEventModal(null)}
          onSaved={() => setEventModal(null)}
        />
      )}
    </div>
  );
}
