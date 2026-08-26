import { useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useData } from '../context/DataContext';
import DateField from './DateField';
import { ddayDiff, ddayLabel } from '../lib/dday';

interface Props {
  onClose: () => void;
}

/** D-day를 여러 개 등록·삭제하는 팝업. 헤더에는 이 중 가장 가까운 것 하나만 보인다. */
export default function DdayModal({ onClose }: Props) {
  const { data, update } = useData();
  const [label, setLabel] = useState('');
  const [date, setDate] = useState('');
  useEscapeKey(onClose);

  const sorted = [...data.ddays].sort((a, b) => ddayDiff(a.date) - ddayDiff(b.date));

  function addDday(e: FormEvent) {
    e.preventDefault();
    if (!label.trim() || !date) return;
    update((prev) => ({
      ddays: [...prev.ddays, { id: crypto.randomUUID(), label: label.trim(), date }],
    }));
    setLabel('');
    setDate('');
  }

  function removeDday(id: string) {
    update((prev) => ({ ddays: prev.ddays.filter((d) => d.id !== id) }));
  }

  const inputCls =
    'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-mint-400 focus:ring-2 focus:ring-mint-100';

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-slate-900/30 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-800">D-day</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" aria-label="닫기">
            <X size={18} />
          </button>
        </div>

        {sorted.length > 0 && (
          <ul className="mb-4 max-h-56 space-y-1.5 overflow-y-auto">
            {sorted.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="shrink-0 rounded-full bg-mint-100 px-2 py-0.5 text-xs font-bold text-mint-700">
                    {ddayLabel(ddayDiff(d.date))}
                  </span>
                  <span className="truncate text-slate-700">{d.label}</span>
                </div>
                <button
                  type="button"
                  onClick={() => removeDday(d.id)}
                  className="shrink-0 rounded-lg p-1 text-slate-300 transition hover:bg-slate-200 hover:text-slate-500"
                  aria-label={`${d.label} 삭제`}
                >
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={addDday} className="space-y-2 border-t border-slate-100 pt-4">
          <input
            className={inputCls}
            placeholder="이름 (예: 수능, 개학)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            autoFocus
          />
          <DateField className={inputCls} value={date} onChange={setDate} aria-label="목표 날짜" />
          <button
            type="submit"
            disabled={!label.trim() || !date}
            className="w-full rounded-xl bg-mint-500 py-2.5 text-sm font-semibold text-white transition hover:bg-mint-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            추가
          </button>
        </form>
      </div>
    </div>
  );
}
