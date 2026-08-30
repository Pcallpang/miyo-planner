import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { getDayPhase } from './lib/schedule';
import { effectiveSlot } from './lib/scheduleSlot';
import { buildSubjectColors, classColorKey } from './lib/subjectColors';
import { getOpacity, setOpacity } from './lib/widgetPrefs';
import type { AppDataResult } from './miyo';

const dragStyle = { WebkitAppRegion: 'drag' } as React.CSSProperties;
const noDragStyle = { WebkitAppRegion: 'no-drag' } as React.CSSProperties;

/** 위젯 끄기 + 배경 반투명도 조절 버튼. 카드 헤더 오른쪽 끝에 둔다. */
function WidgetControls({
  opacity,
  onOpacityChange,
}: {
  opacity: number;
  onOpacityChange: (value: number) => void;
}) {
  const [showSlider, setShowSlider] = useState(false);

  return (
    <div style={noDragStyle} className="relative flex shrink-0 items-center gap-1">
      <button
        type="button"
        onClick={() => setShowSlider((v) => !v)}
        title="배경 진하기 조절"
        aria-label="배경 진하기 조절"
        className="flex h-5 w-5 items-center justify-center rounded text-xs text-white/60 hover:bg-white/15 hover:text-white"
      >
        ⚙
      </button>
      <button
        type="button"
        onClick={() => void window.miyo.hideWidget()}
        title="위젯 끄기"
        aria-label="위젯 끄기"
        className="flex h-5 w-5 items-center justify-center rounded text-xs text-white/60 hover:bg-white/15 hover:text-white"
      >
        ✕
      </button>

      {showSlider && (
        <div className="absolute right-0 top-6 z-10 flex items-center gap-2 rounded-lg bg-black/70 px-2 py-1.5 shadow-lg">
          <span className="text-[10px] text-white/70">투명</span>
          <input
            type="range"
            min={0}
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

export default function App() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [loginError, setLoginError] = useState('');
  const [result, setResult] = useState<AppDataResult | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [opacity, setOpacityState] = useState(() => getOpacity());

  function handleOpacityChange(value: number) {
    setOpacityState(value);
    setOpacity(value);
  }

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
      <div className="flex h-screen flex-col p-1">
        <div
          style={{ ...dragStyle, ...cardStyle }}
          className="flex h-full items-center justify-center rounded-2xl text-xs text-white/70"
        >
          불러오는 중...
        </div>
      </div>
    );
  }

  if (!loggedIn) {
    return (
      <div className="flex h-screen flex-col p-1">
        <div style={cardStyle} className="flex h-full flex-col rounded-2xl p-2">
          <div style={dragStyle} className="flex shrink-0 justify-end">
            <WidgetControls opacity={opacity} onOpacityChange={handleOpacityChange} />
          </div>
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
        </div>
      </div>
    );
  }

  const data = result?.data;
  if (!data) {
    return (
      <div className="flex h-screen flex-col p-1">
        <div
          style={{ ...dragStyle, ...cardStyle }}
          className="flex h-full items-center justify-center rounded-2xl text-xs text-white/70 drop-shadow"
        >
          데이터를 불러오는 중...
        </div>
      </div>
    );
  }

  const { settings, timetable, swapOverrides, canceledLessons, makeupLessons, subjectColors } = data;
  const phase = getDayPhase(now, settings.periodTimes, settings.periodCount);
  const todayKey = format(now, 'yyyy-MM-dd');
  const colors = buildSubjectColors(timetable, subjectColors);

  let shortMessage = '';
  if (phase.kind === 'weekend') shortMessage = '주말이에요. 편안한 하루 보내세요.';
  else if (phase.kind === 'before') shortMessage = `아직 일과 전이에요. ${settings.periodTimes[0]?.start ?? ''}에 시작해요.`;
  else if (phase.kind === 'after') shortMessage = '오늘 일과가 끝났어요. 수고하셨어요!';

  return (
    <div className="flex h-screen flex-col p-1 text-white">
      <div style={cardStyle} className="flex h-full min-h-0 flex-col rounded-2xl p-2">
        <div style={dragStyle} className="mb-1 flex shrink-0 items-center justify-between px-2 py-1">
          <p className="text-sm font-bold drop-shadow">{format(now, 'M월 d일 (EEE)', { locale: ko })}</p>
          <div className="flex items-center gap-2">
            {result?.offline && <span className="text-[10px] text-amber-300">● 오프라인</span>}
            <WidgetControls opacity={opacity} onOpacityChange={handleOpacityChange} />
          </div>
        </div>

        {shortMessage ? (
          <p className="flex flex-1 items-center justify-center text-center text-sm text-white/90 drop-shadow">
            {shortMessage}
          </p>
        ) : (
          <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto px-1">
            {Array.from({ length: settings.periodCount }, (_, i) => {
              const slot = effectiveSlot(timetable, swapOverrides, todayKey, i);
              const isCanceled = canceledLessons.some((c) => c.date === todayKey && c.period === i);
              const makeup = makeupLessons.find((m) => m.date === todayKey && m.period === i);
              const isCurrent = phase.kind === 'period' && phase.index === i;
              const time = settings.periodTimes[i];
              const color = slot.subject.trim() ? colors.get(classColorKey(slot.subject, slot.room)) : undefined;
              return (
                <li
                  key={i}
                  className={`flex items-center gap-2 rounded-xl px-2 py-1.5 ${isCurrent ? 'bg-white/25 ring-1 ring-white/40' : ''}`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold ${
                      isCurrent ? 'bg-mint-500 text-white' : 'bg-white/20 text-white/80'
                    }`}
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate text-sm font-medium drop-shadow ${
                        isCanceled ? 'text-white/50 line-through' : color ? color.text : 'text-white'
                      }`}
                    >
                      {slot.subject || '미배정'}
                      {slot.room ? ` · ${slot.room}` : ''}
                    </p>
                    {makeup && (
                      <p className="truncate text-[11px] font-medium text-violet-200">
                        보강 · {makeup.subject}
                        {makeup.room ? ` ${makeup.room}` : ''}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-[11px] text-white/70">
                    {time?.start}~{time?.end}
                  </span>
                  {isCanceled && (
                    <span className="shrink-0 rounded bg-white/30 px-1 text-[9px] font-bold text-white">휴강</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
