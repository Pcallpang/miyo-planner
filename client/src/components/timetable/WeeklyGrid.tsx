import { Fragment, useEffect, useState } from 'react';
import { addDays, format, startOfWeek } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../../lib/api';
import { useApp } from '../../context/AppContext';
import { useData } from '../../context/DataContext';
import { getDayPhase } from '../../lib/schedule';
import { effectiveSlot } from '../../lib/subjectProgress';
import { buildSubjectColors, classColorKey } from '../../lib/subjectColors';
import TimetableCellModal from './TimetableCellModal';
import SwapConfirmModal from './SwapConfirmModal';
import DragCardTray from './DragCardTray';
import MakeupDropForm from './MakeupDropForm';
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
  const lunchAfterPeriod = data.lunchAfterPeriod;
  /** 교시 번호 열은 특정 요일 하나를 따라갈 수 없으니, 요일들이 가장 많이 공유하는
   *  점심 위치를 대표값으로 삼아 그 자리에 점심시간만큼 자리를 비워 둔다 — 보통은
   *  모든 요일이 같은 자리에 점심을 두므로 이렇게 하면 대부분 실제로도 맞는다. */
  const commonLunchPeriod = (() => {
    const counts = new Map<number, number>();
    for (const value of Object.values(lunchAfterPeriod)) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    let best: number | undefined;
    let bestCount = 0;
    for (const [value, count] of counts) {
      if (count > bestCount) {
        best = value;
        bestCount = count;
      }
    }
    return best;
  })();
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
  const [draggingCard, setDraggingCard] = useState<'lunch' | 'makeup' | 'cancel' | null>(null);
  const [draggingLunchFromDay, setDraggingLunchFromDay] = useState<number | null>(null);
  // 지금 드래그가 걸쳐 있는 딱 하나의 드롭 목표만 표시하기 위한 키
  // ("lunch:요일:교시" | "cell:요일:교시" | "trash"). 여러 목표가 한꺼번에
  // 반응하지 않도록 이 키와 정확히 일치하는 곳만 강조한다.
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [makeupDrop, setMakeupDrop] = useState<{
    dateKey: string;
    period: number;
    top: number;
    left: number;
    subject: string;
    room: string;
  } | null>(null);

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

  /** 요일별 점심시간 표시줄 위치를 정하거나 옮긴다(화면 표시 전용, 요일당 1개). */
  function setLunchAfterPeriod(day: number, period: number) {
    update((prev) => ({ lunchAfterPeriod: { ...prev.lunchAfterPeriod, [day]: period } }));
  }

  /** 그 요일의 점심시간 표시줄을 없앤다. */
  function removeLunchAfterPeriod(day: number) {
    update((prev) => {
      const next = { ...prev.lunchAfterPeriod };
      delete next[day];
      return { lunchAfterPeriod: next };
    });
  }

  /** 칸을 휴지통으로 드래그했을 때 지울 대상을 하나만 고른다 — 이 날짜만의 휴강이
   *  있으면 그것부터, 없고 보강이 있으면 보강을, 둘 다 없으면 반복 시간표에 배정된
   *  과목·반 자체를 지운다. 휴강·보강처럼 이 날짜만의 예외를 무심코 반복 시간표
   *  삭제로 덮어버리지 않기 위한 우선순위다. */
  function trashDropCell(day: number, period: number) {
    const dateKey = format(addDays(weekStart, day - 1), 'yyyy-MM-dd');
    const isManualCanceled = canceledLessons.some((c) => c.date === dateKey && c.period === period);
    if (isManualCanceled) {
      const slot = slotAt(dateKey, period);
      toggleCanceled(dateKey, period, slot.subject.trim(), slot.room.trim());
      return;
    }
    const hasMakeup = makeupLessons.some((m) => m.date === dateKey && m.period === period);
    if (hasMakeup) {
      saveMakeup(dateKey, period, '', '');
      return;
    }
    saveCell(day, period, '', '');
  }

  /** (과목, 반) 하나만 색을 지정한다 — 같은 과목의 다른 반에는 영향을 주지 않는다. */
  function setClassColor(colorKey: string, colorIndex: number) {
    update((prev) => ({ subjectColors: { ...prev.subjectColors, [colorKey]: colorIndex } }));
  }

  /** 같은 과목이면 반 상관없이 전부 같은 색으로 지정한다. */
  function applyColorToSubject(subject: string, colorIndex: number) {
    update((prev) => {
      const next = { ...prev.subjectColors };
      for (const day of [1, 2, 3, 4, 5]) {
        for (const slot of prev.timetable[day] ?? []) {
          if (slot.subject.trim() === subject) {
            next[classColorKey(slot.subject, slot.room)] = colorIndex;
          }
        }
      }
      return { subjectColors: next };
    });
  }

  // 모달의 과목/반 입력창(타이핑 저장)은 항상 반복 시간표 원본을 보여주고 그걸 수정한다.
  // 휴강 판정·표시는 지금 실제로 보이는 내용(교환 반영) 기준이어야 한다.
  const editingTemplateSlot = editing
    ? (timetable[editing.day] ?? [])[editing.period] ?? { subject: '', room: '' }
    : null;
  const editingDateKey = editing ? format(addDays(weekStart, editing.day - 1), 'yyyy-MM-dd') : '';
  const editingTime = editing ? settings.periodTimes[editing.period] ?? { start: '', end: '' } : null;
  const editingLabel = editing ? WEEKDAYS.find((w) => w.day === editing.day)?.label : '';
  const editingSwapped = editing
    ? swapOverrides.some((o) => o.date === editingDateKey && o.period === editing.period)
    : false;

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
        <div className="flex min-w-2xl gap-1 text-sm">
          {/* 교시 번호 열 — 참조용 라벨. 요일들이 공유하는 점심 위치(commonLunchPeriod)에는
              같은 높이의 빈 자리를 넣어 맞추지만, 그 위치가 요일마다 다르면 전부와 동시에
              맞을 수는 없다(그 경우는 요일마다 독립적으로 밀리는 게 의도된 동작). */}
          <div className="flex w-10 flex-col gap-0.5">
            <div className="h-11" />
            {Array.from({ length: settings.periodCount }, (_, i) => (
              <Fragment key={i}>
                <div className="rounded-lg p-1">
                  <div className="flex h-14 items-center justify-center overflow-hidden p-1.5">
                    <span
                      className={`grid h-7 w-7 place-items-center rounded-lg text-xs font-bold ${
                        isThisWeek && i === currentPeriod ? 'bg-mint-500 text-white' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {i + 1}
                    </span>
                  </div>
                </div>
                {/* 요일별 점심 틈(day column)의 평소 높이(h-0.5)와 맞춘다. 대부분의
                    요일이 공유하는 점심 위치(commonLunchPeriod)에서는 실제 점심시간
                    막대와 같은 높이의 빈 자리를 넣어, 그 요일들과 계속 나란히
                    맞도록 한다(점심 위치가 요일마다 다르면 전부와 맞을 수는 없다). */}
                {i < settings.periodCount - 1 &&
                  (commonLunchPeriod === i ? (
                    <div className="invisible rounded py-1 text-center text-[10px] font-semibold" aria-hidden="true">
                      점심시간
                    </div>
                  ) : (
                    <div className="h-0.5" />
                  ))}
              </Fragment>
            ))}
          </div>

          {WEEKDAYS.map(({ day, label }) => {
            const date = addDays(weekStart, day - 1);
            const dateKey = format(date, 'yyyy-MM-dd');
            const holiday = holidayByDate.get(dateKey);
            const isToday = isThisWeek && dateKey === todayKey;
            return (
              <div key={day} className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="h-11 pb-1 text-center text-xs font-medium align-top">
                  <div className={isToday ? 'text-mint-600' : 'text-slate-500'}>
                    {label} {format(date, 'M/d')}
                  </div>
                  <div
                    className="mt-0.5 line-clamp-2 h-6 text-[10px] font-normal leading-3 text-rose-500"
                    title={holiday}
                  >
                    {holiday}
                  </div>
                </div>

                {Array.from({ length: settings.periodCount }, (_, i) => {
                  const cellDateKey = format(addDays(weekStart, day - 1), 'yyyy-MM-dd');
                  const slot = slotAt(cellDateKey, i);
                  const isManualCanceled = canceledLessons.some((c) => c.date === cellDateKey && c.period === i);
                  const isAutoCanceled = autoCanceledDates.has(cellDateKey);
                  const isCanceled = isManualCanceled || isAutoCanceled;
                  const isSwapped = swapOverrides.some((o) => o.date === cellDateKey && o.period === i);
                  const makeup = makeupLessons.find((m) => m.date === cellDateKey && m.period === i);
                  const isDragging = dragging?.day === day && dragging?.period === i;
                  const isNow = isThisWeek && i === currentPeriod && cellDateKey === todayKey;
                  const color = slot.subject.trim()
                    ? subjectColors.get(classColorKey(slot.subject, slot.room))
                    : undefined;
                  const cellKey = `cell:${day}:${i}`;
                  const isCellDragOver =
                    dragOverKey === cellKey && (draggingCard === 'makeup' || draggingCard === 'cancel');
                  return (
                    <Fragment key={i}>
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (dragOverKey !== cellKey) setDragOverKey(cellKey);
                      }}
                      onDrop={(e) => {
                        setDragOverKey(null);
                        if (draggingCard === 'makeup') {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setMakeupDrop({
                            dateKey: cellDateKey,
                            period: i,
                            top: rect.bottom + 4,
                            left: rect.left,
                            subject: makeup?.subject ?? '',
                            room: makeup?.room ?? '',
                          });
                          setDraggingCard(null);
                          return;
                        }
                        if (draggingCard === 'cancel') {
                          toggleCanceled(cellDateKey, i, slot.subject.trim(), slot.room.trim());
                          setDraggingCard(null);
                          return;
                        }
                        if (dragging && !(dragging.day === day && dragging.period === i)) {
                          setPendingSwap({ a: dragging, b: { day, period: i } });
                        }
                        setDragging(null);
                      }}
                      className={`rounded-lg p-1 transition ${isNow ? 'ring-2 ring-mint-300' : ''} ${
                        isCellDragOver
                          ? draggingCard === 'makeup'
                            ? 'bg-violet-100 ring-2 ring-violet-300'
                            : 'bg-rose-100 ring-2 ring-rose-300'
                          : ''
                      }`}
                    >
                      <button
                        type="button"
                        draggable
                        onClick={() => setEditing({ day, period: i })}
                        onDragStart={() => setDragging({ day, period: i })}
                        onDragEnd={() => {
                          setDragging(null);
                          setDragOverKey(null);
                        }}
                        className={`relative flex h-14 w-full cursor-grab flex-col items-center justify-center gap-0.5 overflow-hidden rounded-lg p-1.5 text-center transition active:cursor-grabbing ${
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
                    </div>
                    {i < settings.periodCount - 1 &&
                      (() => {
                        const gapKey = `lunch:${day}:${i}`;
                        const isGapDragOver = dragOverKey === gapKey && draggingCard === 'lunch';
                        return lunchAfterPeriod[day] === i ? (
                          <div
                            draggable
                            title="다른 틈으로 옮기거나 휴지통으로 드래그하면 없어져요"
                            onDragStart={() => {
                              setDraggingCard('lunch');
                              setDraggingLunchFromDay(day);
                            }}
                            onDragEnd={() => {
                              setDraggingCard(null);
                              setDraggingLunchFromDay(null);
                              setDragOverKey(null);
                            }}
                            className="cursor-grab rounded bg-amber-100 py-1 text-center text-[10px] font-semibold text-amber-700 hover:bg-amber-200 active:cursor-grabbing"
                          >
                            점심시간
                          </div>
                        ) : (
                          <div
                            onDragEnter={() => setDragOverKey(gapKey)}
                            onDragLeave={() => setDragOverKey((k) => (k === gapKey ? null : k))}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => {
                              if (draggingCard === 'lunch') {
                                setLunchAfterPeriod(day, i);
                                setDraggingCard(null);
                                setDraggingLunchFromDay(null);
                              }
                              setDragOverKey(null);
                            }}
                            className={`flex items-center justify-center rounded border-2 text-[9px] font-semibold transition-all ${
                              isGapDragOver
                                ? 'h-8 border-dashed border-amber-500 bg-amber-100 text-amber-700'
                                : 'h-0.5 border-transparent text-transparent'
                            }`}
                          >
                            {isGapDragOver && '여기에 놓기'}
                          </div>
                        );
                      })()}
                    </Fragment>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <DragCardTray
        onCardDragStart={setDraggingCard}
        onCardDragEnd={() => {
          setDraggingCard(null);
          setDraggingLunchFromDay(null);
          setDragOverKey(null);
        }}
        onTrashDragOver={() => {
          if (dragOverKey !== 'trash') setDragOverKey('trash');
        }}
        onTrashDrop={() => {
          if (draggingCard === 'lunch' && draggingLunchFromDay != null) {
            removeLunchAfterPeriod(draggingLunchFromDay);
          } else if (dragging) {
            trashDropCell(dragging.day, dragging.period);
          }
          setDragging(null);
          setDraggingCard(null);
          setDraggingLunchFromDay(null);
          setDragOverKey(null);
        }}
        trashActive={dragOverKey === 'trash'}
      />
      <p className="mt-1.5 text-[10px] text-slate-400">
        카드를 드래그해서 놓으면 적용돼요! 점심시간은 교시 사이 틈에, 보강·휴강은 원하는 칸 위에 놓아보세요.
        지우고 싶으면 휴지통으로 드래그하면 돼요.
      </p>

      {makeupDrop && (
        <MakeupDropForm
          top={makeupDrop.top}
          left={makeupDrop.left}
          initialSubject={makeupDrop.subject}
          initialRoom={makeupDrop.room}
          onCancel={() => setMakeupDrop(null)}
          onSave={(subject, room) => {
            saveMakeup(makeupDrop.dateKey, makeupDrop.period, subject, room);
            setMakeupDrop(null);
          }}
        />
      )}

      {editing && editingTemplateSlot && editingTime && (
        <TimetableCellModal
          dayLabel={editingLabel ?? ''}
          dateLabel={format(addDays(weekStart, editing.day - 1), 'M/d')}
          period={editing.period + 1}
          time={editingTime}
          subject={editingTemplateSlot.subject}
          room={editingTemplateSlot.room}
          swapped={editingSwapped}
          subjectColors={data.subjectColors}
          onClose={() => setEditing(null)}
          onSave={(subject, room) => {
            saveCell(editing.day, editing.period, subject, room);
            setEditing(null);
          }}
          onRevertSwap={() => {
            revertSwap(editingDateKey, editing.period);
            setEditing(null);
          }}
          onSetColor={setClassColor}
          onApplyColorToSubject={applyColorToSubject}
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
