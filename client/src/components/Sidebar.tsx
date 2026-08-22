import { useState } from 'react';
import {
  Armchair,
  ClipboardPaste,
  FileSpreadsheet,
  GripVertical,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  NotebookPen,
  School,
  Settings,
  Table,
} from 'lucide-react';
import { api } from '../lib/api';
import { useApp } from '../context/AppContext';
import { resolveSidebarOrder, type SidebarItemId } from '../lib/sidebarOrder';
import type { ViewId } from '../types';

/** 항목 정의(라벨·아이콘). 실제 렌더 순서는 settings.sidebarOrder로 정해진다. */
const ITEM_DEFS: Record<SidebarItemId, { label: string; icon: typeof LayoutDashboard }> = {
  dashboard: { label: '대시보드', icon: LayoutDashboard },
  matrix: { label: '우선순위 매트릭스', icon: LayoutGrid },
  memo: { label: '간단 메모', icon: NotebookPen },
  school: { label: '급식 · 학사일정', icon: School },
  timetable: { label: '오늘의 시간표', icon: Table },
  procurement: { label: '품의서 작성', icon: FileSpreadsheet },
  // 자리배치는 뷰 전환이 아니라 새 탭으로 여는 외부 링크지만, 순서는 같이 바꿀 수 있다.
  seating: { label: '스마트 자리배치', icon: Armchair },
};

interface Props {
  view: ViewId;
  onNavigate: (v: ViewId) => void;
  onOpenNote: () => void;
}

/** 자리배치 앱 주소 — 서버가 내려주지 못했을 때의 폴백. */
const SEATING_FALLBACK_URL = 'https://sn-aseating.vercel.app';

