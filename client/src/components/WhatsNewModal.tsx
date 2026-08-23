import { X } from 'lucide-react';
import { useEscapeKey } from '../hooks/useEscapeKey';

/** 새 공지를 추가할 때마다 이 값을 올린다 — 이전 값을 본 사용자에게는 다시 뜬다. */
export const WHATS_NEW_VERSION = '2026-08-24';

const ITEMS = [
  {
    title: '사이드바 순서를 내 마음대로',
    desc: '"나의 하루" 메뉴 항목을 드래그해서 순서를 바꿀 수 있어요.',
  },
  {
    title: '오늘의 시간표 새단장',
    desc: '주간 그리드로 바뀌고, 반별 차시 계획표에서 진도와 총 차시를 자동으로 계산해줘요.',
  },
];

interface Props {
  onClose: () => void;
}

/** 로그인 후 한 번만 보여주는 업데이트 소식 팝업. */
export default function WhatsNewModal({ onClose }: Props) {
  useEscapeKey(onClose);

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-slate-900/30 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-800">✨ 업데이트 소식</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" aria-label="닫기">
            <X size={18} />
          </button>
        </div>

        <ul className="space-y-3">
          {ITEMS.map((item) => (
            <li key={item.title}>
              <p className="text-sm font-semibold text-slate-700">{item.title}</p>
              <p className="mt-0.5 text-xs text-slate-500">{item.desc}</p>
            </li>
          ))}
        </ul>

        <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-400">
          화면이 그대로면 새로고침하면 바로 사용할 수 있어요.
        </p>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-xl bg-mint-500 py-2.5 text-sm font-semibold text-white transition hover:bg-mint-600"
        >
          확인
        </button>
      </div>
    </div>
  );
}
