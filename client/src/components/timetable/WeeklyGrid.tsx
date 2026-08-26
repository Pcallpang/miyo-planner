import { useEffect, useState } from 'react';
import { addDays, format, startOfWeek } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../../lib/api';
import { useApp } from '../../context/AppContext';
import { useData } from '../../context/DataContext';
import { getDayPhase } from '../../lib/schedule';
import { effectiveSlot } from '../../lib/subjectProgress';
import { buildSubjectColors } from '../../lib/subjectColors';
import TimetableCellModal from './TimetableCellModal';
import SwapConfirmModal from './SwapConfirmModal';
import type { SchoolScheduleItem, Timetable } from '../../types';

const WEEKDAYS = [
  { day: 1, label: '월' },
  { day: 2, label: '화' },
  { day: 3, label: '수' },
  { day: 4, label: '목' },
  { day: 5, label: '금' },
];

/** 지필평가 기간은 등교는 하지만 정상 수업이 없다 — 나이스는 이런 날을 noClass로
 *  표시하지 않으므로 이름으로 따로 찾아야 한다. 공휴일·재량휴업일 등은 noClass로 잡힌다. */
const AUTO_CANCEL_EXAM_KEYWORDS = ['중간고사', '기말고사', '지필'];

interface Cell {
  day: number;
  period: number;
}

/**
 * 시간표는 여전히 요일별 반복 패턴(Timetable)으로 저장한다. 여기서 다루는 "주"는
 * 나이스 학사일정을 겹쳐 보여주기 위한 화면 전용 상태일 뿐, 저장되지 않는다.
 */
