import { X } from 'lucide-react';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface Props {
  aLabel: string; // 예: "8/18(화) 2교시 · 수학 1-3"
  bLabel: string; // 예: "8/20(목) 3교시 · (빈 시간)"
  onCancel: () => void;
  onApplyAll: () => void;
  onApplyOnce: () => void;
}

/** 시간표 칸을 드래그로 옮겼을 때, 반복 시간표 전체(모든 주)에 반영할지 이 날짜만
 *  반영할지 매번 물어보는 확인창. 다른 선생님 수업과 바꾸느라 빈 칸으로 옮기는
 *  경우가 많아 "교환"뿐 아니라 "이동"도 자연스럽게 보이도록 문구를 잡는다. */
export default function SwapConfirmModal({ aLabel, bLabel, onCancel, onApplyAll, onApplyOnce }: Props) {
  useEscapeKey(onCancel);

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-slate-900/30 p-4" onClick={onCancel}>
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-800">수업 교환/이동</h2>
          <button onClick={onCancel} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" aria-label="닫기">
            <X size={18} />
          </button>
        </div>

        <div className="mb-4 space-y-1 rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
          <p>{aLabel}</p>
          <p className="text-slate-400">⇅</p>
          <p>{bLabel}</p>
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={onApplyOnce}
            className="w-full rounded-xl bg-mint-500 py-2.5 text-sm font-semibold text-white transition hover:bg-mint-600"
          >
            이 날짜만 교환
          </button>
          <button
            type="button"
            onClick={onApplyAll}
            className="w-full rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            전체 시간표(매주 반복)에 반영
          </button>
        </div>

        <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-400">
          &quot;이 날짜만 교환&quot;은 지금 보이는 날짜에만 적용되고 다른 주는 그대로 유지돼요. &quot;전체 시간표에
          반영&quot;을 선택하면 반복되는 시간표 자체가 바뀌어 앞으로 모든 주에 똑같이 적용돼요 — 처음 시간표를 짤
          때처럼 계속 반복되어야 할 때만 골라주세요.
        </p>
      </div>
    </div>
  );
}
