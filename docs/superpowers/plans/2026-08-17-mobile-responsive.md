# 모바일 반응형 대응 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 미요 플래너를 모바일 브라우저(좁은 화면)에서도 사용할 수 있도록 내비게이션을 하단 탭바 방식으로 전환하고, 모바일에서 깨지는 두 지점(기안문 생성 모달의 고정폭 2단 레이아웃, 매트릭스의 터치 미지원 드래그앤드롭)을 보완한다.

**Architecture:** `lg`(1024px) 미만에서는 기존 사이드바를 숨기고 화면 하단에 고정 탭바(`MobileTabBar`)를 띄운다. 탭바에 없는 메뉴는 "더보기" 탭이 여는 바텀시트(`MoreSheet`)에서 접근한다. 나머지 화면들은 이미 반응형 그리드로 돼 있어 구조를 바꾸지 않고, 고정폭 레이아웃 두 곳만 좁은 화면 대응 클래스를 추가한다.

**Tech Stack:** React 19 + TypeScript + Tailwind CSS v4(기본 브레이크포인트), lucide-react 아이콘. 새 의존성 추가 없음.

## Global Constraints

- 브레이크포인트는 Tailwind 기본값을 쓴다: `sm`=640px, `md`=768px, `lg`=1024px, `xl`=1280px. `lg` 미만을 모바일/태블릿 레이아웃으로 취급한다.
- 새 npm 패키지를 추가하지 않는다. 아이콘은 이미 설치된 `lucide-react`에서만 가져온다.
- 코드 주석은 "왜"가 비자명할 때만 한 줄로 남긴다(기존 컨벤션).
- 이 저장소에는 React 컴포넌트에 대한 자동화 테스트(vitest + testing-library 등)가 없다. `client/src/lib/*.test.ts`는 순수 함수만 테스트한다. 이번 작업은 전부 UI/레이아웃 변경이므로 각 태스크의 검증은 `npx tsc --noEmit`(작업 디렉터리 `client/`) + `npm run build` + 아래 "수동 검증 방법"으로 한다.
- **수동 검증 방법(로그인 우회)**: `client/src/App.tsx`의 로그인 게이트는 다음과 같다.
  ```tsx
  if (status && !status.authenticated) {
    return <LoginScreen />;
  }
  ```
  로컬에서 실제 구글 로그인 없이 인증된 화면을 보려면 이 블록의 내용을 임시로 `void LoginScreen;`로 바꿔 게이트를 통과시킨다(`if (false && ...)`로 바꾸면 안 됨 — TypeScript 타입 좁히기가 깨짐). 확인이 끝나면 **반드시** 원상 복구하고 `git diff --stat client/src/App.tsx`로 우회 코드가 남지 않았는지 확인한 뒤 커밋한다. 이 우회는 실제 서버 세션을 만들지 않으므로 `/api/data` 저장은 401로 실패하지만, 이번 작업은 레이아웃 확인만 필요하므로 무관하다.
- 브라우저 확인은 Chrome DevTools 기기 툴바(예: iPhone SE 375px, iPhone 12 Pro 390px)로 폭을 좁혀서 진행한다. `lg`(1024px) 이상 폭에서 기존 데스크톱 레이아웃이 그대로인지도 함께 확인한다.

---

### Task 1: MobileTabBar 컴포넌트 + App 셸에 연결

**Files:**
- Create: `client/src/components/MobileTabBar.tsx`
- Modify: `client/src/components/Sidebar.tsx:80`
- Modify: `client/src/App.tsx`

**Interfaces:**
- Produces: `MobileTabBar` 컴포넌트, props `{ view: ViewId; onNavigate: (v: ViewId) => void; onMore: () => void; moreActive: boolean }` — Task 2가 "더보기" 시트를 여는 데 `onMore`/`moreActive`를 그대로 사용한다.

- [ ] **Step 1: `MobileTabBar.tsx` 작성**

`client/src/components/MobileTabBar.tsx` (신규 파일):

```tsx
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
```

- [ ] **Step 2: `Sidebar.tsx`를 `lg` 이상에서만 보이게 수정**

`client/src/components/Sidebar.tsx:80`, 기존:

