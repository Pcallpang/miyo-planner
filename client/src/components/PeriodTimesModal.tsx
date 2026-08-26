import { X } from 'lucide-react';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useApp } from '../context/AppContext';

interface Props {
  onClose: () => void;
}

/** 교시별 시작~종료 시각을 편집하는 가운데 모달. 환경 설정의 "교시 수" 아래에서 연다. */
export default function PeriodTimesModal({ onClose }: Props) {
  const { settings, setSettings } = useApp();
  useEscapeKey(onClose);

  function updateTime(index: number, field: 'start' | 'end', value: string) {
    setSettings((prev) => {
      const times = [...prev.periodTimes];
      if (times[index]) times[index] = { ...times[index], [field]: value };
      return { ...prev, periodTimes: times };
    });
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-slate-900/30 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-800">일과 시간</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" aria-label="닫기">
            <X size={18} />
          </button>
        </div>

        <ul className="space-y-2">
          {Array.from({ length: settings.periodCount }, (_, i) => {
            const time = settings.periodTimes[i] ?? { start: '', end: '' };
            return (
              <li key={i} className="flex items-center gap-2">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-slate-100 text-xs font-bold text-slate-500">
                  {i + 1}
                </span>
                <input
                  type="time"
                  value={time.start}
                  onChange={(e) => updateTime(i, 'start', e.target.value)}
                  className="w-full min-w-0 rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-mint-400"
                />
                <span className="shrink-0 text-slate-300">~</span>
                <input
                  type="time"
                  value={time.end}
                  onChange={(e) => updateTime(i, 'end', e.target.value)}
                  className="w-full min-w-0 rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-mint-400"
                />
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-[11px] text-slate-400">입력하면 자동 저장됩니다.</p>
      </div>
    </div>
  );
}
