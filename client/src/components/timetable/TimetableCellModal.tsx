import { useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import type { PeriodTime } from '../../types';

interface Props {
  dayLabel: string; // 예: '화요일'
  dateLabel: string; // 예: '8/18'
  period: number; // 1-based
  time: PeriodTime;
  subject: string;
  room: string;
  canceled: boolean; // 이 날짜만 수동으로 휴강 처리됐는지
  autoCanceled: boolean; // 학사일정(공휴일·재량휴업일·지필평가 등)에 따라 자동으로 휴강 처리됐는지
  swapped: boolean; // 이 칸이 지금 다른 칸과 교환되어 있는지(이 날짜만)
  makeupSubject: string; // 이 칸에 등록된 보강 과목(없으면 빈 문자열)
  makeupRoom: string;
  onClose: () => void;
  onSave: (subject: string, room: string) => void;
  onToggleCancel: () => void;
  onRevertSwap: () => void;
  onSaveMakeup: (subject: string, room: string) => void;
}

export default function TimetableCellModal({
  dayLabel,
  dateLabel,
  period,
  time,
  subject,
  room,
  canceled,
  autoCanceled,
  swapped,
  makeupSubject,
  makeupRoom,
  onClose,
  onSave,
  onToggleCancel,
  onRevertSwap,
  onSaveMakeup,
}: Props) {
  const [subjectInput, setSubjectInput] = useState(subject);
  const [roomInput, setRoomInput] = useState(room);
  const [makeupSubjectInput, setMakeupSubjectInput] = useState(makeupSubject);
  const [makeupRoomInput, setMakeupRoomInput] = useState(makeupRoom);
  useEscapeKey(onClose);

  function submit(e: FormEvent) {
    e.preventDefault();
    onSave(subjectInput.trim(), roomInput.trim());
    onClose();
  }

  const inputCls =
    'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-mint-400 focus:ring-2 focus:ring-mint-100';
  const labelCls = 'mb-1.5 block text-sm font-semibold text-slate-700';

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-slate-900/30 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-800">{`${dateLabel}(${dayLabel}) ${period}교시`}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" aria-label="닫기">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-500">
            {time.start || '--:--'} ~ {time.end || '--:--'}
          </p>

          <div>
            <label className={labelCls}>과목</label>
            <input
              className={inputCls}
              placeholder="과목"
              value={subjectInput}
              onChange={(e) => setSubjectInput(e.target.value)}
              autoFocus
            />
          </div>

          <div>
            <label className={labelCls}>반</label>
            <input
              className={inputCls}
              placeholder="예: 1-3"
              value={roomInput}
              onChange={(e) => setRoomInput(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-mint-500 py-2.5 text-sm font-semibold text-white transition hover:bg-mint-600"
          >
            저장
          </button>
        </form>

        {autoCanceled ? (
          <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-center text-xs text-slate-400">
            학사일정에 따라 자동으로 휴강 처리됩니다
          </p>
        ) : (
          <button
            type="button"
            onClick={() => {
              onToggleCancel();
              onClose();
            }}
            className={
              canceled
                ? 'mt-2 w-full rounded-xl border border-mint-300 py-2 text-sm font-medium text-mint-600 transition hover:bg-mint-50'
                : 'mt-2 w-full rounded-xl border border-rose-200 py-2 text-sm font-medium text-rose-500 transition hover:bg-rose-50'
            }
          >
            {canceled ? '휴강 취소' : '이 날짜만 휴강'}
          </button>
        )}

        {swapped && (
          <button
            type="button"
            onClick={() => onRevertSwap()}
            className="mt-2 w-full rounded-xl border border-sky-200 py-2 text-sm font-medium text-sky-600 transition hover:bg-sky-50"
          >
            교환 취소 (원래대로)
          </button>
        )}

        <div className="mt-4 border-t border-slate-100 pt-4">
          <label className={labelCls}>보강</label>
          <p className="mb-2 text-xs text-slate-400">
            원래 수업과 별도로, 이 날짜·교시에만 보강 수업이 있었다는 걸 표시해요. 차시 계획표에는 반영되지
            않아요.
          </p>
          <div className="mb-2 flex gap-2">
            <input
              className={inputCls}
              placeholder="보강 과목"
              value={makeupSubjectInput}
              onChange={(e) => setMakeupSubjectInput(e.target.value)}
            />
            <input
              className={`${inputCls} w-24 shrink-0`}
              placeholder="반"
              value={makeupRoomInput}
              onChange={(e) => setMakeupRoomInput(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onSaveMakeup(makeupSubjectInput.trim(), makeupRoomInput.trim())}
              className="flex-1 rounded-xl border border-violet-300 py-2 text-sm font-medium text-violet-600 transition hover:bg-violet-50"
            >
              보강 저장
            </button>
            {makeupSubject && (
              <button
                type="button"
                onClick={() => onSaveMakeup('', '')}
                className="flex-1 rounded-xl border border-slate-200 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-50"
              >
                보강 삭제
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