```tsx
  <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-slate-200/70 bg-white/80 backdrop-blur">
```

다음으로 교체:

```tsx
  <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-slate-200/70 bg-white/80 backdrop-blur lg:flex">
```

- [ ] **Step 3: `App.tsx`에 탭바 연결**

`client/src/App.tsx` 전체를 다음으로 교체:

```tsx
import { useState } from 'react';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import LoginScreen from './components/LoginScreen';
import MobileTabBar from './components/MobileTabBar';
import NotePasteModal from './components/NotePasteModal';
import { useApp } from './context/AppContext';
import { useData } from './context/DataContext';
import { useReminders } from './hooks/useReminders';
import { useTodoReminders } from './hooks/useTodoReminders';
import DashboardView from './views/DashboardView';
import MatrixView from './views/MatrixView';
import MemoView from './views/MemoView';
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
const MORE_VIEWS: ViewId[] = ['school', 'procurement', 'settings'];

export default function App() {
  const [view, setView] = useState<ViewId>('dashboard');
  const [noteOpen, setNoteOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const { status, toasts, events, settings } = useApp();
  const { data } = useData();

  useReminders(events, settings.reminderMinutes);
  useTodoReminders(data.todos, settings.reminderMinutes > 0);

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
          {view === 'procurement' && <ProcurementView />}
          {view === 'settings' && <SettingsView />}
        </main>
      </div>

      <MobileTabBar
        view={view}
        onNavigate={setView}
        onMore={() => setMoreOpen(true)}
        moreActive={MORE_VIEWS.includes(view)}
      />

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
```

(`moreOpen` 상태는 이 태스크에서 선언만 하고 Task 2에서 `MoreSheet`를 렌더링할 때 사용한다. 이 시점에는 아직 `MoreSheet`가 없으므로 `moreOpen`이 "미사용 변수" 경고를 내지 않도록 `setMoreOpen`을 `onMore`에서 실제로 호출하는 것으로 충분하다 — `moreOpen` 자체를 읽는 코드는 Task 2에서 추가된다. Step 4에서 `tsc`가 미사용 변수 에러를 내면 Task 2를 이어서 바로 진행한다.)

- [ ] **Step 4: 타입 체크 + 빌드**

Run (in `client/`): `npx tsc --noEmit`
Expected: 에러 없음. 단, `moreOpen`을 읽는 코드가 아직 없어 `noUnusedLocals`가 켜져 있다면 에러가 날 수 있다 — 이 경우 Task 2를 바로 이어서 완료한 뒤 다시 체크한다.

Run: `npm run build`
Expected: 성공.

- [ ] **Step 5: 수동 확인**

위 "수동 검증 방법"대로 로그인 우회 후 `npm run dev`로 로컬 서버를 띄우고 Chrome DevTools에서 375px 폭으로 확인:
- 사이드바가 사라지고 하단에 대시보드·매트릭스·메모·시간표·더보기 탭바가 보이는지
- 탭을 눌러 각 화면으로 전환되는지, 활성 탭이 민트색으로 강조되는지
- 1024px 이상으로 넓히면 사이드바가 다시 보이고 탭바가 사라지는지
- 확인 후 로그인 우회 코드를 원상 복구(`git diff --stat client/src/App.tsx`가 비어 있어야 함)

- [ ] **Step 6: 커밋**

```bash
git add client/src/components/MobileTabBar.tsx client/src/components/Sidebar.tsx client/src/App.tsx
git commit -m "feat: 모바일 하단 탭바 추가, lg 미만에서 사이드바 대체"
```

---

### Task 2: MoreSheet 컴포넌트 + "더보기" 연결

**Files:**
- Create: `client/src/components/MoreSheet.tsx`
- Modify: `client/src/App.tsx`

**Interfaces:**
- Consumes: `MobileTabBar`의 `onMore`/`moreActive` (Task 1에서 생성), `App.tsx`의 `moreOpen`/`setMoreOpen` state (Task 1에서 이미 선언됨), `ViewId`(`client/src/types.ts`), `useApp()`의 `status`/`refreshStatus`/`showToast`(`client/src/context/AppContext.tsx`), `api.logout()`/`api.seatingToken()`(`client/src/lib/api.ts`).
- Produces: `MoreSheet` 컴포넌트, props `{ onNavigate: (v: ViewId) => void; onClose: () => void }`.

