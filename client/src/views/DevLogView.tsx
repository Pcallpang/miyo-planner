import { format, parseISO } from 'date-fns';
import { History } from 'lucide-react';
import { DEV_LOG } from '../data/devLog';

/** "미요쌤의 개발 노트" — 최근 업데이트 이력을 보여주는 읽기 전용 화면. */
export default function DevLogView() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5">
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800">
          <History size={18} className="text-mint-500" />
          미요쌤의 개발 노트
        </h2>
        <p className="mt-0.5 text-xs text-slate-400">최근에 어떤 게 새로 생기고 바뀌었는지 여기서 확인할 수 있어요.</p>
      </div>

      <ul className="space-y-2">
        {DEV_LOG.map((entry, i) => (
          <li
            key={`${entry.date}-${i}`}
            className="flex items-start gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100"
          >
            <span className="mt-0.5 shrink-0 rounded-lg bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-400">
              {format(parseISO(entry.date), 'MM/dd')}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-700">{entry.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{entry.desc}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
