import { useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { SUBJECT_COLORS, classColorKey } from '../../lib/subjectColors';
import type { PeriodTime } from '../../types';

interface Props {
  dayLabel: string; // 예: '화요일'
  dateLabel: string; // 예: '8/18'
  period: number; // 1-based
  time: PeriodTime;
  subject: string;
  room: string;
  swapped: boolean; // 이 칸이 지금 다른 칸과 교환되어 있는지(이 날짜만)
  subjectColors: Record<string, number>; // "과목::반" -> 수동 지정한 색상 인덱스
  onClose: () => void;
  onSave: (subject: string, room: string) => void;
  onRevertSwap: () => void;
  onSetColor: (colorKey: string, colorIndex: number) => void;
  onApplyColorToSubject: (subject: string, colorIndex: number) => void;
}

export default function TimetableCellModal({
  dayLabel,
  dateLabel,
  period,
  time,
  subject,
  room,
  swapped,
  subjectColors,
  onClose,
  onSave,
  onRevertSwap,
  onSetColor,
  onApplyColorToSubject,
}: Props) {
  const [subjectInput, setSubjectInput] = useState(subject);
  const [roomInput, setRoomInput] = useState(room);
  useEscapeKey(onClose);

  const currentColorIndex = subjectColors[classColorKey(subjectInput, roomInput)];

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

          {subjectInput.trim() && (
            <div>
              <span className={labelCls}>색상</span>
              <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-slate-100 p-2">
                {SUBJECT_COLORS.map((c, idx) => (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => onSetColor(classColorKey(subjectInput, roomInput), idx)}
                    className={`h-6 w-6 rounded-full ${c.dot} ${
                      currentColorIndex === idx ? 'ring-2 ring-offset-1 ring-slate-400' : ''
                    }`}
                    aria-label={c.name}
                    title={c.name}
                  />
                ))}
                <button
                  type="button"
                  disabled={currentColorIndex === undefined}
                  onClick={() => currentColorIndex !== undefined && onApplyColorToSubject(subjectInput.trim(), currentColorIndex)}
                  title="색을 먼저 고른 뒤 누르면 같은 과목의 다른 반에도 적용돼요"
                  className="ml-1 shrink-0 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  전체 적용
                </button>
              </div>
              <p className="mt-1.5 text-[10px] text-slate-400">
                색을 먼저 고른 뒤 &quot;전체 적용&quot;을 누르면 반 상관없이 같은 과목 전체에 적용돼요.
              </p>
            </div>
          )}

          <button
            type="submit"
            className="w-full rounded-xl bg-mint-500 py-2.5 text-sm font-semibold text-white transition hover:bg-mint-600"
          >
            저장
          </button>
        </form>

        {swapped && (
          <button
            type="button"
            onClick={() => onRevertSwap()}
            className="mt-2 w-full rounded-xl border border-sky-200 py-2 text-sm font-medium text-sky-600 transition hover:bg-sky-50"
          >
            교환 취소 (원래대로)
          </button>
        )}
      </div>
    </div>
  );
}
