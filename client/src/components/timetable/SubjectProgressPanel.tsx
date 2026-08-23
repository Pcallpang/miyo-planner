import { useEffect, useState } from 'react';
import { addDays, format } from 'date-fns';
import { useData } from '../../context/DataContext';
import { useApp } from '../../context/AppContext';
import { api } from '../../lib/api';
import { addDay, canceledCountByDate, countLessonsUntil, weeklyOccurrences } from '../../lib/subjectProgress';
import LessonDetailPanel from './LessonDetailPanel';
import type { SchoolScheduleItem } from '../../types';

// "개학식"은 1학기든 2학기든 같은 이름으로 나오는 경우가 많아, 어느 학기인지는
// 찾은 날짜(1~6월=1학기, 7~12월=2학기)로 판단한다 — 이러면 내년 1학기가 와도 코드
// 수정 없이 그대로 동작한다.
const TERM_START_KEYWORDS = ['1학기 개학', '1학기개학', '2학기 개학', '2학기개학', '개학식', '개학'];
const EXAM1_KEYWORDS = ['중간고사', '1차 지필'];
const EXAM2_KEYWORDS = ['기말고사', '2차 지필'];
const TERM_END_KEYWORDS = ['졸업식', '종업식'];

interface SubjectClass {
  subject: string;
  className: string; // 빈 문자열이면 반 미지정
}

function classKey({ subject, className }: SubjectClass): string {
  return `${subject}::${className}`;
}

/**
 * keywords에 걸리는 학사일정 중 after보다 뒤(after 자체는 제외)인 것만 모아, 그 기간의
 * 첫날·마지막날을 돌려준다. 지필평가가 이틀 이상 걸리는 경우를 위해 범위로 다룬다 —
 * "다음 구간"은 마지막 날 다음날부터 시작해야 시험 기간이 차시에 안 끼어든다.
 */
function findEventRange(
  schedule: SchoolScheduleItem[],
  keywords: string[],
  after: string | null,
): { start: string; end: string } | null {
  const dates = schedule
    .filter((item) => keywords.some((k) => item.name.includes(k)))
    .filter((item) => !after || item.date > after)
    .map((item) => item.date)
    .sort();
  if (dates.length === 0) return null;
  return { start: dates[0], end: dates[dates.length - 1] };
}

/**
 * 왼쪽 주간 시간표에 등장하는 (과목, 반) 조합마다 "현재 차시 / 총 차시"를 관리한다.
 * 같은 과목이라도 반이 다르면 진도가 다를 수 있어 따로 추적한다.
 */
