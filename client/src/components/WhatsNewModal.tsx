import { X } from 'lucide-react';
import { useEscapeKey } from '../hooks/useEscapeKey';

/** 새 공지를 추가할 때마다 이 값을 올린다 — 이전 값을 본 사용자에게는 다시 뜬다. */
export const WHATS_NEW_VERSION = '2026-08-31-2';

const ITEMS = [
  {
    title: '새 기능 — 바탕화면 위젯',
    desc: '브라우저를 안 열어도 오늘의 시간표를 바탕화면에 항상 띄워주는 Windows 프로그램이 나왔어요. 헤더의 최소화 버튼을 누르면 지금 상태 한 줄 요약(진행 중 수업 + 다음 시간표)으로 줄일 수 있고, ‹ › 버튼으로 다른 평일 시간표도 미리 볼 수 있어요. 배경 진하기·창 크기 같은 설정은 껐다 켜도 그대로 저장돼요.',
  },
  {
    title: '위젯 설치 방법',
    desc: '환경설정 맨 아래 "설치 파일 다운로드" 버튼을 눌러 받은 뒤 실행하세요. "Windows에서 PC를 보호했습니다" 경고가 뜨면 "추가 정보 → 실행"을 누르면 넘어가요(직접 만든 프로그램이라 안전해요 — 유료 인증서가 없어서 뜨는 안내일 뿐이에요). 뜬 창에서 구글 계정으로 로그인하면 바로 시간표가 보여요.',
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
