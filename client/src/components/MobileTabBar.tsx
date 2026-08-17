import { LayoutDashboard, LayoutGrid, MoreHorizontal, NotebookPen, Table } from 'lucide-react';
import type { ViewId } from '../types';

const TABS: { id: ViewId; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: '대시보드', icon: LayoutDashboard },
  { id: 'matrix', label: '매트릭스', icon: LayoutGrid },
  { id: 'memo', label: '메모', icon: NotebookPen },
  { id: 'timetable', label: '시간표', icon: Table },
];

interface Props {
  view: ViewId;
  onNavigate: (v: ViewId) => void;
  onMore: () => void;
  moreActive: boolean;
}

/** lg 미만 화면에서 사이드바 대신 쓰는 하단 고정 탭바. */
export default function MobileTabBar({ view, onNavigate, onMore, moreActive }: Props) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-slate-200/70 bg-white/95 backdrop-blur lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {TABS.map(({ id, label, icon: Icon }) => {
        const active = view === id;
        return (
          <button
            key={id}
            onClick={() => onNavigate(id)}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition ${
              active ? 'text-mint-600' : 'text-slate-400'
            }`}
          >
            <Icon size={20} className={active ? 'text-mint-500' : 'text-slate-400'} />
            {label}
          </button>
        );
      })}
      <button
        onClick={onMore}
        className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition ${
          moreActive ? 'text-mint-600' : 'text-slate-400'
        }`}
      >
        <MoreHorizontal size={20} className={moreActive ? 'text-mint-500' : 'text-slate-400'} />
        더보기
      </button>
    </nav>
  );
}