- [ ] **Step 1: `MoreSheet.tsx` 작성**

`client/src/components/MoreSheet.tsx` (신규 파일). `Sidebar.tsx`의 `openSeating()`/`logout()` 로직을 그대로 옮겨온다:

```tsx
import { useCallback, useEffect, useState } from 'react';
import { Armchair, FileSpreadsheet, LogOut, School, Settings, X } from 'lucide-react';
import { api } from '../lib/api';
import { useApp } from '../context/AppContext';
import type { ViewId } from '../types';

/** 자리배치 앱 주소 — 서버가 내려주지 못했을 때의 폴백. */
const SEATING_FALLBACK_URL = 'https://sn-aseating.vercel.app';
const DURATION = 300; // ms — transition duration과 동일

interface Props {
  onNavigate: (v: ViewId) => void;
  onClose: () => void;
}

/** 하단 탭바의 "더보기"를 누르면 아래에서 올라오는 시트. */
export default function MoreSheet({ onNavigate, onClose }: Props) {
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
            onClick={() => navigate('school')}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            <School size={18} className="text-slate-400" />
            급식 · 학사일정
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
            <img src="/miyo.png" alt="미요" width={18} height={18} draggable={false} />
            미요 실험실 바로가기
          </a>
          <button
            onClick={() => navigate('settings')}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            <Settings size={18} className="text-slate-400" />
            환경 설정
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
```

- [ ] **Step 2: `App.tsx`에 `MoreSheet` 렌더링 연결**

`client/src/App.tsx`에 import 추가:

```tsx
import MoreSheet from './components/MoreSheet';
```

`{noteOpen && <NotePasteModal onClose={() => setNoteOpen(false)} />}` 바로 아래에 추가:

```tsx
      {moreOpen && <MoreSheet onNavigate={setView} onClose={() => setMoreOpen(false)} />}
```

- [ ] **Step 3: 타입 체크 + 빌드**

Run (in `client/`): `npx tsc --noEmit`
Expected: 에러 없음 (Task 1에서 남아 있던 `moreOpen` 미사용 경고가 있었다면 여기서 해소됨).

Run: `npm run build`
Expected: 성공.

- [ ] **Step 4: 수동 확인**

로그인 우회 후 375px 폭에서:
- 하단 탭바의 "더보기"를 누르면 시트가 아래에서 올라오는지
- 급식·학사일정 / 품의서 작성 / 환경 설정을 누르면 해당 화면으로 이동하고 시트가 닫히는지
- 스마트 자리배치를 누르면 새 탭이 열리는지(팝업 차단 여부는 브라우저 설정에 따라 다를 수 있음 — 최소한 에러 없이 동작하는지만 확인)
- 미요 실험실 링크가 새 탭으로 열리는지
- 로그인 이메일과 로그아웃 버튼이 보이는지, 오버레이 클릭/ESC로 시트가 닫히는지
- 확인 후 로그인 우회 코드 원상 복구, `git diff --stat client/src/App.tsx` 확인

- [ ] **Step 5: 커밋**

```bash
git add client/src/components/MoreSheet.tsx client/src/App.tsx
git commit -m "feat: 모바일 더보기 시트 추가 (급식학사·품의서·자리배치·실험실·설정·로그아웃)"
```

---

### Task 3: Header 좁은 화면 대응

**Files:**
- Modify: `client/src/components/Header.tsx`

**Interfaces:**
- Consumes: 없음(기존 `Header.tsx` 내부 상태만 사용).
- Produces: 없음(다른 태스크가 의존하지 않는 독립 변경).

- [ ] **Step 1: 일과단계 뱃지, 연동 상태 텍스트를 좁은 화면에서 축약**

`client/src/components/Header.tsx`의 아래 블록(현재 49~51행):

```tsx
        <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-semibold text-sky-600">
          {phaseLabel(now, settings.periodTimes, settings.periodCount, data.timetable)}
        </span>
```

다음으로 교체(`sm` 미만에서 숨김):