export default function Sidebar({ view, onNavigate, onOpenNote }: Props) {
  const { status, refreshStatus, showToast, settings, setSettings } = useApp();
  const [draggingId, setDraggingId] = useState<SidebarItemId | null>(null);

  const order = resolveSidebarOrder(settings.sidebarOrder);

  /**
   * 드래그로 지나가는 자리의 항목을 그 즉시 밀어낸다(드롭 전 미리보기).
   * setSettings는 800ms 디바운스로 저장되므로 드래그 중 자주 불러도 네트워크 요청은
   * 손을 뗀 뒤 한 번만 나간다.
   */
  function handleDragOver(e: React.DragEvent, overId: SidebarItemId) {
    e.preventDefault();
    if (!draggingId || draggingId === overId) return;
    const from = order.indexOf(draggingId);
    const to = order.indexOf(overId);
    if (from === -1 || to === -1) return;
    const next = [...order];
    next.splice(from, 1);
    next.splice(to, 0, draggingId);
    setSettings((prev) => ({ ...prev, sidebarOrder: next }));
  }

  function resetOrder() {
    setSettings((prev) => ({ ...prev, sidebarOrder: [] }));
  }

  async function logout() {
    await api.logout();
    await refreshStatus();
  }

  /**
   * 자리배치 앱을 새 탭으로 연다.
   *
   * 팝업 차단을 피하려면 클릭 핸들러 안에서 동기적으로 탭을 먼저 열어야 한다.
   * 토큰을 기다린 뒤 window.open을 부르면 사용자 제스처가 끊겨 막힌다.
   * (여기서 'noopener'를 주면 핸들이 null로 와서 나중에 주소를 넣을 수 없다.
   *  대신 주소를 채운 직후 opener를 끊는다.)
   * 토큰은 URL fragment로만 넘긴다 — 서버 로그나 리퍼러에 남지 않는다.
   */
  async function openSeating() {
    const win = window.open('', '_blank');
    function go(url: string) {
      if (!win) { window.open(url, '_blank', 'noopener'); return; }
      win.location.replace(url);
      win.opener = null;
    }
    try {
      const { idToken, appUrl } = await api.seatingToken();
      go(`${appUrl}/seating_1.html#gt=${encodeURIComponent(idToken)}`);
    } catch (e) {
      // 토큰을 못 받아도 앱 자체는 열어준다 — 자리배치의 자체 로그인 화면으로 떨어진다.
      showToast('info', e instanceof Error ? e.message : '자동 로그인에 실패해 로그인 화면으로 이동합니다.');
      go(SEATING_FALLBACK_URL);
    }
  }

  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-slate-200/70 bg-white/80 backdrop-blur lg:flex">
      <div className="flex items-center gap-2.5 px-6 pt-6 pb-4">
        <img src="/miyo.png" alt="미요" width={36} height={36} className="shrink-0" draggable={false} />
        <span className="text-lg font-bold tracking-tight text-mint-700">미요 플래너</span>
      </div>

      <div className="px-4">
        <button
          onClick={onOpenNote}
          className="mb-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-mint-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-mint-600"
        >
          <ClipboardPaste size={16} />
          쪽지 붙여넣기
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-4 pb-6">
        <div className="mt-4">
          <p className="px-2 pb-1.5 text-xs font-medium text-slate-400">나의 하루</p>
          <ul className="space-y-1">
            {order.map((id) => {
              const { label, icon: Icon } = ITEM_DEFS[id];
              const isSeating = id === 'seating';
              const active = !isSeating && view === id;
              return (
                <li
                  key={id}
                  draggable
                  onDragStart={() => setDraggingId(id)}
                  onDragOver={(e) => handleDragOver(e, id)}
                  onDrop={(e) => e.preventDefault()}
                  onDragEnd={() => setDraggingId(null)}
                  className={draggingId === id ? 'opacity-40' : ''}
                >
                  <button
                    onClick={() => (isSeating ? void openSeating() : onNavigate(id))}
                    className={`group flex w-full cursor-grab items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition active:cursor-grabbing ${
                      active ? 'bg-mint-50 text-mint-700 ring-1 ring-mint-200' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {/* 폭이 고정된 칸이라 손잡이가 나타나도 아이콘 위치가 밀리지 않는다 */}
                    <span className="grid w-4 shrink-0 place-items-center text-slate-300 opacity-0 transition group-hover:opacity-100">
                      <GripVertical size={14} />
                    </span>
                    <Icon size={17} className={`shrink-0 ${active ? 'text-mint-500' : 'text-slate-400'}`} />
                    <span className="truncate">{label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {settings.sidebarOrder.length > 0 && (
            <button
              onClick={resetOrder}
              className="mt-1 w-full px-3 py-1 text-left text-[11px] text-slate-400 transition hover:text-slate-600"
            >
              기본 순서로
            </button>
          )}
        </div>

        <div className="mt-4">
          <p className="px-2 pb-1.5 text-xs font-medium text-slate-400">설정</p>
          <ul className="space-y-1">
            <li>
              <button
                onClick={() => onNavigate('settings')}
                className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  view === 'settings'
                    ? 'bg-mint-50 text-mint-700 ring-1 ring-mint-200'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {/* '나의 하루' 목록의 손잡이 칸과 같은 폭을 비워 아이콘 줄을 맞춘다 */}
                <span className="w-4 shrink-0" />
                <Settings size={17} className={`shrink-0 ${view === 'settings' ? 'text-mint-500' : 'text-slate-400'}`} />
                환경 설정
              </button>
            </li>
          </ul>
        </div>

        {/* 미요 실험실 바로가기 */}
        <a
          href="https://pcallpang.github.io/miyo-lab/"
          target="_blank"
          rel="noreferrer"
          className="mt-6 flex flex-col items-center gap-1.5 rounded-2xl bg-mint-50 p-3 text-center transition hover:bg-mint-100"
        >
          <img src="/miyo-lab.png" alt="미요 Lab" width={48} height={48} draggable={false} />
          <span className="text-xs font-semibold text-mint-700">미요 실험실 바로가기 →</span>
        </a>
      </nav>

      {status?.authenticated && (
        <div className="border-t border-slate-100 px-4 py-3">
          {status.email && (
            <p className="truncate px-2 pb-1.5 text-xs text-slate-400" title={status.email}>
              {status.email}
            </p>
          )}
          <button
            onClick={() => void logout()}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <LogOut size={16} className="text-slate-400" />
            로그아웃
          </button>
        </div>
      )}
    </aside>
  );
}
