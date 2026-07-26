import {
  ClipboardPaste,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  NotebookPen,
  School,
  Settings,
  Sun,
  Table,
} from 'lucide-react';
import { api } from '../lib/api';
import { useApp } from '../context/AppContext';
import type { ViewId } from '../types';

const MENU: { group: string; items: { id: ViewId; label: string; icon: typeof Sun }[] }[] = [
  {
    group: '나의 하루',
    items: [
      { id: 'dashboard', label: '대시보드', icon: LayoutDashboard },
      { id: 'matrix', label: '우선순위 매트릭스', icon: LayoutGrid },
      { id: 'timetable', label: '오늘의 시간표', icon: Table },
      { id: 'school', label: '급식 · 학사일정', icon: School },
      { id: 'memo', label: '간단 메모', icon: NotebookPen },
    ],
  },
  {
    group: '설정',
    items: [{ id: 'settings', label: '환경 설정', icon: Settings }],
  },
];

interface Props {
  view: ViewId;
  onNavigate: (v: ViewId) => void;
  onOpenNote: () => void;
}

export default function Sidebar({ view, onNavigate, onOpenNote }: Props) {
  const { status, refreshStatus } = useApp();

  async function logout() {
    await api.logout();
    await refreshStatus();
  }

  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-slate-200/70 bg-white/80 backdrop-blur">
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
        {MENU.map(({ group, items }) => (
          <div key={group} className="mt-4">
            <p className="px-2 pb-1.5 text-xs font-medium text-slate-400">{group}</p>
            <ul className="space-y-1">
              {items.map(({ id, label, icon: Icon }) => (
                <li key={id}>
                  <button
                    onClick={() => onNavigate(id)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                      view === id
                        ? 'bg-mint-50 text-mint-700 ring-1 ring-mint-200'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Icon size={17} className={view === id ? 'text-mint-500' : 'text-slate-400'} />
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}

        {/* 미요툰 보러가기 */}
        <a
          href="https://www.instagram.com/me_yotoon?igsh=MXNidXNrcnNjZGY3Zw=="
          target="_blank"
          rel="noreferrer"
          className="mt-6 flex flex-col items-center gap-1.5 rounded-2xl bg-mint-50 p-3 text-center transition hover:bg-mint-100"
        >
          <img src="/miyo.png" alt="미요" width={48} height={48} draggable={false} />
          <span className="text-xs font-semibold text-mint-700">미요툰 보러가기 →</span>
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
