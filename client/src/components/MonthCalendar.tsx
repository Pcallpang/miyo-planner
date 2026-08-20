import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { eventsOnDay } from '../lib/events';
import { getHoliday } from '../lib/holidays';
import { WEEKDAY_LABELS } from '../lib/schedule';
import type { GEvent, SchoolScheduleItem } from '../types';

interface Props {
  month: Date;
  onMonthChange: (m: Date) => void;
  selected: Date;
  onSelect: (d: Date) => void;
  events: GEvent[];
  weekStartsOn: 0 | 1;
  /** true면 칩 대신 점으로 표시 (좁은 영역용) */
  compact?: boolean;
  /** 사용자 지정 휴일(재량휴업일 등). YYYY-MM-DD → 라벨 */
  holidays?: Record<string, string>;
  /** 나이스 학사일정 겹쳐보기 (비어 있으면 표시하지 않음) */
  schoolSchedule?: SchoolScheduleItem[];
}

export default function MonthCalendar({
  month,
  onMonthChange,
  selected,
  onSelect,
  events,
  weekStartsOn,
  compact = false,
  holidays,
  schoolSchedule,
}: Props) {
  const scheduleByDay = new Map<string, SchoolScheduleItem[]>();
  for (const item of schoolSchedule ?? []) {
    const list = scheduleByDay.get(item.date);
    if (list) list.push(item);
    else scheduleByDay.set(item.date, [item]);
  }

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn }),
  });
  const weekdayHeader = [...Array(7)].map((_, i) => WEEKDAY_LABELS[(weekStartsOn + i) % 7]);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onMonthChange(addMonths(month, -1))}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="이전 달"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="min-w-28 text-center text-base font-bold text-slate-700">
            {format(month, 'yyyy년 M월')}
          </span>
          <button
            onClick={() => onMonthChange(addMonths(month, 1))}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="다음 달"
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <button
          onClick={() => {
            const today = new Date();
            onMonthChange(today);
            onSelect(today);
          }}
          className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-500 transition hover:border-mint-300 hover:text-mint-600"
        >
          오늘
        </button>
      </div>

      <div className="grid grid-cols-7 text-center text-xs font-medium text-slate-400">
        {weekdayHeader.map((w) => (
          <div key={w} className={`py-1.5 ${w === '일' ? 'text-rose-400' : w === '토' ? 'text-sky-400' : ''}`}>
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const dayEvents = eventsOnDay(events, day);
          const inMonth = isSameMonth(day, month);
          const isSel = isSameDay(day, selected);
          const dow = day.getDay();
          const dayKey = format(day, 'yyyy-MM-dd');
          const holiday = getHoliday(dayKey, holidays);
          const isCustomHoliday = Boolean(holidays?.[dayKey]);
          const daySchedule = scheduleByDay.get(dayKey) ?? [];
          // 날짜 숫자 색상: 공휴일·일요일 → 빨강, 토요일 → 파랑
          const numColor = !inMonth
            ? 'text-slate-300'
            : holiday || dow === 0
              ? 'text-rose-500'
              : dow === 6
                ? 'text-sky-500'
                : 'text-slate-600';
          return (
            <button
              key={day.toISOString()}
              onClick={() => onSelect(day)}
              className={`relative flex flex-col items-stretch rounded-xl border p-1.5 text-left transition ${
                isSel
                  ? 'border-mint-400 bg-mint-50'
                  : 'border-transparent hover:border-slate-200 hover:bg-slate-50'
              } ${compact ? 'min-h-14' : 'min-h-24'}`}
            >
              <div className="flex items-start justify-between">
                <span
                  className={`grid h-6 w-6 place-items-center rounded-full text-xs font-semibold ${
                    isToday(day) ? 'bg-mint-500 text-white' : numColor
                  }`}
                >
                  {format(day, 'd')}
                </span>
                {holiday && (
                  <span
                    className={`max-w-[64px] truncate pt-0.5 text-[10px] font-medium ${
                      isCustomHoliday ? 'text-rose-400' : 'text-rose-500'
                    }`}
                    title={holiday}
                  >
                    {holiday}
                  </span>
                )}
              </div>
              {compact ? (
                <span className="mt-1 flex justify-center gap-0.5">
                  {daySchedule.length > 0 && (
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  )}
                  {dayEvents.slice(0, 3).map((ev) => (
                    <span key={ev.id} className="h-1.5 w-1.5 rounded-full bg-mint-400" />
                  ))}
                </span>
              ) : (
                <span className="mt-1 flex flex-col gap-0.5 overflow-hidden">
                  {/* 학사일정은 학교가 정한 일정이라 내 일정보다 위에 둔다 */}
                  {daySchedule.slice(0, 2).map((s, i) => (
                    <span
                      key={`s-${i}`}
                      title={s.content || s.name}
                      className={`truncate rounded-md px-1.5 py-0.5 text-[11px] font-medium ${
                        s.noClass ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {s.name}
                    </span>
                  ))}
                  {dayEvents.slice(0, daySchedule.length > 0 ? 1 : 2).map((ev) => (
                    <span
                      key={ev.id}
                      className="truncate rounded-md bg-mint-100 px-1.5 py-0.5 text-[11px] font-medium text-mint-800"
                    >
                      {ev.title}
                    </span>
                  ))}
                  {(() => {
                    const shownSchedule = Math.min(daySchedule.length, 2);
                    const shownEvents = Math.min(dayEvents.length, daySchedule.length > 0 ? 1 : 2);
                    const hiddenNames = [
                      ...daySchedule.slice(shownSchedule).map((s) => s.name),
                      ...dayEvents.slice(shownEvents).map((ev) => ev.title),
                    ];
                    // 칸이 좁아 접었을 뿐이니, 무엇이 숨었는지는 마우스를 올리면 보이게 한다
                    return hiddenNames.length > 0 ? (
                      <span
                        className="px-1 text-[10px] text-slate-400"
                        title={hiddenNames.join(', ')}
                      >
                        +{hiddenNames.length}건
                      </span>
                    ) : null;
                  })()}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
