import { X } from 'lucide-react';
import { useEscapeKey } from '../hooks/useEscapeKey';

/** 새 공지를 추가할 때마다 이 값을 올린다 — 이전 값을 본 사용자에게는 다시 뜬다. */
export const WHATS_NEW_VERSION = '2026-09-17-messenger-alert-real-reader';

const ITEMS = [
  {
    title: '완성 — 메신저 알리미가 이제 실제로 브리티 메신저를 읽어요',
    desc: '스트레칭펫을 설치해두면 브리티의 대화·쪽지·워크스페이스를 실제로 자동 감지해서 이 화면의 "메신저 알리미"에 올려줍니다. 설정 > 바탕화면 위젯에서 스트레칭펫을 바로 받을 수 있어요.',
  },
  {
    title: '개선 — 메신저 알리미 목록을 "등록할 내용 있음 / 확인만 하면 됨"으로 정리',
    desc: '일정·할 일이 없는 메시지도 감지된 건 전부 목록에 남고, 등록할 게 있는 것과 확인만 하면 되는 것을 구역으로 나눴어요. 확인만 하면 되는 항목은 "전체 무시"로 한 번에 정리할 수 있습니다.',
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