```tsx
        <span className="hidden rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-semibold text-sky-600 sm:inline-block">
          {phaseLabel(now, settings.periodTimes, settings.periodCount, data.timetable)}
        </span>
```

같은 파일의 연동 상태 배지(현재 54~67행):

```tsx
      {status?.connected ? (
        <span className="flex items-center gap-2 rounded-full border border-mint-200 bg-mint-50 px-3.5 py-1.5 text-xs font-medium text-mint-700">
          <span className="h-2 w-2 rounded-full bg-mint-500" />
          {status.email ?? '구글 계정 연동됨'}
        </span>
      ) : (
        <button
          onClick={() => void connectGoogle()}
          className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-medium text-slate-600 shadow-sm transition hover:border-mint-300 hover:text-mint-700"
        >
          <LogIn size={15} />
          구글 계정 연동
        </button>
      )}
```

다음으로 교체(이메일/버튼 텍스트를 `sm` 미만에서 숨겨 아이콘만 남김):

```tsx
      {status?.connected ? (
        <span className="flex items-center gap-2 rounded-full border border-mint-200 bg-mint-50 px-3 py-1.5 text-xs font-medium text-mint-700 sm:px-3.5">
          <span className="h-2 w-2 shrink-0 rounded-full bg-mint-500" />
          <span className="hidden sm:inline">{status.email ?? '구글 계정 연동됨'}</span>
        </span>
      ) : (
        <button
          onClick={() => void connectGoogle()}
          className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm transition hover:border-mint-300 hover:text-mint-700 sm:px-4"
        >
          <LogIn size={15} />
          <span className="hidden sm:inline">구글 계정 연동</span>
        </button>
      )}
```

- [ ] **Step 2: 타입 체크 + 빌드**

Run (in `client/`): `npx tsc --noEmit`
Expected: 에러 없음.

Run: `npm run build`
Expected: 성공.

- [ ] **Step 3: 수동 확인**

로그인 우회 후 375px 폭에서 헤더가 한 줄에 겹치지 않고 들어가는지, `sm`(640px) 이상으로 넓히면 일과단계 뱃지와 이메일/버튼 텍스트가 다시 보이는지 확인. 확인 후 로그인 우회 원상 복구.

- [ ] **Step 4: 커밋**

```bash
git add client/src/components/Header.tsx
git commit -m "feat: 헤더 좁은 화면 대응 (일과단계·연동 텍스트 축약)"
```

---

### Task 4: DraftDocumentModal 좁은 화면 스택 레이아웃

**Files:**
- Modify: `client/src/components/DraftDocumentModal.tsx:144,146`

**Interfaces:**
- Consumes: 없음.
- Produces: 없음.

- [ ] **Step 1: 입력 폼/미리보기 컨테이너를 반응형으로 변경**

`client/src/components/DraftDocumentModal.tsx:144`, 기존:

```tsx
        <div className="flex min-h-0 flex-1">
```

다음으로 교체(좁은 화면에서 세로 스택 + 전체 스크롤 허용):

```tsx
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto md:flex-row md:overflow-hidden">
```

`client/src/components/DraftDocumentModal.tsx:146`, 기존:

```tsx
          <div className="w-[420px] shrink-0 overflow-y-auto border-r border-slate-100 px-6 py-5">
```

다음으로 교체(좁은 화면에서 전체 폭, `md` 이상에서 기존 420px 고정폭):

```tsx
          <div className="w-full shrink-0 overflow-y-auto border-b border-slate-100 px-6 py-5 md:w-[420px] md:border-r md:border-b-0">
```

- [ ] **Step 2: 타입 체크 + 빌드**

Run (in `client/`): `npx tsc --noEmit`
Expected: 에러 없음.

Run: `npm run build`
Expected: 성공.

- [ ] **Step 3: 수동 확인**

로그인 우회 후 품의서 작성 화면 → "기안문 생성" 모달을 375px 폭에서 열어:
- 입력 폼이 화면 전체 폭으로 위쪽에, 미리보기가 그 아래에 오는지
- 모달 전체(헤더 제외)가 세로 스크롤되는지, 입력 필드가 잘리지 않는지
- `md`(768px) 이상으로 넓히면 기존처럼 좌우 2단(420px 고정 + 나머지 미리보기)으로 돌아오는지
- 복사/닫기 버튼이 하단에 정상적으로 보이는지

