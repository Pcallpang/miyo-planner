import { X } from 'lucide-react';
import { useEscapeKey } from '../hooks/useEscapeKey';

/** 새 공지를 추가할 때마다 이 값을 올린다 — 이전 값을 본 사용자에게는 다시 뜬다. */
export const WHATS_NEW_VERSION = '2026-09-07-color-theme';

const ITEMS = [
  {
    title: '추가 — 색상 테마 고르기',
    desc: '환경 설정에 "색상 테마" 항목이 생겼어요. 민트·블루·퍼플·핑크·오렌지·노랑 중 마음에 드는 색을 고르면 앱 전체 강조 색과 모바일 브라우저 주소창 색까지 바로 바뀌고, 다음에 다시 들어와도 그대로 유지돼요.',
  },
];

const UPCOMING: { title: string; desc: string }[] = [];

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

        {UPCOMING.length > 0 && (
          <div className="mt-4 rounded-xl border border-dashed border-slate-200 p-3">
            <p className="mb-2 text-xs font-semibold text-slate-400">🔜 업데이트 예정</p>
            <ul className="space-y-2">
              {UPCOMING.map((item) => (
                <li key={item.title}>
                  <p className="text-sm font-medium text-slate-600">{item.title}</p>
                  <p className="mt-0.5 text-xs text-slate-400">{item.desc}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

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
