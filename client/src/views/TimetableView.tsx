import { useState } from 'react';
import { Table } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useData } from '../context/DataContext';
import { getDayPhase } from '../lib/schedule';
import type { Timetable } from '../types';

const WEEKDAYS = [
  { day: 1, label: '월' },
  { day: 2, label: '화' },
  { day: 3, label: '수' },
  { day: 4, label: '목' },
  { day: 5, label: '금' },
];

export default function TimetableView() {
  const { settings, setSettings } = useApp();
  const { data, update } = useData();
  const timetable = data.timetable;
  const setTimetable = (updater: (prev: Timetable) => Timetable) =>
    update((prev) => ({ timetable: updater(prev.timetable) }));
  const today = new Date().getDay();
  const [day, setDay] = useState(today >= 1 && today <= 5 ? today : 1);

  const now = new Date();
  const phase = getDayPhase(now, settings.periodTimes, settings.periodCount);
  const currentPeriod = day === today && phase.kind === 'period' ? phase.index : -1;

  const slots = timetable[day] ?? [];

  function updateSlot(index: number, field: 'subject' | 'room', value: string) {
    setTimetable((prev) => {
      const daySlots = [...(prev[day] ?? [])];
      while (daySlots.length <= index) daySlots.push({ subject: '', room: '' });
      daySlots[index] = { ...daySlots[index], [field]: value };
      return { ...prev, [day]: daySlots };
    });
  }

  function updateTime(index: number, field: 'start' | 'end', value: string) {
    setSettings((prev) => {
      const times = [...prev.periodTimes];
      if (times[index]) times[index] = { ...times[index], [field]: value };
      return { ...prev, periodTimes: times };
    });
  }

  return (
    <div className="mx-auto max-w-3xl">
      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800">
            <Table size={18} className="text-mint-500" />
            오늘의 시간표
          </h2>
          <p className="text-xs text-slate-400">입력하면 자동 저장됩니다 · 교시 수는 환경 설정에서 변경</p>
        </div>

        <div className="mb-4 flex gap-1 rounded-xl bg-slate-100 p-1">
          {WEEKDAYS.map(({ day: d, label }) => (
            <button
              key={d}
              onClick={() => setDay(d)}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
                day === d ? 'bg-white text-mint-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {label}
              {d === today && <span className="ml-1 text-[10px] text-mint-500">오늘</span>}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-md text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400">
                <th className="w-14 pb-2 font-medium">교시</th>
                <th className="w-44 pb-2 font-medium">시간</th>
                <th className="pb-2 font-medium">과목</th>
                <th className="w-32 pb-2 font-medium">교실</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: settings.periodCount }, (_, i) => {
                const time = settings.periodTimes[i] ?? { start: '', end: '' };
                const slot = slots[i] ?? { subject: '', room: '' };
                const isNow = i === currentPeriod;
                return (
                  <tr key={i} className={isNow ? 'bg-mint-50' : ''}>
                    <td className="py-1.5 pr-2">
                      <span
                        className={`grid h-8 w-8 place-items-center rounded-lg text-sm font-bold ${
                          isNow ? 'bg-mint-500 text-white' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {i + 1}
                      </span>
                    </td>
                    <td className="py-1.5 pr-3">
                      <div className="flex items-center gap-1">
                        <input
                          type="time"
                          value={time.start}
                          onChange={(e) => updateTime(i, 'start', e.target.value)}
                          className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-mint-400"
                        />
                        <span className="text-slate-300">~</span>
                        <input
                          type="time"
                          value={time.end}
                          onChange={(e) => updateTime(i, 'end', e.target.value)}
                          className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-mint-400"
                        />
                      </div>
                    </td>
                    <td className="py-1.5 pr-3">
                      <input
                        value={slot.subject}
                        onChange={(e) => updateSlot(i, 'subject', e.target.value)}
                        placeholder="과목"
                        className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 outline-none transition focus:border-mint-400 focus:ring-2 focus:ring-mint-100"
                      />
                    </td>
                    <td className="py-1.5">
                      <input
                        value={slot.room}
                        onChange={(e) => updateSlot(i, 'room', e.target.value)}
                        placeholder="교실"
                        className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 outline-none transition focus:border-mint-400 focus:ring-2 focus:ring-mint-100"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