확인 후 로그인 우회 원상 복구.

- [ ] **Step 4: 커밋**

```bash
git add client/src/components/DraftDocumentModal.tsx
git commit -m "fix: 기안문 생성 모달이 좁은 화면에서 세로로 스택되게 수정"
```

---

### Task 5: MatrixView 터치용 사분면 이동 버튼

**Files:**
- Modify: `client/src/views/MatrixView.tsx`

**Interfaces:**
- Consumes: `QUADRANTS`, `moveToQuadrant` (`client/src/lib/eisenhower.ts`, 이미 import돼 있음).
- Produces: 없음.

**배경:** `MatrixView`는 HTML5 네이티브 드래그(`onDragStart`/`onDrop`)로만 사분면 이동을 지원하는데, 이는 터치 환경에서 동작하지 않는다. 각 할 일 항목에 항상 보이는 "이동" 버튼을 추가해 탭으로 다른 사분면을 선택할 수 있게 한다.

- [ ] **Step 1: `Move` 아이콘 import 추가**

`client/src/views/MatrixView.tsx` 상단 import 블록, 기존:

```tsx
import {
  CalendarClock,
  Eye,
  EyeOff,
  LayoutGrid,
  Link as LinkIcon,
  Pencil,
  Pin,
  Star,
  StickyNote,
  Trash2,
} from 'lucide-react';
```

다음으로 교체(`Move` 추가):

```tsx
import {
  CalendarClock,
  Eye,
  EyeOff,
  LayoutGrid,
  Link as LinkIcon,
  Move,
  Pencil,
  Pin,
  Star,
  StickyNote,
  Trash2,
} from 'lucide-react';
```

- [ ] **Step 2: 이동 메뉴 상태 추가**

`MatrixView` 함수 내부, 기존:

```tsx
  const [showDone, setShowDone] = useState(false);
  const [editing, setEditing] = useState<Todo | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<QuadrantId | null>(null);
  const [openMemoId, setOpenMemoId] = useState<string | null>(null);
```

다음으로 교체(`moveMenuId` 추가):

```tsx
  const [showDone, setShowDone] = useState(false);
  const [editing, setEditing] = useState<Todo | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<QuadrantId | null>(null);
  const [openMemoId, setOpenMemoId] = useState<string | null>(null);
  const [moveMenuId, setMoveMenuId] = useState<string | null>(null);
```

- [ ] **Step 3: 이동 버튼 + 팝오버 추가**

`MatrixView.tsx`에서 `Star`/`Pencil` 버튼 사이, 기존(중요 토글 버튼 바로 뒤):

```tsx
                        <button
                          type="button"
                          onClick={() => toggleImportant(todo)}
                          aria-label={todo.important ? '중요 해제' : '중요로 표시'}
                          className={`shrink-0 rounded p-0.5 transition ${
                            todo.important
                              ? 'text-amber-400 hover:text-amber-500'
                              : 'text-slate-300 opacity-0 group-hover:opacity-100 hover:text-amber-400'
                          }`}
                        >
                          <Star size={13} fill={todo.important ? 'currentColor' : 'none'} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditing(todo)}
                          aria-label="수정"
                          className="shrink-0 rounded p-0.5 text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-mint-500"
                        >
                          <Pencil size={13} />
                        </button>
```

다음으로 교체(중요 토글과 수정 버튼 사이에 이동 버튼 삽입 — 드래그가 안 되는 터치 환경을 위해 항상 노출):

