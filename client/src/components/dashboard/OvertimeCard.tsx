import { useState, type Dispatch, type SetStateAction } from 'react';
import { AlarmClock, Coins, Pencil, Plus, Sunrise, Sunset, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import EmptyMiyo from '../EmptyMiyo';
import {
  buildEveningPunchLog,
  buildMorningPunchLog,
  durationMinutes,
  estimatedPay,
  formatDuration,
  monthlyTotalMinutes,
  nowHHmm,
  OVERTIME_MONTHLY_CAP_MINUTES,
  todayYMD,
} from '../../lib/overtime';
import type { OvertimeLog, OvertimeSession } from '../../types';

const SESSION_BADGE: Record<OvertimeSession, string> = {
  아침: 'bg-sky-100 text-sky-700',
  저녁: 'bg-violet-100 text-violet-700',
};

interface Props {
  logs: OvertimeLog[];
  setLogs: Dispatch<SetStateAction<OvertimeLog[]>>;
  onAdd: () => void;
  onEdit: (log: OvertimeLog) => void;
}

export default function OvertimeCard({ logs, setLogs, onAdd, onEdit }: Props) {
  const { settings, setSettings, showToast } = useApp();
  const [editingRate, setEditingRate] = useState(false);
  const [rateInput, setRateInput] = useState('');
  const [editingMorningEnd, setEditingMorningEnd] = useState(false);
  const [morningEndInput, setMorningEndInput] = useState('');
  const [editingEveningStart, setEditingEveningStart] = useState(false);
  const [eveningStartInput, setEveningStartInput] = useState('');

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

  function recordMorning() {
    if (logs.some((l) => l.date === todayYMD() && l.session === '아침')) {
      showToast('error', '오늘 아침 초근은 이미 기록되어 있습니다.');
      return;
    }
    const log = buildMorningPunchLog(todayYMD(), nowHHmm(), settings.morningOvertimeEndTime);
    if (!log) {
      showToast('error', `이미 ${settings.morningOvertimeEndTime}이 지났습니다.`);
      return;
    }
    setLogs((prev) => [...prev, log]);
    showToast('success', `아침 초근을 기록했습니다. (${log.startTime}~${log.endTime})`);
  }

  function recordEvening() {
    if (logs.some((l) => l.date === todayYMD() && l.session === '저녁')) {
      showToast('error', '오늘 저녁 초근은 이미 기록되어 있습니다.');
      return;
    }
    const log = buildEveningPunchLog(todayYMD(), nowHHmm(), settings.eveningOvertimeStartTime);
    if (!log) {
      showToast('error', `아직 ${settings.eveningOvertimeStartTime} 전입니다.`);
      return;
    }
    setLogs((prev) => [...prev, log]);
    showToast('success', `저녁 초근을 기록했습니다. (${formatDuration(durationMinutes(log))})`);
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

  function saveMorningEnd() {
    if (!morningEndInput) {
      showToast('error', '시각을 입력해 주세요.');
      return;
    }
    setSettings((prev) => ({ ...prev, morningOvertimeEndTime: morningEndInput }));
    setEditingMorningEnd(false);
  }

  function saveEveningStart() {
    if (!eveningStartInput) {
      showToast('error', '시각을 입력해 주세요.');
      return;
    }
    setSettings((prev) => ({ ...prev, eveningOvertimeStartTime: eveningStartInput }));
    setEditingEveningStart(false);
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

      {/* 원터치 버튼: 아침은 출근만, 저녁은 퇴근만 찍으면 나머지 시각은 자동 계산 */}
      <div className="mb-3 grid grid-cols-2 gap-2">
        <button
          onClick={recordMorning}
          className="flex flex-col items-center gap-1 rounded-xl border border-slate-200 px-2 py-2.5 text-xs font-semibold text-slate-500 transition hover:border-mint-200 hover:bg-mint-50/50"
        >
          <Sunrise size={16} />
          아침 초근 기록
        </button>
        <button
          onClick={recordEvening}
          className="flex flex-col items-center gap-1 rounded-xl border border-slate-200 px-2 py-2.5 text-xs font-semibold text-slate-500 transition hover:border-mint-200 hover:bg-mint-50/50"
        >
          <Sunset size={16} />
          저녁 퇴근 찍기
        </button>
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

      {/* 아침 종료 시각 */}
      <div className="mb-1.5 text-xs text-slate-400">
        {editingMorningEnd ? (
          <div className="flex items-center gap-2">
            <input
              type="time"
              autoFocus
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs outline-none focus:border-mint-400"
              value={morningEndInput}
              onChange={(e) => setMorningEndInput(e.target.value)}
            />
            <button onClick={saveMorningEnd} className="font-semibold text-mint-600">
              저장
            </button>
            <button onClick={() => setEditingMorningEnd(false)} className="text-slate-400">
              취소
            </button>
          </div>
        ) : (
          <button
            onClick={() => {
              setMorningEndInput(settings.morningOvertimeEndTime);
              setEditingMorningEnd(true);
            }}
            className="underline-offset-2 hover:text-mint-600 hover:underline"
          >
            아침 {settings.morningOvertimeEndTime}에 자동 종료 (수정)
          </button>
        )}
      </div>

      {/* 저녁 시작 시각 */}
      <div className="mb-3 text-xs text-slate-400">
        {editingEveningStart ? (
          <div className="flex items-center gap-2">
            <input
              type="time"
              autoFocus
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs outline-none focus:border-mint-400"
              value={eveningStartInput}
              onChange={(e) => setEveningStartInput(e.target.value)}
            />
            <button onClick={saveEveningStart} className="font-semibold text-mint-600">
              저장
            </button>
            <button onClick={() => setEditingEveningStart(false)} className="text-slate-400">
              취소
            </button>
          </div>
        ) : (
          <button
            onClick={() => {
              setEveningStartInput(settings.eveningOvertimeStartTime);
              setEditingEveningStart(true);
            }}
            className="underline-offset-2 hover:text-mint-600 hover:underline"
          >
            저녁 {settings.eveningOvertimeStartTime}부터 계산 (수정)
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
            {/* 좁은 화면에서도 분까지 다 보이도록 자르지 않고 필요하면 줄바꿈한다. */}
            <span className="min-w-0 flex-1 text-xs break-words text-slate-600">
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
