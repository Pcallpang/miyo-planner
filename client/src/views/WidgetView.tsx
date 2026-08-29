import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Settings as SettingsIcon } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useData } from '../context/DataContext';
import { getDayPhase } from '../lib/schedule';
import { effectiveSlot } from '../lib/subjectProgress';
import { buildSubjectColors, classColorKey } from '../lib/subjectColors';
import { getWidgetOpacity, setWidgetOpacity, setWidgetSize } from '../lib/widgetPrefs';

/** "?widget=1"로 열린 팝업 창에서 보여주는 오늘의 시간표 미니 위젯. Sidebar/Header
 *  없이 이것만 렌더된다(App.tsx 참고). */
export default function WidgetView() {
  const { settings } = useApp();
  const { data, refetch } = useData();
  const [now, setNow] = useState(() => new Date());
  const [opacity, setOpacity] = useState(() => getWidgetOpacity());
  const [showSettings, setShowSettings] = useState(false);

  // 시계 갱신(1분마다) — 지금 진행 중인 교시 강조에 쓴다.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  // 창에 다시 포커스가 갈 때 + 5분마다, 메인 탭에서 바뀐 시간표를 다시 불러온다.
  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') void refetch();
    }
    document.addEventListener('visibilitychange', onVisibilityChange);
    const id = setInterval(() => void refetch(), 5 * 60_000);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      clearInterval(id);
    };
  }, [refetch]);

  // 창을 닫는 순간의 크기를 기억해 뒀다가, 다음에 열 때 그 크기로 연다.
  useEffect(() => {
    function handleBeforeUnload() {
      setWidgetSize({ width: window.outerWidth, height: window.outerHeight });
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  function handleOpacityChange(value: number) {
    setOpacity(value);
    setWidgetOpacity(value);
  }

  const phase = getDayPhase(now, settings.periodTimes, settings.periodCount);
  const todayKey = format(now, 'yyyy-MM-dd');
  const subjectColors = buildSubjectColors(data.timetable, data.subjectColors);

  let shortMessage = '';
  if (phase.kind === 'weekend') shortMessage = '주말이에요. 편안한 하루 보내세요.';
  else if (phase.kind === 'before')
    shortMessage = `아직 일과 전이에요. 오늘 일과는 ${settings.periodTimes[0]?.start ?? ''}에 시작해요.`;
  else if (phase.kind === 'after') shortMessage = '오늘 일과가 끝났어요. 수고하셨어요!';

  return (
    <div className="flex h-screen flex-col bg-mint-50 p-3">
      <div
        className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl p-4 shadow-sm ring-1 ring-slate-100"
        style={{ background: `rgba(255,255,255,${opacity / 100})` }}
      >
        <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
          <p className="text-sm font-bold text-slate-700">{format(now, 'M월 d일 (EEE)', { locale: ko })}</p>
          <button
            type="button"
            onClick={() => setShowSettings((v) => !v)}
            aria-label="위젯 설정"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <SettingsIcon size={16} />
          </button>
        </div>

        {showSettings && (
          <div className="mb-2 flex shrink-0 items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
            <span className="shrink-0 text-[11px] text-slate-500">배경 진하기</span>
            <input
              type="range"
              min={0}
              max={100}
              value={opacity}
              onChange={(e) => handleOpacityChange(Number(e.target.value))}
              className="flex-1"
            />
            <span className="w-8 shrink-0 text-right text-[11px] text-slate-400">{opacity}%</span>
          </div>
        )}

        {shortMessage ? (
          <p className="flex flex-1 items-center justify-center text-center text-sm text-slate-500">
            {shortMessage}
          </p>
        ) : (
          <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto">
            {Array.from({ length: settings.periodCount }, (_, i) => {
              const slot = effectiveSlot(data.timetable, data.swapOverrides, todayKey, i);
              const isCanceled = data.canceledLessons.some((c) => c.date === todayKey && c.period === i);
              const makeup = data.makeupLessons.find((m) => m.date === todayKey && m.period === i);
              const isCurrent = phase.kind === 'period' && phase.index === i;
              const time = settings.periodTimes[i];
              const color = slot.subject.trim()
                ? subjectColors.get(classColorKey(slot.subject, slot.room))
                : undefined;
              return (
                <li
                  key={i}
                  className={`flex items-center gap-2 rounded-xl px-2.5 py-1.5 ${
                    isCurrent ? 'bg-mint-100 ring-1 ring-mint-300' : ''
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold ${
                      isCurrent ? 'bg-mint-500 text-white' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate text-sm font-medium ${
                        isCanceled ? 'text-slate-400 line-through' : color ? color.text : 'text-slate-600'
                      }`}
                    >
                      {slot.subject || '미배정'}
                      {slot.room ? ` · ${slot.room}` : ''}
                    </p>
                    {makeup && (
                      <p className="truncate text-[11px] font-medium text-violet-600">
                        보강 · {makeup.subject}
                        {makeup.room ? ` ${makeup.room}` : ''}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-[11px] text-slate-400">
                    {time?.start}~{time?.end}
                  </span>
                  {isCanceled && (
                    <span className="shrink-0 rounded bg-slate-400 px-1 text-[9px] font-bold text-white">휴강</span>
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
