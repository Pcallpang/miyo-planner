import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { getDayPhase, getPhaseMessage, getNextPeriodIndex, addWeekday } from './lib/schedule';
import { effectiveSlot } from './lib/scheduleSlot';
import { buildSubjectColors, classColorKey } from './lib/subjectColors';
import type { AppDataResult } from './miyo';

/** 창이 실제로 뜨는 크기와 같은 방식(메인 프로세스가 디스크에 저장)으로 opacity·최소화
 *  여부를 저장한다 — IPC 응답이 오기 전까지 잠깐 보일 기본값. */
const DEFAULT_OPACITY = 35;

const dragStyle = { WebkitAppRegion: 'drag' } as React.CSSProperties;
const noDragStyle = { WebkitAppRegion: 'no-drag' } as React.CSSProperties;

/** 위젯 끄기 + 배경 반투명도 조절 버튼. 카드 헤더 오른쪽 끝에 둔다. */
function WidgetControls({
  opacity,
  onOpacityChange,
  minimized,
  onToggleMinimize,
  showMinimizeToggle = true,
}: {
  opacity: number;
  onOpacityChange: (value: number) => void;
  minimized: boolean;
  onToggleMinimize: () => void;
  showMinimizeToggle?: boolean;
}) {
  const [showSlider, setShowSlider] = useState(false);

  return (
    <div style={noDragStyle} className="relative flex shrink-0 items-center gap-1">
      {showMinimizeToggle && (
        <button
          type="button"
          onClick={onToggleMinimize}
          title={minimized ? '전체 시간표 보기' : '최소화'}
          aria-label={minimized ? '전체 시간표 보기' : '최소화'}
          className="flex h-5 w-5 items-center justify-center rounded text-xs text-white/80 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] hover:bg-white/15 hover:text-white"
        >
          {minimized ? '⤢' : '－'}
        </button>
      )}
      <button
        type="button"
        onClick={() => setShowSlider((v) => !v)}
        title="배경 진하기 조절"
        aria-label="배경 진하기 조절"
        className="flex h-5 w-5 items-center justify-center rounded text-xs text-white/80 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] hover:bg-white/15 hover:text-white"
      >
        ⚙
      </button>
      <button
        type="button"
        onClick={() => void window.miyo.hideWidget()}
        title="위젯 끄기"
        aria-label="위젯 끄기"
        className="flex h-5 w-5 items-center justify-center rounded text-xs text-white/80 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] hover:bg-white/15 hover:text-white"
      >
        ✕
      </button>

      {showSlider && (
        <div className="absolute right-0 top-6 z-10 flex items-center gap-2 rounded-lg bg-black/70 px-2 py-1.5 shadow-lg">
          <span className="text-[10px] text-white/70">투명</span>
          <input
            type="range"
            min={15}
            max={90}
            value={opacity}
            onChange={(e) => onOpacityChange(Number(e.target.value))}
            className="h-1 w-20 accent-mint-400"
          />
          <span className="text-[10px] text-white/70">진하게</span>
        </div>
      )}
    </div>
  );
}

/** 로딩·안내 화면 공통 껍데기. 데이터가 안 불러와지는 상황에서도 위젯을 끄거나
 *  배경 진하기를 조절할 수 있도록 ⚙·✕ 버튼을 항상 함께 둔다.
 *  (App 안이 아니라 밖에 두어야 다시 그릴 때 내용이 초기화되지 않는다.) */
