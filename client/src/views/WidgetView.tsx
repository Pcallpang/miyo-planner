import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useApp } from '../context/AppContext';
import { useData } from '../context/DataContext';
import { getDayPhase } from '../lib/schedule';
import { effectiveSlot } from '../lib/subjectProgress';
import { buildSubjectColors, classColorKey } from '../lib/subjectColors';
import { setWidgetSize } from '../lib/widgetPrefs';

/** "?widget=1"로 열린 팝업 창에서 보여주는 오늘의 시간표 미니 위젯. Sidebar/Header
 *  없이 이것만 렌더된다(App.tsx 참고). 카드는 글래스모피즘(반투명 + 블러)으로
 *  고정 스타일이라 별도 배경 진하기 설정은 없다. */
export default function WidgetView() {
  const { settings } = useApp();
  const { data, refetch } = useData();
  const [now, setNow] = useState(() => new Date());

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
      setWidgetSize({ width: window.innerWidth, height: window.innerHeight });
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const phase = getDayPhase(now, settings.periodTimes, settings.periodCount);
  const todayKey = format(now, 'yyyy-MM-dd');
  const subjectColors = buildSubjectColors(data.timetable, data.subjectColors);

  let shortMessage = '';
  if (phase.kind === 'weekend') shortMessage = '주말이에요. 편안한 하루 보내세요.';
  else if (phase.kind === 'before')
    shortMessage = `아직 일과 전이에요. 오늘 일과는 ${settings.periodTimes[0]?.start ?? ''}에 시작해요.`;
  else if (phase.kind === 'after') shortMessage = '오늘 일과가 끝났어요. 수고하셨어요!';

  return (
    <div className="flex h-screen flex-col bg-gradient-to-br from-mint-200 via-sky-100 to-violet-100 p-3">
      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-white/60 bg-white/35 p-4 shadow-xl backdrop-blur-xl">
        <p className="mb-2 shrink-0 text-sm font-bold text-slate-700">
          {format(now, 'M월 d일 (EEE)', { locale: ko })}
        </p>

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
                    isCurrent ? 'bg-white/50 ring-1 ring-mint-300/70' : ''
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