```tsx
                        <button
                          type="button"
                          onClick={() => toggleImportant(todo)}
                          aria-label={todo.important ? '중요 해제' : '중요로 표시'}
                          className={`shrink-0 rounded p-0.5 transition ${
                            todo.important
                              ? 'text-amber-400 hover:text-amber-500'
                              : 'text-slate-300 opacity-0 group-hover:opacity-100 hover:text-amber-400'
                          }`}
                        >
                          <Star size={13} fill={todo.important ? 'currentColor' : 'none'} />
                        </button>
                        <div className="relative shrink-0">
                          <button
                            type="button"
                            onClick={() => setMoveMenuId((cur) => (cur === todo.id ? null : todo.id))}
                            aria-label="다른 사분면으로 이동"
                            className="rounded p-0.5 text-slate-300 transition hover:text-mint-500"
                          >
                            <Move size={13} />
                          </button>
                          {moveMenuId === todo.id && (
                            <>
                              <div
                                className="fixed inset-0 z-10"
                                onClick={() => setMoveMenuId(null)}
                              />
                              <div className="absolute right-0 z-20 mt-1 w-40 rounded-xl border border-slate-100 bg-white p-1 shadow-lg">
                                {QUADRANTS.filter((qq) => qq.id !== q.id).map((qq) => (
                                  <button
                                    key={qq.id}
                                    type="button"
                                    onClick={() => {
                                      replace(moveToQuadrant(todo, qq.id, urgentDays));
                                      setMoveMenuId(null);
                                    }}
                                    className="block w-full rounded-lg px-2.5 py-1.5 text-left text-xs text-slate-600 hover:bg-slate-50"
                                  >
                                    {qq.title}
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setEditing(todo)}
                          aria-label="수정"
                          className="shrink-0 rounded p-0.5 text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-mint-500"
                        >
                          <Pencil size={13} />
                        </button>
```

- [ ] **Step 4: 타입 체크 + 빌드**

Run (in `client/`): `npx tsc --noEmit`
Expected: 에러 없음.

Run: `npm run build`
Expected: 성공.

- [ ] **Step 5: 수동 확인**

로그인 우회 후 매트릭스 화면에서:
- 각 할 일 카드에 이동(⇄) 아이콘이 항상 보이는지(호버 없이도)
- 클릭하면 현재 사분면을 제외한 3개 목록이 뜨는지, 선택하면 해당 항목이 그 사분면으로 옮겨지는지
- 바깥을 클릭하면 메뉴가 닫히는지
- 데스크톱 폭에서 기존 드래그앤드롭도 여전히 동작하는지(회귀 확인)
- 375px 폭에서 터치(브라우저 클릭)로 이동 버튼이 정상 동작하는지

확인 후 로그인 우회 원상 복구.

- [ ] **Step 6: 커밋**

```bash
git add client/src/views/MatrixView.tsx
git commit -m "feat: 매트릭스에 터치용 사분면 이동 버튼 추가"
```

---

### Task 6: 전체 회귀 검증

**Files:** 없음(코드 변경 없음, 검증만).

**Interfaces:** 없음.

- [ ] **Step 1: 전체 자동 검증**

Run (in `client/`): `npx tsc --noEmit`
Expected: 에러 없음.

Run: `npm run build`
Expected: 성공.

Run: `npm run test` (vitest)
Expected: 기존 68개 테스트 전부 PASS(신규 테스트 추가 없음 — 이번 작업은 UI 레이아웃 변경뿐).

Run (저장소 루트에서): `node --test server/lib/*.test.js`
Expected: 기존 39개 테스트 전부 PASS(서버 코드는 변경하지 않았으므로 회귀만 확인).

- [ ] **Step 2: 전 화면 수동 회귀**

로그인 우회 후 Chrome DevTools 375px 폭에서 전체 흐름을 훑는다:
1. 대시보드 → 매트릭스 → 메모 → 시간표를 하단 탭바로 전환
2. 더보기 → 급식·학사일정, 품의서 작성, 환경 설정 각각 진입 후 하단 탭바로 다시 대시보드 복귀
3. 매트릭스에서 이동 버튼으로 할 일 사분면 변경
4. 품의서 작성 → 행 추가 → 기안문 생성 모달에서 입력/미리보기 스택 확인
5. 1024px 이상으로 넓혀 사이드바·헤더가 기존 데스크톱 모습 그대로인지 확인(회귀 없음)

문제를 발견하면 해당 태스크로 돌아가 수정 후 다시 커밋한다. 문제가 없으면 이 태스크는 커밋 없이 종료한다.

확인 후 로그인 우회 원상 복구(`git diff --stat client/src/App.tsx` 확인).
