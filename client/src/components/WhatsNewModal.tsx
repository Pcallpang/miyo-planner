import { X } from 'lucide-react';
import { useEscapeKey } from '../hooks/useEscapeKey';

/** 새 공지를 추가할 때마다 이 값을 올린다 — 이전 값을 본 사용자에게는 다시 뜬다. */
export const WHATS_NEW_VERSION = '2026-08-31-3';

const ITEMS = [
  {
    title: '개선 — 완료한 할 일, 3일간 보관',
    desc: '데일리 To-Do에서 체크하면 이제 바로 사라지지 않아요. 카드 오른쪽 위 "완료 항목 보기" 버튼을 누르면 완료한 항목을 다시 볼 수 있고, 체크한 지 3일이 지나면 자동으로 정리돼요. 우선순위 매트릭스의 완료 항목도 똑같이 3일 뒤 자동 정리됩니다.',
  },
  {
    title: '정리 — 역산 템플릿 제거',
    desc: '잘 쓰이지 않던 데일리 To-Do의 "역산 템플릿" 기능을 정리했어요.',
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
