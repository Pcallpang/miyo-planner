import { X } from 'lucide-react';
import { useEscapeKey } from '../hooks/useEscapeKey';

/** 새 공지를 추가할 때마다 이 값을 올린다 — 이전 값을 본 사용자에게는 다시 뜬다. */
export const WHATS_NEW_VERSION = '2026-08-26-2';

const ITEMS = [
  {
    title: '오늘의 시간표 — 휴강·보강·점심 버튼',
    desc: '시간표 칸을 클릭하면 휴강·보강·점심을 한 줄에서 고를 수 있어요. 휴강·보강은 그 날짜에만 적용되고, 점심은 매주 반복 시간표에 저장돼서 계속 보여요(눈에 띄는 노란색으로 표시).',
  },
  {
    title: '오늘의 시간표 — 교환',
    desc: '시간표 칸을 드래그하면 "이 날짜만 교환"할지 "매주 반복 시간표에 반영"할지 물어봐요. 교환한 칸은 편집창에서 "교환 취소"로 원래대로 되돌릴 수 있어요.',
  },
  {
    title: '차시 계획표 — 과목 색상 직접 고르기',
    desc: '과목 이름 옆 색깔 점을 눌러 원하는 색으로 바꿀 수 있어요. 반마다 다른 색을 줄 수도 있고, "전체 적용"을 켜면 반 상관없이 같은 과목 전체에 한 번에 적용돼요.',
  },
  {
    title: '헤더 D-day',
    desc: '상단 시간 옆에 D-day를 여러 개 등록할 수 있어요. 등록한 만큼 오른쪽으로 나열되고, 늘어나면 가로로 스크롤돼요.',
  },
];

const UPCOMING = [
  {
    title: '초과근무 1시간 제외 계산',
    desc: '9월부터 업데이트 예정이에요.',
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
