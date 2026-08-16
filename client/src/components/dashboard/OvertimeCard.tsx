import { useState, type Dispatch, type SetStateAction } from 'react';
import { AlarmClock, Coins, Pencil, Plus, Sunrise, Sunset, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import EmptyMiyo from '../EmptyMiyo';
import {
  durationMinutes,
  estimatedPay,
  formatDuration,
  monthlyTotalMinutes,
  nowHHmm,
  OVERTIME_MONTHLY_CAP_MINUTES,
  todayYMD,
} from '../../lib/overtime';
import type { OvertimeLog, OvertimePunch, OvertimeSession } from '../../types';

const SESSIONS: OvertimeSession[] = ['아침', '저녁'];
const SESSION_ICON = { 아침: Sunrise, 저녁: Sunset } as const;
const SESSION_BADGE: Record<OvertimeSession, string> = {
  아침: 'bg-sky-100 text-sky-700',
  저녁: 'bg-violet-100 text-violet-700',
};

interface Props {
  logs: OvertimeLog[];
  setLogs: Dispatch<SetStateAction<OvertimeLog[]>>;
  punches: OvertimePunch[];
  setPunches: Dispatch<SetStateAction<OvertimePunch[]>>;
  onAdd: () => void;
  onEdit: (log: OvertimeLog) => void;
}

export default function OvertimeCard({ logs, setLogs, punches, setPunches, onAdd, onEdit }: Props) {
  const { settings, setSettings, showToast } = useApp();
  const [editingRate, setEditingRate] = useState(false);
  const [rateInput, setRateInput] = useState('');

  const now = new Date();
  const monthLogs = logs
    .filter((l) => {
      const d = new Date(`${l.date}T00:00:00`);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    })
    .sort((a, b) => (a.date + a.startTime < b.date + b.startTime ? 1 : -1));

  const morningMinutes = monthlyTotalMinutes(logs, now, '아침');
  const eveningMinutes = monthlyTotalMinutes(logs, now, '저녁');
  const totalMinutes = morningMinutes + eveningMinutes;
  const ratio = totalMinutes / OVERTIME_MONTHLY_CAP_MINUTES;
  const capColor =
    ratio >= 1
      ? 'text-rose-600 bg-rose-50 border-rose-200'
      : ratio >= 0.8
        ? 'text-amber-600 bg-amber-50 border-amber-200'
        : 'text-mint-600 bg-mint-50 border-mint-200';

  const pay = settings.overtimeHourlyRate > 0 ? estimatedPay(totalMinutes, settings.overtimeHourlyRate) : null;

  function punchFor(session: OvertimeSession) {
    return punches.find((p) => p.session === session);
  }

  function togglePunch(session: OvertimeSession) {
    const existing = punchFor(session);
    if (!existing) {
      setPunches((prev) => [...prev, { date: todayYMD(), session, startTime: nowHHmm() }]);
      showToast('success', `${session} 초근 출근을 기록했습니다.`);
      return;
    }
    const endTime = nowHHmm();
    if (endTime <= existing.startTime) {
      showToast('error', '출근을 찍은 지 얼마 안 됐어요. 잠시 후 다시 눌러 주세요.');
      return;
    }
    const log: OvertimeLog = {
      id: crypto.randomUUID(),
      date: existing.date,
      session,
      startTime: existing.startTime,
      endTime,
      createdAt: new Date().toISOString(),
    };
    setLogs((prev) => [...prev, log]);
    setPunches((prev) => prev.filter((p) => p.session !== session));
    showToast('success', `${session} 초근 퇴근을 기록했습니다. (${formatDuration(durationMinutes(log))})`);
  }

  function saveRate() {
    const n = Number(rateInput);
    if (!Number.isFinite(n) || n < 0) {
      showToast('error', '올바른 금액을 입력해 주세요.');
      return;
    }
    setSettings((prev) => ({ ...prev, overtimeHourlyRate: Math.round(n) }));
    setEditingRate(false);
  }

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-bold text-slate-700">
          <AlarmClock size={17} className="text-mint-500" />
          초과근무
        </h2>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${capColor}`}>
          이번 달 {formatDuration(totalMinutes)} / 57시간
        </span>
      </div>

      {/* 원터치 출퇴근 버튼 */}
      <div className="mb-3 grid grid-cols-2 gap-2">
        {SESSIONS.map((session) => {
          const active = punchFor(session);
          const Icon = SESSION_ICON[session];
          return (
            <button
              key={session}
              onClick={() => togglePunch(session)}
              className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-xs font-semibold transition ${
                active
                  ? 'border-mint-400 bg-mint-50 text-mint-700'
                  : 'border-slate-200 text-slate-500 hover:border-mint-200 hover:bg-mint-50/50'
              }`}
            >
              <Icon size={16} />
              {active ? `${session} 퇴근 찍기 (${active.startTime}~)` : `${session} 출근 찍기`}
            </button>
          );
        })}
      </div>

      {/* 이번 달 요약 */}
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
        <span>아침 {formatDuration(morningMinutes)}</span>
        <span>저녁 {formatDuration(eveningMinutes)}</span>
        {pay !== null && (
          <span className="ml-auto flex items-center gap-1 font-semibold text-slate-700">
            <Coins size={12} className="text-amber-500" /> 예상 {pay.toLocaleString('ko-KR')}원
          </span>
        )}
      </div>

      {/* 시간당 단가 */}
      <div className="mb-3 text-xs text-slate-400">
        {editingRate ? (
          <div className="flex items-center gap-2">
            <input
              type="number"
              autoFocus
              className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-xs outline-none focus:border-mint-400"
              value={rateInput}
              onChange={(e) => setRateInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveRate()}
            />
            <button onClick={saveRate} className="font-semibold text-mint-600">
              저장
            </button>
            <button onClick={() => setEditingRate(false)} className="text-slate-400">
              취소
            </button>
          </div>
        ) : (
          <button
            onClick={() => {
              setRateInput(settings.overtimeHourlyRate > 0 ? String(settings.overtimeHourlyRate) : '');
              setEditingRate(true);
            }}
            className="underline-offset-2 hover:text-mint-600 hover:underline"
          >
            {settings.overtimeHourlyRate > 0
              ? `시간당 ${settings.overtimeHourlyRate.toLocaleString('ko-KR')}원 (수정)`
              : '시간당 단가 입력 (예상 수당 계산용)'}
          </button>
        )}
      </div>

      {/* 이번 달 기록 목록 */}
      <ul className="mb-3 max-h-56 space-y-1.5 overflow-y-auto">
        {monthLogs.length === 0 && (
          <li>
            <EmptyMiyo message="이번 달 기록이 없습니다." size={52} src="/sachungi-miyo.png" />
          </li>
        )}
        {monthLogs.map((log) => (
          <li
            key={log.id}
            className="group flex items-center gap-2 rounded-xl px-2 py-1.5 transition hover:bg-slate-50"
          >
            <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${SESSION_BADGE[log.session]}`}>
              {log.session}
            </span>
            <span className="shrink-0 text-xs text-slate-400">{log.date.slice(5).replace('-', '/')}</span>
            <span className="min-w-0 flex-1 truncate text-xs text-slate-600">
              {log.startTime} ~ {log.endTime} · {formatDuration(durationMinutes(log))}
            </span>
            <button
              onClick={() => onEdit(log)}
              className="shrink-0 rounded p-1 text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-mint-500"
              aria-label="수정"
            >
              <Pencil size={12} />
            </button>
            <button
              onClick={() => setLogs((prev) => prev.filter((l) => l.id !== log.id))}
              className="shrink-0 rounded p-1 text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-rose-400"
              aria-label="삭제"
            >
              <Trash2 size={13} />
            </button>
          </li>
        ))}
      </ul>

      <button
        onClick={onAdd}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-mint-300 py-2.5 text-sm font-medium text-mint-600 transition hover:bg-mint-50"
      >
        <Plus size={16} /> 직접 입력
      </button>
    </section>
  );
}
