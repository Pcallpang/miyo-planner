import { CalendarOff, FileText, ListChecks, X } from 'lucide-react';
import { format } from 'date-fns';
import { useEscapeKey } from '../hooks/useEscapeKey';

interface Props {
  date: Date;
  /** 이미 휴일로 지정돼 있으면 라벨, 아니면 null */
  holidayLabel: string | null;
  onClose: () => void;
  onAddTodo: () => void;
  onAddMeeting: () => void;
  onToggleHoliday: () => void;
}

export default function DateActionModal({
  date,
  holidayLabel,
  onClose,
  onAddTodo,
  onAddMeeting,
  onToggleHoliday,
}: Props) {
  useEscapeKey(onClose);
  const btn =
    'flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-mint-300 hover:bg-mint-50';

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-slate-900/30 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-800">
            {format(date, 'yyyy년 MM월 dd일')} 일정 추가
          </h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-2.5">
          <button className={btn} onClick={onAddTodo}>
            <ListChecks size={16} className="text-mint-500" /> 데일리 To-Do 추가
          </button>
          <button className={btn} onClick={onAddMeeting}>
            <FileText size={16} className="text-mint-500" /> 회의록&amp;일정 추가
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