function Shell({
  opacity,
  onOpacityChange,
  minimized,
  onToggleMinimize,
  children,
}: {
  opacity: number;
  onOpacityChange: (value: number) => void;
  minimized: boolean;
  onToggleMinimize: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen flex-col p-1">
      <div
        style={{ backgroundColor: `rgba(0,0,0,${opacity / 100})` }}
        className="flex h-full min-h-0 flex-col rounded-2xl p-2"
      >
        <div style={dragStyle} className="flex shrink-0 justify-end">
          <WidgetControls
            opacity={opacity}
            onOpacityChange={onOpacityChange}
            minimized={minimized}
            onToggleMinimize={onToggleMinimize}
          />
        </div>
        {children}
      </div>
    </div>
  );
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [loginError, setLoginError] = useState('');
  const [result, setResult] = useState<AppDataResult | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [opacity, setOpacityState] = useState(DEFAULT_OPACITY);
  const [minimized, setMinimizedState] = useState(false);
  const [viewDate, setViewDate] = useState(() => new Date());

  function handleOpacityChange(value: number) {
    setOpacityState(value);
    void window.miyo.setOpacity(value);
  }

  function handleToggleMinimize() {
    const next = !minimized;
    setMinimizedState(next);
    void window.miyo.setMinimized(next);
  }

  function handlePrevDay() {
    setViewDate((d) => addWeekday(d, -1));
  }

  function handleNextDay() {
    setViewDate((d) => addWeekday(d, 1));
  }

  function handleGoToday() {
    setViewDate(new Date());
  }

  // opacity·최소화 여부는 메인 프로세스가 디스크에 저장해 둔 값이 원본이다(창 크기와
  // 같은 방식) — 시작 시 한 번 읽어와 화면에 반영한다. 창 자체의 높이는 이미
  // createWindow 시점에 같은 값으로 맞춰져 있으므로 여기서 다시 리사이즈를 요청할
  // 필요는 없다.
  useEffect(() => {
    void window.miyo.getWidgetPrefs().then((prefs) => {
      setOpacityState(prefs.opacity);
      setMinimizedState(prefs.minimized);
    });
  }, []);

  const cardStyle: React.CSSProperties = { backgroundColor: `rgba(0,0,0,${opacity / 100})` };

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    void window.miyo.getAuthState().then((s) => setLoggedIn(s.loggedIn));
    // 트레이 메뉴에서 로그인/로그아웃했거나 세션이 만료된 경우에도 화면이 따라가게 한다.
    return window.miyo.onAuthChanged((state) => {
      setLoggedIn(state.loggedIn);
      if (!state.loggedIn) setResult(null);
    });
  }, []);

  useEffect(() => {
    if (!loggedIn) return;
    void window.miyo.getAppData().then(setResult);
    return window.miyo.onAppDataUpdated(setResult);
  }, [loggedIn]);

  async function handleLogin() {
    setLoginError('');
    const res = await window.miyo.login();
    if (res.ok) setLoggedIn(true);
    else setLoginError(res.error || '로그인에 실패했어요.');
  }

  if (loggedIn === null) {
    return (
      <Shell
        opacity={opacity}
        onOpacityChange={handleOpacityChange}
        minimized={minimized}
        onToggleMinimize={handleToggleMinimize}
      >
        <div style={dragStyle} className="flex flex-1 items-center justify-center text-xs text-white/70 drop-shadow">
          불러오는 중...
        </div>
      </Shell>
    );
  }

  if (!loggedIn) {
    return (
      <Shell
        opacity={opacity}
        onOpacityChange={handleOpacityChange}
        minimized={minimized}
        onToggleMinimize={handleToggleMinimize}
      >
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-4 text-center">
          <p className="text-sm font-semibold text-white drop-shadow">로그인이 필요해요</p>
          <button
            type="button"
            style={noDragStyle}
            onClick={handleLogin}
            className="rounded-xl bg-mint-500 px-4 py-2 text-xs font-semibold text-white hover:bg-mint-600"
          >
            구글로 로그인
          </button>
          {loginError && <p className="text-[11px] text-rose-200">{loginError}</p>}
        </div>
      </Shell>
    );
  }

  const data = result?.data;
  if (!data) {
    return (
      <Shell
        opacity={opacity}
        onOpacityChange={handleOpacityChange}
        minimized={minimized}
        onToggleMinimize={handleToggleMinimize}
      >
        <div style={dragStyle} className="flex flex-1 items-center justify-center text-xs text-white/70 drop-shadow">
          데이터를 불러오는 중...
        </div>
      </Shell>
    );
  }

  const { settings, timetable, swapOverrides, canceledLessons, makeupLessons, subjectColors } = data;
  const phase = getDayPhase(now, settings.periodTimes, settings.periodCount);
  const viewDateKey = format(viewDate, 'yyyy-MM-dd');
  const isToday = viewDateKey === format(now, 'yyyy-MM-dd');
  const colors = buildSubjectColors(timetable, subjectColors);

  // 주말은 시간표 데이터 자체가 없어 최소화 여부와 무관하게 항상 메시지만 보여준다.
  // 최소화는 "지금 이 순간" 기준 요약이라 다른 날짜를 보는 중에는 의미가 없으므로,
  // 오늘이 아닐 때는 저장된 선호와 무관하게 항상 전체 시간표로 본다.
  const isWeekendView = viewDate.getDay() === 0 || viewDate.getDay() === 6;
  const effectiveMinimized = isToday && minimized;
  const showDashboard = !isWeekendView && !effectiveMinimized;

  const currentSlot =
    phase.kind === 'period' ? effectiveSlot(timetable, swapOverrides, viewDateKey, phase.index) : undefined;
  const compactMessage = showDashboard ? '' : getPhaseMessage(phase, settings.periodTimes, currentSlot);
  const nextIndex = showDashboard ? null : getNextPeriodIndex(phase, settings.periodCount);
  const nextSlot = nextIndex !== null ? effectiveSlot(timetable, swapOverrides, viewDateKey, nextIndex) : null;
  const nextTime = nextIndex !== null ? settings.periodTimes[nextIndex] : null;

  return (
    <div className="flex h-screen flex-col p-1 text-white">
      <div style={cardStyle} className="flex h-full min-h-0 flex-col rounded-2xl p-2">
        <div style={dragStyle} className="mb-1 flex shrink-0 items-center justify-between px-2 py-1">
          <div style={noDragStyle} className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={handlePrevDay}
              title="이전 평일"
              aria-label="이전 평일"
              className="flex h-5 w-5 items-center justify-center rounded text-xs text-white/80 hover:bg-white/15 hover:text-white"
            >
              ‹
            </button>
            <div className="flex flex-col items-center">
              <p className="text-sm font-bold drop-shadow">{format(viewDate, 'M월 d일 (EEE)', { locale: ko })}</p>
              {!isToday && (
                <button
                  type="button"
                  onClick={handleGoToday}
                  className="text-[10px] font-medium text-mint-300 underline hover:text-mint-200"
                >
                  오늘로
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={handleNextDay}
              title="다음 평일"
              aria-label="다음 평일"
              className="flex h-5 w-5 items-center justify-center rounded text-xs text-white/80 hover:bg-white/15 hover:text-white"
            >
              ›
            </button>
          </div>
          <div className="flex items-center gap-2">
            {result?.offline && <span className="text-[10px] text-amber-300">● 오프라인</span>}
            <WidgetControls
              opacity={opacity}
              onOpacityChange={handleOpacityChange}
              minimized={minimized}
              onToggleMinimize={handleToggleMinimize}
              showMinimizeToggle={isToday}
            />
          </div>
        </div>

        {showDashboard ? (
          <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto px-1 py-0.5">
            {Array.from({ length: settings.periodCount }, (_, i) => {
              const slot = effectiveSlot(timetable, swapOverrides, viewDateKey, i);
              const isCanceled = canceledLessons.some((c) => c.date === viewDateKey && c.period === i);
              const makeup = makeupLessons.find((m) => m.date === viewDateKey && m.period === i);
              const isCurrent = isToday && phase.kind === 'period' && phase.index === i;
              const color = slot.subject.trim() ? colors.get(classColorKey(slot.subject, slot.room)) : undefined;
              return (
                <li key={i} className="flex items-center gap-2">
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold ${
                      isCurrent ? 'bg-mint-500 text-white' : 'bg-white/20 text-white/80'
                    }`}
                  >
                    {i + 1}
                  </span>
                  <div
                    className={`relative flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 overflow-hidden rounded-lg px-1 text-center ${
                      isCurrent ? 'ring-2 ring-inset ring-mint-300' : ''
                    } ${isCanceled ? 'bg-white/10 opacity-60' : color ? color.bg : 'bg-white/10'}`}
                  >
                    {isCanceled && (
                      <span className="absolute right-1 top-0.5 rounded bg-white/30 px-1 text-[9px] font-bold text-white">
                        휴강
                      </span>
                    )}
                    <span
                      className={`w-full truncate text-xs font-medium drop-shadow ${
                        isCanceled ? 'text-white/50 line-through' : color ? color.text : 'text-white'
                      }`}
                    >
                      {slot.subject || '미배정'}
                    </span>
                    {slot.room && (
                      <span
                        className={`w-full truncate text-[11px] opacity-80 ${
                          isCanceled ? 'text-white/50' : color ? color.text : 'text-white/70'
                        }`}
                      >
                        {slot.room}
                      </span>
                    )}
                    {makeup && (
                      <span className="w-full truncate rounded bg-violet-400/30 px-1 text-[10px] font-medium text-violet-100">
                        보강 · {makeup.subject}
                        {makeup.room ? ` ${makeup.room}` : ''}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-1 p-4 text-center">
            <p className="text-sm text-white/90 drop-shadow">{compactMessage}</p>
            {nextIndex !== null && nextSlot && (
              <p className="text-xs text-white/70 drop-shadow">
                다음 · {nextIndex + 1}교시 {nextSlot.subject || '미배정'}
                {nextSlot.room ? ` ${nextSlot.room}` : ''}
                {nextTime ? ` (${nextTime.start}~${nextTime.end})` : ''}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
