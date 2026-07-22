import { useState } from 'react';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import LoginScreen from './components/LoginScreen';
import NotePasteModal from './components/NotePasteModal';
import { useApp } from './context/AppContext';
import { useReminders } from './hooks/useReminders';
import DashboardView from './views/DashboardView';
import MemoView from './views/MemoView';
import MonthlyView from './views/MonthlyView';
import SettingsView from './views/SettingsView';
import TimerView from './views/TimerView';
import TimetableView from './views/TimetableView';
import type { ViewId } from './types';

const TOAST_STYLES = {
  success: { icon: CheckCircle2, cls: 'bg-mint-600 text-white' },
  error: { icon: AlertCircle, cls: 'bg-rose-500 text-white' },
  info: { icon: Info, cls: 'bg-slate-700 text-white' },
} as const;

export default function App() {
  const [view, setView] = useState<ViewId>('dashboard');
  const [noteOpen, setNoteOpen] = useState(false);
  const { status, toasts, events, settings } = useApp();

  useReminders(events, settings.reminderMinutes);

  // 비밀번호 게이트: 인증이 필요한데 아직 로그인하지 않았으면 로그인 화면만 표시
  if (status?.authRequired && !status.authenticated) {
    return <LoginScreen />;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar view={view} onNavigate={setView} onOpenNote={() => setNoteOpen(true)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="flex-1 px-6 py-6 lg:px-8">
          {view === 'dashboard' && <DashboardView />}
          {view === 'timetable' && <TimetableView />}
          {view === 'monthly' && <MonthlyView />}
          {view === 'memo' && <MemoView />}
          {view === 'timer' && <TimerView />}
          {view === 'settings' && <SettingsView />}
        </main>
      </div>

      {noteOpen && <NotePasteModal onClose={() => setNoteOpen(false)} />}

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
