import { useState } from 'react';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import LoginScreen from './components/LoginScreen';
import MobileTabBar from './components/MobileTabBar';
import MoreSheet from './components/MoreSheet';
import NotePasteModal from './components/NotePasteModal';
import WhatsNewModal, { WHATS_NEW_VERSION } from './components/WhatsNewModal';
import { useApp } from './context/AppContext';
import { useData } from './context/DataContext';
import { useCompletedTodoPurge } from './hooks/useCompletedTodoPurge';
import { useReminders } from './hooks/useReminders';
import { useTodoReminders } from './hooks/useTodoReminders';
import { useLocalStorage } from './lib/storage';
import BoardView from './views/BoardView';
import DashboardView from './views/DashboardView';
import MatrixView from './views/MatrixView';
import MemoView from './views/MemoView';
import OvertimeView from './views/OvertimeView';
import ProcurementView from './views/ProcurementView';
import SchoolView from './views/SchoolView';
import SettingsView from './views/SettingsView';
import TimetableView from './views/TimetableView';
import type { ViewId } from './types';

const TOAST_STYLES = {
  success: { icon: CheckCircle2, cls: 'bg-mint-600 text-white' },
  error: { icon: AlertCircle, cls: 'bg-rose-500 text-white' },
  info: { icon: Info, cls: 'bg-slate-700 text-white' },
} as const;

/** 하단 탭바에 자리가 없어 "더보기" 시트로 들어가는 화면들. */
const MORE_VIEWS: ViewId[] = ['timetable', 'procurement', 'settings', 'board'];

export default function App() {
  const [view, setView] = useState<ViewId>('dashboard');
  const [noteOpen, setNoteOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [seenWhatsNew, setSeenWhatsNew] = useLocalStorage('haru.whatsnew.seen', '');
  const { status, toasts, events, settings } = useApp();
  const { data, update } = useData();

  useReminders(events, settings.reminderMinutes);
  useTodoReminders(data.todos, settings.reminderMinutes > 0);
  useCompletedTodoPurge(data.todos, update);

  // 로그인 게이트: 구글 로그인 전이면 로그인 화면만 표시
  if (status && !status.authenticated) {
    return <LoginScreen />;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar view={view} onNavigate={setView} onOpenNote={() => setNoteOpen(true)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="flex-1 px-6 py-6 pb-24 lg:px-8 lg:pb-6">
          {view === 'dashboard' && <DashboardView />}
          {view === 'matrix' && <MatrixView />}
          {view === 'timetable' && <TimetableView />}
          {view === 'school' && <SchoolView />}
          {view === 'memo' && <MemoView />}
          {view === 'overtime' && <OvertimeView />}
          {view === 'procurement' && <ProcurementView />}
          {view === 'settings' && <SettingsView />}
          {view === 'board' && <BoardView />}
        </main>
      </div>

      <MobileTabBar
        view={view}
        onNavigate={setView}
        onMore={() => setMoreOpen(true)}
        moreActive={MORE_VIEWS.includes(view)}
      />

      {noteOpen && <NotePasteModal onClose={() => setNoteOpen(false)} />}

      {seenWhatsNew !== WHATS_NEW_VERSION && (
        <WhatsNewModal onClose={() => setSeenWhatsNew(WHATS_NEW_VERSION)} />
      )}

      {moreOpen && (
        <MoreSheet onNavigate={setView} onClose={() => setMoreOpen(false)} onOpenNote={() => setNoteOpen(true)} />
      )}

      {/* 토스트 */}
      <div className="fixed right-5 bottom-5 z-50 flex flex-col gap-2">
        {toasts.map((t) => {
          const { icon: Icon, cls } = TOAST_STYLES[t.type];
          return (
            <div
              key={t.id}
              className={`flex items-center gap-2 rounded-2xl px-4 py-3 text-sm shadow-lg ${cls}`}
            >
              <Icon size={17} />
              <span>{t.message}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
