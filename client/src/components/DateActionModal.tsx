import { CalendarDays, CalendarOff, FileText, ListChecks, Plus, Trash2, X } from 'lucide-react';
import { format } from 'date-fns';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { eventTimeLabel } from '../lib/events';
import type { GEvent, Meeting, Todo } from '../types';

interface Props {
  date: Date;
  /** 이미 휴일로 지정돼 있으면 라벨, 아니면 null */
  holidayLabel: string | null;
  /** 이 날의 구글 캘린더 일정 */
  events: GEvent[];
  /** 이 날이 마감일인 할 일 */
  todos: Todo[];
  /** 이 날의 회의록&일정 */
  meetings: Meeting[];
  /** 구글 계정 연동 여부 — 미연동이면 캘린더 일정 추가 불가 */
  connected: boolean;
  onClose: () => void;
  onAddEvent: () => void;
  onAddTodo: () => void;
  onAddMeeting: () => void;
  onToggleHoliday: () => void;
  onEditEvent: (ev: GEvent) => void;
  onDeleteEvent: (ev: GEvent) => void;
  onEditTodo: (todo: Todo) => void;
  onDeleteTodo: (todo: Todo) => void;
  onEditMeeting: (meeting: Meeting) => void;
  onDeleteMeeting: (meeting: Meeting) => void;
}

const TYPE_STYLE = {
  event: 'text-mint-500',
  todo: 'text-emerald-500',
  meeting: 'text-amber-500',
} as const;

interface RowProps {
  icon: keyof typeof TYPE_STYLE;
  title: string;
  subtitle?: string;
  onEdit: () => void;
  onDelete: () => void;
}

function Row({ icon, title, subtitle, onEdit, onDelete }: RowProps) {
  const Icon = icon === 'todo' ? ListChecks : icon === 'meeting' ? FileText : CalendarDays;
  return (
    <li className="group flex items-center gap-2 rounded-xl px-2 py-1.5 transition hover:bg-slate-50">
      <Icon size={14} className={`shrink-0 ${TYPE_STYLE[icon]}`} />
      <button
        type="button"
        onClick={onEdit}
        className="min-w-0 flex-1 text-left"
        aria-label={`${title} 수정`}
      >
        <span className="block truncate text-sm text-slate-700">{title}</span>
        {subtitle && <span className="block truncate text-[11px] text-slate-400">{subtitle}</span>}
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="shrink-0 rounded p-1 text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-rose-400"
        aria-label={`${title} 삭제`}
      >
        <Trash2 size={14} />
      </button>
    </li>
  );
}

export default function DateActionModal({
  date,
  holidayLabel,
  events,
  todos,
  meetings,
  connected,
  onClose,
  onAddEvent,
  onAddTodo,
  onAddMeeting,
  onToggleHoliday,
  onEditEvent,
  onDeleteEvent,
  onEditTodo,
  onDeleteTodo,
  onEditMeeting,
  onDeleteMeeting,
}: Props) {
  useEscapeKey(onClose);
  const btn =
    'flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-mint-300 hover:bg-mint-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:bg-transparent';

  const isEmpty = events.length === 0 && todos.length === 0 && meetings.length === 0;

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-slate-900/30 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-800">{format(date, 'yyyy년 MM월 dd일')}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="mb-4">
          <p className="mb-1.5 text-xs font-semibold text-slate-400">이 날의 일정</p>
          {isEmpty ? (
            <p className="px-2 py-2 text-sm text-slate-400">등록된 일정이 없습니다.</p>
          ) : (
            <ul className="max-h-56 space-y-0.5 overflow-y-auto">
              {events.map((ev) => (
                <Row
                  key={`e-${ev.id}`}
                  icon="event"
                  title={ev.title}
                  subtitle={`구글 캘린더 · ${eventTimeLabel(ev)}${ev.location ? ` · ${ev.location}` : ''}`}
                  onEdit={() => onEditEvent(ev)}
                  onDelete={() => onDeleteEvent(ev)}
                />
              ))}
              {meetings.map((m) => (
                <Row
                  key={`m-${m.id}`}
                  icon="meeting"
                  title={m.title}
                  subtitle={`회의록&일정${m.time ? ` · ${m.time}` : ''}`}
                  onEdit={() => onEditMeeting(m)}
                  onDelete={() => onDeleteMeeting(m)}
                />
              ))}
              {todos.map((t) => (
                <Row
                  key={`t-${t.id}`}
                  icon="todo"
                  title={t.text}
                  subtitle={`To-Do · ${t.category}${t.done ? ' · 완료' : ''}`}
                  onEdit={() => onEditTodo(t)}
                  onDelete={() => onDeleteTodo(t)}
                />
              ))}
            </ul>
          )}
        </div>

        <p className="mb-1.5 text-xs font-semibold text-slate-400">추가하기</p>
        <div className="space-y-2.5">
          <button className={btn} onClick={onAddEvent} disabled={!connected}>
            <Plus size={14} className="text-mint-500" /> 구글 캘린더 일정 추가
          </button>
          {!connected && (
            <p className="px-1 text-[11px] text-slate-400">
              구글 계정을 연동하면 캘린더 일정을 추가할 수 있습니다.
            </p>
          )}
          <button className={btn} onClick={onAddTodo}>
            <Plus size={14} className="text-mint-500" /> 데일리 To-Do 추가
          </button>
          <button className={btn} onClick={onAddMeeting}>
            <Plus size={14} className="text-mint-500" /> 회의록&amp;일정 추가
          </button>
          <button className={btn} onClick={onToggleHoliday}>
            <CalendarOff size={16} className={holidayLabel ? 'text-rose-500' : 'text-slate-400'} />
            {holidayLabel ? '휴일 지정 해제' : '이 날을 휴일(재량휴업일 등)로 지정하기'}
          </button>
        </div>
      </div>
    </div>
  );
}
