import { useState, type FormEvent } from 'react';
import SlidePanel from './SlidePanel';
import DateField from './DateField';
import { useApp } from '../context/AppContext';
import type { OvertimeLog, OvertimeSession } from '../types';

const SESSIONS: OvertimeSession[] = ['아침', '저녁'];

interface Props {
  /** 수정 시 기존 기록, 추가 시 undefined */
  editing?: OvertimeLog;
  defaultDate?: string; // YYYY-MM-DD
  onClose: () => void;
  onSave: (log: OvertimeLog) => void;
}

export default function OvertimeModal({ editing, defaultDate, onClose, onSave }: Props) {
  const { showToast } = useApp();
  const [date, setDate] = useState(editing?.date ?? defaultDate ?? '');
  const [session, setSession] = useState<OvertimeSession>(editing?.session ?? '아침');
  const [startTime, setStartTime] = useState(editing?.startTime ?? '');
  const [endTime, setEndTime] = useState(editing?.endTime ?? '');
  const [memo, setMemo] = useState(editing?.memo ?? '');

  function submit(e: FormEvent, close: () => void) {
    e.preventDefault();
    if (!date || !startTime || !endTime) {
      showToast('error', '날짜와 시작·종료 시간을 입력해 주세요.');
      return;
    }
    if (endTime <= startTime) {
      showToast('error', '종료 시간이 시작 시간보다 늦어야 합니다.');
      return;
    }
    const next: OvertimeLog = {
      id: editing?.id ?? crypto.randomUUID(),
      date,
      session,
      startTime,
      endTime,
      memo: memo.trim() || undefined,
      createdAt: editing?.createdAt ?? new Date().toISOString(),
    };
    onSave(next);
    close();
  }

  const inputCls =
    'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-mint-400 focus:ring-2 focus:ring-mint-100';
  const labelCls = 'mb-1.5 block text-sm font-semibold text-slate-700';

  return (
    <SlidePanel title={editing ? '초과근무 기록 수정' : '초과근무 직접 입력'} onClose={onClose}>
      {(close) => (
        <form onSubmit={(e) => submit(e, close)} className="space-y-4">
          <div>
            <span className={labelCls}>구분</span>
            <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
              {SESSIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSession(s)}
                  className={`flex-1 rounded-lg px-2 py-1.5 text-sm font-medium transition ${
                    session === s ? 'bg-white text-mint-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {s} 초근
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelCls}>날짜</label>
            <DateField className={inputCls} value={date} onChange={setDate} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>시작 시간</label>
              <input
                type="time"
                className={inputCls}
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>종료 시간</label>
              <input type="time" className={inputCls} value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>

          <div>
            <label className={labelCls}>메모 (선택)</label>
            <textarea
              className={`${inputCls} min-h-20 resize-y`}
              placeholder="예) 수행평가 채점"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-mint-500 py-2.5 text-sm font-semibold text-white transition hover:bg-mint-600"
          >
            저장
          </button>
        </form>
      )}
    </SlidePanel>
  );
}
