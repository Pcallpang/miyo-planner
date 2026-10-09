import SlidePanel from './SlidePanel';
import { countedMinutesForLog, formatDuration, monthlyDailyBreakdown, type MonthlyPay } from '../lib/overtime';
import type { OvertimeLog, OvertimeSession } from '../types';

const SESSION_BADGE: Record<OvertimeSession, string> = {
  아침: 'bg-sky-100 text-sky-700',
  저녁: 'bg-violet-100 text-violet-700',
};

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** "2026-09-18" → "09/18 (금)" */
function formatDay(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  return `${date.slice(5).replace('-', '/')} (${WEEKDAYS[d.getDay()]})`;
}

interface Props {
  /** 보여줄 달의 요약(월 줄과 같은 값) */
  month: MonthlyPay;
  logs: OvertimeLog[];
  onClose: () => void;
}

/** 월 줄을 눌렀을 때 뜨는 일자별 내역 팝업. 보기 전용 — 수정·삭제는 이번 달 목록에서 한다. */
export default function OvertimeMonthModal({ month, logs, onClose }: Props) {
  const [y, m] = month.monthKey.split('-').map(Number);
  const days = monthlyDailyBreakdown(logs, month.monthKey);

  return (
    <SlidePanel title={`${y}년 ${m}월 초과근무`} onClose={onClose}>
      {() => (
        <div>
          <div className="mb-4 rounded-xl bg-mint-50 px-4 py-3 text-sm">
            <p className="text-xs text-slate-500">그 달 인정 합계</p>
            <p className="font-bold text-slate-800">
              {formatDuration(month.minutes)}
              <span className="ml-2 font-semibold text-mint-600">{month.pay.toLocaleString('ko-KR')}원</span>
              <span className="ml-1 text-xs font-normal text-slate-400">({month.hours}시간 기준)</span>
            </p>
          </div>

          <ul className="space-y-2">
            {days.map((day) => (
              <li key={day.date} className="rounded-xl border border-slate-100 px-3 py-2">
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">{formatDay(day.date)}</span>
                  <span className="text-slate-400">인정 {formatDuration(day.countedMinutes)}</span>
                </div>
                {day.logs.map((log) => (
                  <div key={log.id} className="flex items-center gap-2 py-0.5 text-xs">
                    <span
                      className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${SESSION_BADGE[log.session]}`}
                    >
                      {log.session}
                    </span>
                    <span className="text-slate-600">
                      {log.startTime} ~ {log.endTime}
                    </span>
                    <span className="ml-auto text-slate-400">{formatDuration(countedMinutesForLog(logs, log))}</span>
                  </div>
                ))}
              </li>
            ))}
          </ul>
        </div>
      )}
    </SlidePanel>
  );
}
