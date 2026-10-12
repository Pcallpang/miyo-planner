import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import LoginScreen from './components/LoginScreen';
import SetupGuide from './components/SetupGuide';
import { shouldShowOnboarding } from './lib/onboarding';
import MobileTabBar from './components/MobileTabBar';
import MessengerAlertModal from './components/MessengerAlertModal';
import MoreSheet from './components/MoreSheet';
import NotePasteModal from './components/NotePasteModal';
import WhatsNewModal, { WHATS_NEW_VERSION } from './components/WhatsNewModal';
import { useApp } from './context/AppContext';
import { useData } from './context/DataContext';
import { useCompletedTodoPurge } from './hooks/useCompletedTodoPurge';
import { useMessengerAlerts } from './hooks/useMessengerAlerts';
import { useReminders } from './hooks/useReminders';
import { useTodoReminders } from './hooks/useTodoReminders';
import { useLocalStorage } from './lib/storage';
import BoardView from './views/BoardView';
import DashboardView from './views/DashboardView';
import DevLogView from './views/DevLogView';
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
const MORE_VIEWS: ViewId[] = ['timetable', 'procurement', 'settings', 'board', 'devlog'];

export default function App() {
  const [view, setView] = useState<ViewId>('dashboard');
  const [noteOpen, setNoteOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [guideDismissed, setGuideDismissed] = useState(false);
  const [manualGuideOpen, setManualGuideOpen] = useState(false);
  const [seenWhatsNew, setSeenWhatsNew] = useLocalStorage('haru.whatsnew.seen', '');
  const { status, toasts, events, settings } = useApp();
  const { data, update, loading: dataLoading } = useData();
  const guideActive = !!status?.authenticated && shouldShowOnboarding(data.onboarding, dataLoading);
  const guideVisible = !!status?.authenticated && !dataLoading && !data.onboarding?.completed && (guideActive || manualGuideOpen) && !guideDismissed;

  useEffect(() => {
    // 처음 설정을 마친 직후 이전 업데이트 팝업이 이어서 뜨지 않게 한다.
    if (guideVisible) setSeenWhatsNew(WHATS_NEW_VERSION);
  }, [guideVisible, setSeenWhatsNew]);

  function openGuide() {
    update({ onboarding: { autoShow: !data.onboarding?.completed && data.onboarding?.autoShow === true, step: data.onboarding?.completed ? 0 : (data.onboarding?.step ?? 0), started: true, completed: false, checked: data.onboarding?.checked ?? [] } });
    setManualGuideOpen(true);
    setGuideDismissed(false);
    setSeenWhatsNew(WHATS_NEW_VERSION);
  }
  const { alerts: messengerAlerts, refresh: refreshMessengerAlerts } = useMessengerAlerts(Boolean(status?.authenticated));

  useReminders(events, settings.reminderMinutes);
  useTodoReminders(data.todos, settings.reminderMinutes > 0);
  useCompletedTodoPurge(data.todos, update);

  // 로그인 게이트: 구글 로그인 전이면 로그인 화면만 표시
  if (status && !status.authenticated) {
    return <LoginScreen />;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar
        view={view}
        onNavigate={setView}
        onOpenNote={() => setNoteOpen(true)}
        onOpenMessengerAlerts={() => setAlertsOpen(true)}
        messengerAlertCount={messengerAlerts.length}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className={`flex-1 px-6 py-6 pb-24 lg:px-8 lg:pb-6 ${guideVisible && data.onboarding?.started ? 'setup-tour-layout' : ''}`}>
          {guideVisible && <SetupGuide onDismiss={() => {
            setGuideDismissed(true);
            setSeenWhatsNew(WHATS_NEW_VERSION);
          }} onNavigate={setView} />}
          {guideActive && guideDismissed && (
            <button onClick={openGuide} className="mb-5 rounded-xl bg-mint-50 px-4 py-3 text-sm font-semibold text-mint-700">처음 사용 안내 이어하기 →</button>
          )}
          {view === 'dashboard' && <DashboardView />}
          {view === 'matrix' && <MatrixView />}
          {view === 'timetable' && <TimetableView />}
          {view === 'school' && <SchoolView />}
          {view === 'memo' && <MemoView />}
          {view === 'overtime' && <OvertimeView />}
          {view === 'procurement' && <ProcurementView />}
          {view === 'settings' && <SettingsView onOpenGuide={openGuide} />}
          {view === 'board' && <BoardView />}
          {view === 'devlog' && <DevLogView />}
        </main>
      </div>

      <MobileTabBar
        view={view}
        onNavigate={setView}
        onMore={() => setMoreOpen(true)}
        moreActive={MORE_VIEWS.includes(view)}
      />

      {noteOpen && <NotePasteModal onClose={() => setNoteOpen(false)} />}
      {alertsOpen && (
        <MessengerAlertModal onClose={() => setAlertsOpen(false)} onAlertsChanged={refreshMessengerAlerts} />
      )}

      {status?.authenticated && !dataLoading && !guideActive && !guideVisible && seenWhatsNew !== WHATS_NEW_VERSION && (
        <WhatsNewModal onClose={() => setSeenWhatsNew(WHATS_NEW_VERSION)} />
      )}

      {moreOpen && (
        <MoreSheet
          onNavigate={setView}
          onClose={() => setMoreOpen(false)}
          onOpenNote={() => setNoteOpen(true)}
          onOpenMessengerAlerts={() => setAlertsOpen(true)}
          messengerAlertCount={messengerAlerts.length}
        />
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
