import { useCallback, useEffect, useState } from 'react';
import { Armchair, ClipboardPaste, FileSpreadsheet, LogOut, Settings, Sparkles, Table, X } from 'lucide-react';
import { api } from '../lib/api';
import { useApp } from '../context/AppContext';
import type { ViewId } from '../types';

/** 자리배치 앱 주소 — 서버가 내려주지 못했을 때의 폴백. */
const SEATING_FALLBACK_URL = 'https://sn-aseating.vercel.app';
const DURATION = 300; // ms — transition duration과 동일

interface Props {
  onNavigate: (v: ViewId) => void;
  onClose: () => void;
  onOpenNote: () => void;
}

/** 하단 탭바의 "더보기"를 누르면 아래에서 올라오는 시트. */
export default function MoreSheet({ onNavigate, onClose, onOpenNote }: Props) {
  const { status, refreshStatus, showToast } = useApp();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    window.setTimeout(onClose, DURATION);
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  async function logout() {
    await api.logout();
    await refreshStatus();
    close();
  }

  /** Sidebar.tsx의 openSeating()과 동일한 로직 — 팝업 차단을 피하려면 클릭 핸들러 안에서 동기적으로 탭을 먼저 연다. */
  async function openSeating() {
    const win = window.open('', '_blank');
    function go(url: string) {
      if (!win) {
        window.open(url, '_blank', 'noopener');
        return;
      }
      win.location.replace(url);
      win.opener = null;
    }
    try {
      const { idToken, appUrl } = await api.seatingToken();
      go(`${appUrl}/seating_1.html#gt=${encodeURIComponent(idToken)}`);
    } catch (e) {
      showToast('info', e instanceof Error ? e.message : '자동 로그인에 실패해 로그인 화면으로 이동합니다.');
      go(SEATING_FALLBACK_URL);
    }
    close();
  }

  function navigate(v: ViewId) {
    onNavigate(v);
    close();
  }

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div
        className={`absolute inset-0 bg-slate-900/30 transition-opacity duration-300 ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={close}
      />
      <div
        className={`absolute inset-x-0 bottom-0 flex max-h-[80vh] flex-col rounded-t-2xl bg-white shadow-2xl transition-transform duration-300 ease-out ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-bold text-slate-800">더보기</h2>
          <button onClick={close} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" aria-label="닫기">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto px-2 py-2">
          <button
            onClick={() => {
              onOpenNote();
              close();
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            <ClipboardPaste size={18} className="text-slate-400" />
            쪽지 붙여넣기
          </button>
          <button
            onClick={() => navigate('timetable')}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            <Table size={18} className="text-slate-400" />
            오늘의 시간표
          </button>
          <button
            onClick={() => navigate('procurement')}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            <FileSpreadsheet size={18} className="text-slate-400" />
            품의서 작성
          </button>
          <button
            onClick={() => void openSeating()}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            <Armchair size={18} className="text-slate-400" />
            스마트 자리배치
          </button>
          <a
            href="https://pcallpang.github.io/miyo-lab/"
            target="_blank"
            rel="noreferrer"
            onClick={close}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            <img src="/miyo-lab.png" alt="미요 Lab" width={18} height={18} draggable={false} />
            미요 실험실 바로가기
          </a>
          <button
            onClick={() => navigate('settings')}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            <Settings size={18} className="text-slate-400" />
            환경 설정
          </button>
          <button
            onClick={() => navigate('board')}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            <Sparkles size={18} className="text-slate-400" />
            미요쌤에게 원해요!
          </button>
        </div>

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
      </div>
    </div>
  );
}
