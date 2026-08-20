import { useCallback, useEffect, useState } from 'react';
import { addDays, endOfMonth, format, isSameMonth, startOfMonth, startOfWeek } from 'date-fns';
import { ko } from 'date-fns/locale';
import { CalendarRange, ChevronLeft, ChevronRight, School, UtensilsCrossed } from 'lucide-react';
import { api } from '../lib/api';
import { useApp } from '../context/AppContext';
import EmptyMiyo from '../components/EmptyMiyo';
import type { Meal, SchoolScheduleItem } from '../types';

/** 급식·학사일정은 학교가 정하는 정보라 앱에 저장하지 않고 열 때마다 조회한다. */
export default function SchoolView() {
  const { settings, showToast } = useApp();
  const school = settings.school;

  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [meals, setMeals] = useState<Meal[]>([]);
  const [schedule, setSchedule] = useState<SchoolScheduleItem[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!school) return;
    const from = format(weekStart, 'yyyy-MM-dd');
    const to = format(addDays(weekStart, 6), 'yyyy-MM-dd');
    // 한 주가 달을 걸치면(예: 8/31~9/4) 두 달을 모두 덮어야 다음 달 일정이 빠지지 않는다
    const monthFrom = format(startOfMonth(weekStart), 'yyyy-MM-dd');
    const monthTo = format(endOfMonth(addDays(weekStart, 4)), 'yyyy-MM-dd');
    setLoading(true);
    try {
      const [m, s] = await Promise.all([
        api.meals(school, from, to),
        api.schoolSchedule(school, monthFrom, monthTo),
      ]);
      setMeals(m.meals);
      setSchedule(s.schedule);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : '학교 정보를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [school, weekStart, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!school) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-100">
        <EmptyMiyo message="환경 설정에서 학교를 검색해 등록하면 급식과 학사일정을 볼 수 있어요." size={80} />
      </div>
    );
  }

  const days = Array.from({ length: 5 }, (_, i) => addDays(weekStart, i));
  const weekEnd = addDays(weekStart, 4);
  // 주가 달을 걸치면 "2026년 8~9월"처럼 두 달을 함께 적는다
  const monthLabel = isSameMonth(weekStart, weekEnd)
    ? format(weekStart, 'yyyy년 M월', { locale: ko })
    : `${format(weekStart, 'yyyy년 M월', { locale: ko })}~${format(weekEnd, 'M월', { locale: ko })}`;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800">
          <School size={18} className="text-mint-500" />
          {school.name}
          {loading && <span className="text-xs font-normal text-slate-400">불러오는 중…</span>}
        </h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setWeekStart((d) => addDays(d, -7))}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="이전 주"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="min-w-32 text-center text-sm font-medium text-slate-600">
            {format(weekStart, 'M/d', { locale: ko })} ~ {format(weekEnd, 'M/d', { locale: ko })}
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
            이번 주
          </button>
        </div>
      </div>

      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
        <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-slate-700">
          <UtensilsCrossed size={17} className="text-mint-500" />
          이번 주 급식
        </h3>

        {meals.length === 0 ? (
          <EmptyMiyo
            message={loading ? '급식을 불러오는 중…' : '이 주에는 급식 정보가 없습니다.'}
            size={80}
            src="/waeyo-miyo.png"
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {days.map((day) => {
              const key = format(day, 'yyyy-MM-dd');
              const dayMeals = meals.filter((m) => m.date === key);
              const isToday = key === format(new Date(), 'yyyy-MM-dd');
              return (
                <div
                  key={key}
                  className={`rounded-xl p-3 ring-1 ${
                    isToday ? 'bg-mint-50 ring-mint-200' : 'bg-slate-50/70 ring-slate-100'
                  }`}
                >
                  <p className={`mb-2 text-sm font-bold ${isToday ? 'text-mint-700' : 'text-slate-600'}`}>
                    {format(day, 'M/d (EEE)', { locale: ko })}
                  </p>
                  {dayMeals.length === 0 ? (
                    <p className="text-xs text-slate-400">급식 없음</p>
                  ) : (
                    dayMeals.map((meal) => (
                      <div key={meal.type} className="mb-2 last:mb-0">
                        {dayMeals.length > 1 && (
                          <p className="mb-1 text-[11px] font-semibold text-slate-500">{meal.type}</p>
                        )}
                        <ul className="space-y-0.5">
                          {meal.dishes.map((dish, i) => (
                            <li key={`${dish.name}-${i}`} className="text-xs text-slate-600">
                              {dish.name}
                            </li>
                          ))}
                        </ul>
                        {meal.calorie && (
                          <p className="mt-1.5 text-[11px] text-slate-400">{meal.calorie}</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
        <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-slate-700">
          <CalendarRange size={17} className="text-mint-500" />
          {monthLabel} 학사일정
        </h3>

        {schedule.length === 0 ? (
          <p className="py-4 text-sm text-slate-400">
            {loading ? '학사일정을 불러오는 중…' : '이 달에는 등록된 학사일정이 없습니다.'}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {schedule.map((item, i) => {
              const isToday = item.date === format(new Date(), 'yyyy-MM-dd');
              return (
                <li key={`${item.date}-${item.name}-${i}`} className="flex items-start gap-3 py-2.5">
                  <span
                    className={`w-20 shrink-0 text-sm font-medium ${
                      isToday ? 'text-mint-600' : 'text-slate-500'
                    }`}
                  >
                    {format(new Date(`${item.date}T00:00:00`), 'M/d (EEE)', { locale: ko })}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-700">
                      {item.name}
                      {item.noClass && (
                        <span className="ml-2 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-500">
                          수업 없음
                        </span>
                      )}
                    </p>
                    {item.content && <p className="text-xs text-slate-400">{item.content}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="pb-2 text-center text-[11px] text-slate-400">
        나이스(NEIS) 교육정보 개방 포털 제공 · 학교가 나이스에 입력한 내용을 그대로 보여줍니다
      </p>
    </div>
  );
}
