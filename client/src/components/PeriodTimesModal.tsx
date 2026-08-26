import { useState } from 'react';
import { X } from 'lucide-react';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useApp } from '../context/AppContext';
import type { PeriodTime } from '../types';

interface Props {
  onClose: () => void;
}

const WEEKDAY_TABS: { key: number | 'default'; label: string }[] = [
  { key: 'default', label: '기본' },
  { key: 1, label: '월' },
  { key: 2, label: '화' },
  { key: 3, label: '수' },
  { key: 4, label: '목' },
  { key: 5, label: '금' },
];

/**
 * 교시별 시작~종료 시각을 편집하는 가운데 모달. 환경 설정의 "교시 수" 아래에서 연다.
 * 점심 위치가 요일마다 다른 학교를 위해, "기본" 시간표 외에 특정 요일만 다르게 쓸
 * 수 있는 예외(periodTimeOverrides)를 요일 탭으로 편집한다.
 */
export default function PeriodTimesModal({ onClose }: Props) {
  const { settings, setSettings } = useApp();
  const [tab, setTab] = useState<number | 'default'>('default');
  useEscapeKey(onClose);

  const override = tab === 'default' ? undefined : settings.periodTimeOverrides[tab];
  const times: PeriodTime[] = tab === 'default' ? settings.periodTimes : override ?? settings.periodTimes;

  function updateTime(index: number, field: 'start' | 'end', value: string) {
    setSettings((prev) => {
      if (tab === 'default') {
        const next = [...prev.periodTimes];
        if (next[index]) next[index] = { ...next[index], [field]: value };
        return { ...prev, periodTimes: next };
      }
      const base = prev.periodTimeOverrides[tab] ?? prev.periodTimes;
      const next = [...base];
      if (next[index]) next[index] = { ...next[index], [field]: value };
      return { ...prev, periodTimeOverrides: { ...prev.periodTimeOverrides, [tab]: next } };
    });
  }

  /** 이 요일만 다르게 설정하기 시작 — 기본 시간표를 그대로 복사해서 예외로 만든다. */
  function startOverride() {
    if (tab === 'default') return;
    setSettings((prev) => ({
      ...prev,
      periodTimeOverrides: { ...prev.periodTimeOverrides, [tab]: prev.periodTimes.map((t) => ({ ...t })) },
    }));
  }

  /** 이 요일의 예외를 지우고 기본 시간표로 되돌린다. */
  function clearOverride() {
    if (tab === 'default') return;
    setSettings((prev) => {
      const next = { ...prev.periodTimeOverrides };
      delete next[tab];
      return { ...prev, periodTimeOverrides: next };
    });
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-slate-900/30 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-800">일과 시간</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" aria-label="닫기">
            <X size={18} />
          </button>
        </div>

        <div className="mb-4 flex gap-1 rounded-xl bg-slate-100 p-1">
          {WEEKDAY_TABS.map((w) => (
            <button
              key={w.key}
              type="button"
              onClick={() => setTab(w.key)}
              className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition ${
                tab === w.key ? 'bg-white text-mint-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {w.label}
              {w.key !== 'default' && settings.periodTimeOverrides[w.key] && (
                <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-amber-400 align-middle" />
              )}
            </button>
          ))}
        </div>

        {tab !== 'default' && !override && (
          <div className="mb-4 rounded-xl bg-slate-50 px-3 py-3 text-center">
            <p className="mb-2 text-xs text-slate-500">이 요일은 기본 시간을 그대로 써요.</p>
            <button
              type="button"
              onClick={startOverride}
              className="rounded-lg border border-mint-300 px-3 py-1.5 text-xs font-medium text-mint-600 transition hover:bg-mint-50"
            >
              이 요일만 다르게 설정하기
            </button>
          </div>
        )}

        {(tab === 'default' || override) && (
          <>
            <ul className="space-y-2">
              {Array.from({ length: settings.periodCount }, (_, i) => {
                const time = times[i] ?? { start: '', end: '' };
                return (
                  <li key={i} className="flex items-center gap-2">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-slate-100 text-xs font-bold text-slate-500">
                      {i + 1}
                    </span>
                    <input
                      type="time"
                      value={time.start}
                      onChange={(e) => updateTime(i, 'start', e.target.value)}
                      className="w-full min-w-0 rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-mint-400"
                    />
                    <span className="shrink-0 text-slate-300">~</span>
                    <input
                      type="time"
                      value={time.end}
                      onChange={(e) => updateTime(i, 'end', e.target.value)}
                      className="w-full min-w-0 rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-mint-400"
                    />
                  </li>
                );
              })}
            </ul>

            {tab !== 'default' && override && (
              <button
                type="button"
                onClick={clearOverride}
                className="mt-3 w-full rounded-lg border border-slate-200 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-50"
              >
                기본 시간으로 되돌리기
              </button>
            )}

            <p className="mt-3 text-[11px] text-slate-400">입력하면 자동 저장됩니다.</p>
          </>
        )}
      </div>
    </div>
  );
}