export default function SubjectProgressPanel() {
  const { data, update } = useData();
  const { settings } = useApp();
  const { timetable, subjectProgress, canceledLessons, subjectLessonNotes } = data;
  const [schoolSchedule, setSchoolSchedule] = useState<SchoolScheduleItem[]>([]);
  const [openDetailFor, setOpenDetailFor] = useState<string | null>(null);

  // 시간표에 등장하는 (과목, 반) 조합(중복 제거), 과목 다음 반 순으로 정렬
  const classes: SubjectClass[] = [];
  const seen = new Set<string>();
  for (const day of [1, 2, 3, 4, 5]) {
    for (const slot of timetable[day] ?? []) {
      const subject = slot.subject.trim();
      if (!subject) continue;
      const entry = { subject, className: slot.room.trim() };
      const key = classKey(entry);
      if (!seen.has(key)) {
        seen.add(key);
        classes.push(entry);
      }
    }
  }
  classes.sort(
    (a, b) =>
      a.subject.localeCompare(b.subject, 'ko') ||
      a.className.localeCompare(b.className, 'ko', { numeric: true }),
  );
  const classesKey = classes.map(classKey).join('|');

  // 새로 등장한 (과목, 반) 조합에는 진도 항목을 자동으로 만든다(처음엔 0/1차시).
  // missing 계산을 update()의 최신 prev 안에서 다시 하므로, 같은 렌더에서 두 번
  // 불려도(React 18 StrictMode) 중복으로 추가되지 않는다.
  useEffect(() => {
    if (classes.length === 0) return;
    update((prev) => {
      const existing = new Set(prev.subjectProgress.map(classKey));
      const missing = classes.filter((c) => !existing.has(classKey(c)));
      if (missing.length === 0) return {};
      return {
        subjectProgress: [
          ...prev.subjectProgress,
          ...missing.map((c) => ({ ...c, currentLesson: 0, totalLessons: 1 })),
        ],
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classesKey]);

  // 2학기 개학일이 이미 지났을 수도 있어 지난 60일부터, 앞으로 약 7개월치까지 학사일정을
  // 받아 지필평가·학기종료일 목록과 휴업일을 뽑아낸다.
  useEffect(() => {
    let cancelled = false;
    if (!settings.school) {
      setSchoolSchedule([]);
      return;
    }
    const today = new Date();
    const from = format(addDays(today, -60), 'yyyy-MM-dd');
    const to = format(addDays(today, 210), 'yyyy-MM-dd');
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
  }, [settings.school]);

  const noClassDates = new Set(schoolSchedule.filter((item) => item.noClass).map((item) => item.date));
  const termStart = findEventRange(schoolSchedule, TERM_START_KEYWORDS, null);
  const exam1 = findEventRange(schoolSchedule, EXAM1_KEYWORDS, null);
  const exam2 = findEventRange(schoolSchedule, EXAM2_KEYWORDS, exam1?.end ?? null);
  const termEnd = findEventRange(schoolSchedule, TERM_END_KEYWORDS, exam2?.end ?? null);
  // 개학일이 1~6월이면 1학기, 7~12월이면 2학기 — 내년에 1학기가 와도 그대로 맞는다.
  const termLabel = termStart
    ? new Date(`${termStart.start}T00:00:00`).getMonth() < 6
      ? '1학기'
      : '2학기'
    : '학기';

  // 1차 지필·학기끝은 둘 다 개학날부터 세므로, 오늘까지 이미 지난 차시도 함께 계산해
  // 현재 차시(진도율)에 반영한다. 1-2차 지필은 개학날이 기준이 아니라 구간 자체이므로
  // 지난 차시를 새로 매기지 않는다.
  const milestones: { label: string; from: string | null; to: string | null; computeCurrent: boolean }[] = [
    { label: '1차 지필', from: termStart?.start ?? null, to: exam1?.start ?? null, computeCurrent: true },
    { label: '1-2차 지필', from: exam1 ? addDay(exam1.end) : null, to: exam2?.start ?? null, computeCurrent: false },
    { label: '학기끝', from: termStart?.start ?? null, to: termEnd?.start ?? null, computeCurrent: true },
  ];

  function applyMilestone(from: string, to: string, computeCurrent: boolean) {
    const today = format(new Date(), 'yyyy-MM-dd');
    update((prev) => ({
      subjectProgress: prev.subjectProgress.map((p) => {
        if (!classes.some((c) => classKey(c) === classKey(p))) return p;
        const occurrences = weeklyOccurrences(timetable, p.subject, p.className);
        const canceledByDate = canceledCountByDate(timetable, canceledLessons, p.subject, p.className);
        const total = Math.max(1, countLessonsUntil(occurrences, from, to, noClassDates, canceledByDate));
        if (!computeCurrent) return { ...p, totalLessons: total };
        const elapsed = countLessonsUntil(occurrences, from, today, noClassDates, canceledByDate);
        return { ...p, totalLessons: total, currentLesson: Math.max(0, Math.min(elapsed, total)) };
      }),
    }));
  }

  function setProgress(entry: SubjectClass, field: 'currentLesson' | 'totalLessons', value: number) {
    const min = field === 'totalLessons' ? 1 : 0;
    const key = classKey(entry);
    update((prev) => ({
      subjectProgress: prev.subjectProgress.map((p) =>
        classKey(p) === key ? { ...p, [field]: Math.max(min, value) } : p,
      ),
    }));
  }

  /** 차시별 메모는 반과 무관하게 과목 하나에 한 벌만 있다 — 반이 달라도 같은 과목이면 공유한다. */
  function setLessonNote(subject: string, index: number, value: string) {
    update((prev) => {
      const notes = [...(prev.subjectLessonNotes[subject] ?? [])];
      while (notes.length <= index) notes.push('');
      notes[index] = value;
      return { subjectLessonNotes: { ...prev.subjectLessonNotes, [subject]: notes } };
    });
  }

  const openEntry = openDetailFor ? classes.find((c) => classKey(c) === openDetailFor) : null;
  const openProgress = openDetailFor ? subjectProgress.find((p) => classKey(p) === openDetailFor) : null;

  return (
    <section className="w-full shrink-0 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100 lg:w-96">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-700">차시 계획표</h3>
        {settings.school && classes.length > 0 && (
          <div className="flex items-center gap-1">
            <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-400">{termLabel}</span>
            {milestones.map((m) => (
              <button
                key={m.label}
                type="button"
                disabled={!m.from || !m.to}
                onClick={() => m.from && m.to && applyMilestone(m.from, m.to, m.computeCurrent)}
                title={
                  m.from && m.to
                    ? '학사일정 기준으로 전체 반별 과목의 총 차시를 계산합니다'
                    : '학사일정에서 날짜를 찾을 수 없습니다'
                }
                className="shrink-0 whitespace-nowrap rounded-full border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-500 transition hover:border-mint-300 hover:text-mint-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:text-slate-500"
              >
                {m.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {classes.length === 0 ? (
        <p className="py-3 text-sm text-slate-400">
          왼쪽 시간표에 과목을 입력하면 여기서 차시를 관리할 수 있습니다.
        </p>
      ) : (
        <ul className="space-y-2">
          {classes.map((entry) => {
            const key = classKey(entry);
            const progress = subjectProgress.find((p) => classKey(p) === key);
            const current = progress?.currentLesson ?? 0;
            const total = progress?.totalLessons ?? 1;
            const percent = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
            return (
              <li key={key} className="rounded-xl bg-slate-50 px-3 py-2.5">
                <div className="flex items-center justify-between text-sm">
                  <button
                    type="button"
                    onClick={() => setOpenDetailFor(key)}
                    className="truncate font-medium text-slate-700 hover:text-mint-600 hover:underline"
                  >
                    {entry.subject}
                    {entry.className && (
                      <span className="ml-1 font-normal text-slate-400">{entry.className}</span>
                    )}
                  </button>
                  <span className="shrink-0 text-xs text-slate-400">{percent}%</span>
                </div>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full rounded-full bg-mint-400" style={{ width: `${percent}%` }} />
                  </div>
                  <input
                    type="number"
                    min={0}
                    value={current}
                    onChange={(e) => setProgress(entry, 'currentLesson', Number(e.target.value) || 0)}
                    className="w-12 shrink-0 rounded-lg border border-slate-200 px-1 py-1 text-right text-xs outline-none focus:border-mint-400"
                  />
                  <span className="shrink-0 text-xs text-slate-400">/</span>
                  <input
                    type="number"
                    min={1}
                    value={total}
                    onChange={(e) => setProgress(entry, 'totalLessons', Number(e.target.value) || 1)}
                    className="w-12 shrink-0 rounded-lg border border-slate-200 px-1 py-1 text-right text-xs outline-none focus:border-mint-400"
                  />
                  <span className="shrink-0 text-xs text-slate-400">차시</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {openEntry && openProgress && (
        <LessonDetailPanel
          subject={openEntry.subject}
          className={openEntry.className}
          total={openProgress.totalLessons}
          current={openProgress.currentLesson}
          notes={subjectLessonNotes[openEntry.subject] ?? []}
          onClose={() => setOpenDetailFor(null)}
          onSaveNote={(index, value) => setLessonNote(openEntry.subject, index, value)}
        />
      )}
    </section>
  );
}