export default function WeeklyGrid() {
  const { settings } = useApp();
  const { data, update } = useData();
  const timetable = data.timetable;
  const canceledLessons = data.canceledLessons;
  const swapOverrides = data.swapOverrides;
  const makeupLessons = data.makeupLessons;
  const setTimetable = (updater: (prev: Timetable) => Timetable) =>
    update((prev) => ({ timetable: updater(prev.timetable) }));

  /** 반복 시간표(timetable)와 그 날짜만의 교환 예외(swapOverrides)를 합쳐, 실제로
   *  화면에 보여줄 내용을 계산한다. */
  const slotAt = (dateKey: string, period: number) => effectiveSlot(timetable, swapOverrides, dateKey, period);

  /**
   * 학교 행사 등으로 특정 날짜 하나만 휴강 처리하거나, 휴강을 다시 취소한다. 그 (과목, 반)의
   * 차시 계획표 총 차시도 바로 ±1 반영한다 — 정확한 값은 차시 계획표의 계산 버튼을 다시
   * 누르면 언제든 학사일정 기준으로 재계산된다.
   */
  function toggleCanceled(dateKey: string, period: number, subject: string, className: string) {
    update((prev) => {
      const exists = prev.canceledLessons.some((c) => c.date === dateKey && c.period === period);
      const delta = exists ? 1 : -1;
      return {
        canceledLessons: exists
          ? prev.canceledLessons.filter((c) => !(c.date === dateKey && c.period === period))
          : [...prev.canceledLessons, { date: dateKey, period }],
        subjectProgress: prev.subjectProgress.map((p) =>
          p.subject === subject && p.className === className
            ? { ...p, totalLessons: Math.max(0, p.totalLessons + delta) }
            : p,
        ),
      };
    });
  }

  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [schoolSchedule, setSchoolSchedule] = useState<SchoolScheduleItem[]>([]);
  const [dragging, setDragging] = useState<Cell | null>(null);
  const [editing, setEditing] = useState<Cell | null>(null);
  const [pendingSwap, setPendingSwap] = useState<{ a: Cell; b: Cell } | null>(null);

  const now = new Date();
  const todayKey = format(now, 'yyyy-MM-dd');
  const isThisWeek = format(weekStart, 'yyyy-MM-dd') === format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const phase = getDayPhase(now, settings.periodTimes, settings.periodCount);
  const currentPeriod = phase.kind === 'period' ? phase.index : -1;

  const subjectColors = buildSubjectColors(timetable, data.subjectColors);

  useEffect(() => {
    let cancelled = false;
    if (!settings.school) {
      setSchoolSchedule([]);
      return;
    }
    const from = format(weekStart, 'yyyy-MM-dd');
    const to = format(addDays(weekStart, 4), 'yyyy-MM-dd');
    api
      .schoolSchedule(settings.school, from, to)
      .then((r) => {
        if (!cancelled) setSchoolSchedule(r.schedule);
      })
      .catch(() => {
        if (!cancelled) setSchoolSchedule([]);
      });
    return () => {
      cancelled = true;
    };
  }, [settings.school, weekStart]);

  // 그 주의 날짜(YYYY-MM-DD) → 그날 학사일정 이름 전부(쉼표로 이어붙임). 요일 헤더에 표시한다.
  const holidayByDate = new Map<string, string>();
  for (const item of schoolSchedule) {
    const prev = holidayByDate.get(item.date);
    holidayByDate.set(item.date, prev ? `${prev}, ${item.name}` : item.name);
  }

  // 공휴일·대체공휴일·재량휴업일(noClass) + 지필평가 기간은 정상 수업이 없으니 자동으로
  // 휴강 표시한다. 수동 "이 날짜만 휴강"과 달리 기록을 남기지 않고 매번 계산만 한다.
  const autoCanceledDates = new Set<string>();
  for (const item of schoolSchedule) {
    if (item.noClass || AUTO_CANCEL_EXAM_KEYWORDS.some((k) => item.name.includes(k))) {
      autoCanceledDates.add(item.date);
    }
  }

  /** 한 칸의 과목·교실을 한 번에 저장한다(모달 저장 시 사용). */
  function saveCell(day: number, index: number, subject: string, room: string) {
    setTimetable((prev) => {
      const daySlots = [...(prev[day] ?? [])];
      while (daySlots.length <= index) daySlots.push({ subject: '', room: '' });
      daySlots[index] = { subject, room };
      return { ...prev, [day]: daySlots };
    });
  }

  /** 두 칸의 내용을 반복 시간표(timetable) 자체에서 서로 맞바꾼다 — 처음 시간표를
   *  짤 때처럼 앞으로 모든 주에 똑같이 반영돼야 할 때 쓴다. 빈 칸으로 옮기면 자연히
   *  "이동"이 되고, 채워진 칸끼리는 자리를 바꿔 데이터가 사라지지 않는다. */
  function swapTemplate(a: Cell, b: Cell) {
    if (a.day === b.day && a.period === b.period) return;
    setTimetable((prev) => {
      const next = { ...prev };
      const aSlots = [...(next[a.day] ?? [])];
      const bSlots = a.day === b.day ? aSlots : [...(next[b.day] ?? [])];
      while (aSlots.length <= a.period) aSlots.push({ subject: '', room: '' });
      while (bSlots.length <= b.period) bSlots.push({ subject: '', room: '' });
      const tmp = aSlots[a.period];
      aSlots[a.period] = bSlots[b.period];
      bSlots[b.period] = tmp;
      next[a.day] = aSlots;
      next[b.day] = bSlots;
      return next;
    });
  }

  /** 지금 이 주, 이 두 칸에서 실제로 보이는 내용을 서로 맞바꾸되, 반복 시간표는
   *  건드리지 않고 그 두 (date, period)에만 예외를 남긴다 — 다른 반/다른 선생님
   *  수업과 이 날짜만 교환하는 경우(빈 칸으로 옮기는 경우 포함)에 쓴다. 총 차시는
   *  두 칸이 자리만 맞바꾸는 것이라 순증감이 없고, 지난 날짜로 옮겨온 경우의 진행
   *  차시는 차시 계획표의 자동 따라잡기 효과가 swapOverrides 변경을 감지해 다시
   *  계산해준다. */
  function swapDateOnly(a: Cell, b: Cell) {
    if (a.day === b.day && a.period === b.period) return;
    const aDateKey = format(addDays(weekStart, a.day - 1), 'yyyy-MM-dd');
    const bDateKey = format(addDays(weekStart, b.day - 1), 'yyyy-MM-dd');
    const aSlot = slotAt(aDateKey, a.period);
    const bSlot = slotAt(bDateKey, b.period);
    update((prev) => ({
      swapOverrides: [
        ...prev.swapOverrides.filter(
          (o) => !(o.date === aDateKey && o.period === a.period) && !(o.date === bDateKey && o.period === b.period),
        ),
        { date: aDateKey, period: a.period, subject: bSlot.subject, room: bSlot.room },
        { date: bDateKey, period: b.period, subject: aSlot.subject, room: aSlot.room },
      ],
    }));
  }

  /** 교환한 칸 하나를 원래(반복 시간표 기준) 내용으로 되돌린다. 짝을 이루던 반대쪽
   *  칸의 예외는 그대로 둔다 — 칸마다 독립적으로 되돌릴 수 있다. */
  function revertSwap(dateKey: string, period: number) {
    update((prev) => ({
      swapOverrides: prev.swapOverrides.filter((o) => !(o.date === dateKey && o.period === period)),
    }));
  }

  /** 보강 수업을 저장한다. subject가 비어있으면 그 칸의 보강을 삭제한다. 차시
   *  계획표와는 전혀 연동하지 않는다 — 시간표 확인용 표시일 뿐이다. */
  function saveMakeup(dateKey: string, period: number, subject: string, room: string) {
    update((prev) => ({
      makeupLessons: [
        ...prev.makeupLessons.filter((m) => !(m.date === dateKey && m.period === period)),
        ...(subject.trim() ? [{ date: dateKey, period, subject: subject.trim(), room: room.trim() }] : []),
      ],
    }));
  }

  // 모달의 과목/반 입력창(타이핑 저장)은 항상 반복 시간표 원본을 보여주고 그걸 수정한다.
  // 휴강 판정·표시는 지금 실제로 보이는 내용(교환 반영) 기준이어야 한다.
  const editingTemplateSlot = editing
    ? (timetable[editing.day] ?? [])[editing.period] ?? { subject: '', room: '' }
    : null;
  const editingDateKey = editing ? format(addDays(weekStart, editing.day - 1), 'yyyy-MM-dd') : '';
  const editingEffectiveSlot = editing ? slotAt(editingDateKey, editing.period) : null;
  const editingTime = editing ? settings.periodTimes[editing.period] ?? { start: '', end: '' } : null;
  const editingLabel = editing ? WEEKDAYS.find((w) => w.day === editing.day)?.label : '';
  const editingCanceled = editing
    ? canceledLessons.some((c) => c.date === editingDateKey && c.period === editing.period)
    : false;
  const editingAutoCanceled = editing ? autoCanceledDates.has(editingDateKey) : false;
  const editingSwapped = editing
    ? swapOverrides.some((o) => o.date === editingDateKey && o.period === editing.period)
    : false;
  const editingMakeup = editing
    ? makeupLessons.find((m) => m.date === editingDateKey && m.period === editing.period)
    : undefined;

  /** 교환 확인창에 보여줄 "M/d(요일) N교시 · 과목 반" 라벨. 빈 칸이면 "(빈 시간)". */
  function cellLabel(cell: Cell): string {
    const dateKey = format(addDays(weekStart, cell.day - 1), 'yyyy-MM-dd');
    const dayLabel = WEEKDAYS.find((w) => w.day === cell.day)?.label ?? '';
    const slot = slotAt(dateKey, cell.period);
    const content = slot.subject.trim() ? `${slot.subject}${slot.room ? ` ${slot.room}` : ''}` : '(빈 시간)';
    return `${format(addDays(weekStart, cell.day - 1), 'M/d')}(${dayLabel}) ${cell.period + 1}교시 · ${content}`;
  }

  return (
    <section className="min-w-0 flex-1 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-slate-500">
          {format(weekStart, 'yyyy년 M월', { locale: ko })}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setWeekStart((d) => addDays(d, -7))}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="이전 주"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="min-w-28 text-center text-sm font-medium text-slate-600">
            {format(weekStart, 'M/d', { locale: ko })} ~ {format(addDays(weekStart, 4), 'M/d', { locale: ko })}
          </span>
          <button
            onClick={() => setWeekStart((d) => addDays(d, 7))}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="다음 주"
          >
            <ChevronRight size={16} />
          </button>
          <button
            onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
            className="ml-1 rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-500 transition hover:border-mint-300 hover:text-mint-600"
          >
            오늘
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-2xl table-fixed border-separate border-spacing-1 text-sm">
          <thead>
            <tr>
              <th className="w-10 pb-1 text-xs font-medium text-slate-400">교시</th>
              {WEEKDAYS.map(({ day, label }) => {
                const date = addDays(weekStart, day - 1);
                const dateKey = format(date, 'yyyy-MM-dd');
                const holiday = holidayByDate.get(dateKey);
                const isToday = isThisWeek && dateKey === todayKey;
                return (
                  <th key={day} className="pb-1 text-xs font-medium align-top">
                    <div className={isToday ? 'text-mint-600' : 'text-slate-500'}>
                      {label} {format(date, 'M/d')}
                    </div>
                    {/* 학사일정 이름이 길어도 2줄까지만 차지하도록 높이를 고정한다 —
                        그래야 교시 행들이 밀려 늘어나지 않는다. */}
                    <div className="mt-0.5 line-clamp-2 h-6 text-[10px] font-normal leading-3 text-rose-500" title={holiday}>
                      {holiday}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: settings.periodCount }, (_, i) => (
              <tr key={i}>
                <td className="text-center">
                  <span
                    className={`grid h-7 w-7 place-items-center rounded-lg text-xs font-bold ${
                      isThisWeek && i === currentPeriod ? 'bg-mint-500 text-white' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {i + 1}
                  </span>
                </td>
                {WEEKDAYS.map(({ day }) => {
                  const cellDateKey = format(addDays(weekStart, day - 1), 'yyyy-MM-dd');
                  const slot = slotAt(cellDateKey, i);
                  const isManualCanceled = canceledLessons.some((c) => c.date === cellDateKey && c.period === i);
                  const isAutoCanceled = autoCanceledDates.has(cellDateKey);
                  const isCanceled = isManualCanceled || isAutoCanceled;
                  const isSwapped = swapOverrides.some((o) => o.date === cellDateKey && o.period === i);
                  const makeup = makeupLessons.find((m) => m.date === cellDateKey && m.period === i);
                  const isDragging = dragging?.day === day && dragging?.period === i;
                  const isNow = isThisWeek && i === currentPeriod && cellDateKey === todayKey;
                  const color = slot.subject.trim() ? subjectColors.get(slot.subject.trim()) : undefined;
                  return (
                    <td
                      key={day}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (dragging && !(dragging.day === day && dragging.period === i)) {
                          setPendingSwap({ a: dragging, b: { day, period: i } });
                        }
                        setDragging(null);
                      }}
                      className={`rounded-lg p-1 align-top ${isNow ? 'ring-2 ring-mint-300' : ''}`}
                    >
                      <button
                        type="button"
                        draggable
                        onClick={() => setEditing({ day, period: i })}
                        onDragStart={() => setDragging({ day, period: i })}
                        onDragEnd={() => setDragging(null)}
                        className={`relative flex min-h-14 w-full cursor-grab flex-col items-center justify-center gap-0.5 rounded-lg p-1.5 text-center transition active:cursor-grabbing ${
                          isDragging ? 'opacity-40' : ''
                        } ${
                          isCanceled
                            ? 'bg-slate-100 opacity-60'
                            : color
                              ? `${color.bg} hover:brightness-95`
                              : 'bg-slate-50/70 hover:bg-slate-100'
                        }`}
                      >
                        {isSwapped && (
                          <span className="absolute left-1 top-1 rounded bg-sky-400 px-1 text-[9px] font-bold text-white">
                            교환
                          </span>
                        )}
                        {isCanceled && (
                          <span className="absolute right-1 top-1 rounded bg-slate-400 px-1 text-[9px] font-bold text-white">
                            휴강
                          </span>
                        )}
                        <span
                          className={`w-full truncate text-xs font-medium ${
                            isCanceled ? 'text-slate-400 line-through' : color ? color.text : 'text-slate-300'
                          }`}
                        >
                          {slot.subject || '미배정'}
                        </span>
                        {slot.room && (
                          <span
                            className={`w-full truncate text-[11px] opacity-80 ${
                              isCanceled ? 'text-slate-400' : color ? color.text : 'text-slate-400'
                            }`}
                          >
                            {slot.room}
                          </span>
                        )}
                        {makeup && (
                          <span className="w-full truncate rounded bg-violet-100 px-1 text-[10px] font-medium text-violet-700">
                            보강 · {makeup.subject}
                            {makeup.room ? ` ${makeup.room}` : ''}
                          </span>
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && editingTemplateSlot && editingEffectiveSlot && editingTime && (
        <TimetableCellModal
          dayLabel={editingLabel ?? ''}
          dateLabel={format(addDays(weekStart, editing.day - 1), 'M/d')}
          period={editing.period + 1}
          time={editingTime}
          subject={editingTemplateSlot.subject}
          room={editingTemplateSlot.room}
          canceled={editingCanceled}
          autoCanceled={editingAutoCanceled}
          swapped={editingSwapped}
          makeupSubject={editingMakeup?.subject ?? ''}
          makeupRoom={editingMakeup?.room ?? ''}
          onClose={() => setEditing(null)}
          onSave={(subject, room) => {
            saveCell(editing.day, editing.period, subject, room);
            setEditing(null);
          }}
          onToggleCancel={() =>
            toggleCanceled(
              editingDateKey,
              editing.period,
              editingEffectiveSlot.subject.trim(),
              editingEffectiveSlot.room.trim(),
            )
          }
          onRevertSwap={() => {
            revertSwap(editingDateKey, editing.period);
            setEditing(null);
          }}
          onSaveMakeup={(subject, room) => {
            saveMakeup(editingDateKey, editing.period, subject, room);
            setEditing(null);
          }}
        />
      )}

      {pendingSwap && (
        <SwapConfirmModal
          aLabel={cellLabel(pendingSwap.a)}
          bLabel={cellLabel(pendingSwap.b)}
          onCancel={() => setPendingSwap(null)}
          onApplyAll={() => {
            swapTemplate(pendingSwap.a, pendingSwap.b);
            setPendingSwap(null);
          }}
          onApplyOnce={() => {
            swapDateOnly(pendingSwap.a, pendingSwap.b);
            setPendingSwap(null);
          }}
        />
      )}
    </section>
  );
}
