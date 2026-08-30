import type { PeriodSlot, PeriodTime } from '../types';

export type DayPhase =
  | { kind: 'weekend' }
  | { kind: 'before' }
  | { kind: 'period'; index: number }
  | { kind: 'break'; nextIndex: number }
  | { kind: 'after' };

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function getDayPhase(now: Date, periodTimes: PeriodTime[], periodCount: number): DayPhase {
  const day = now.getDay();
  if (day === 0 || day === 6) return { kind: 'weekend' };

  const times = periodTimes.slice(0, periodCount);
  if (times.length === 0) return { kind: 'after' };

  const nowMin = now.getHours() * 60 + now.getMinutes();
  if (nowMin < toMinutes(times[0].start)) return { kind: 'before' };

  for (let i = 0; i < times.length; i++) {
    if (nowMin >= toMinutes(times[i].start) && nowMin < toMinutes(times[i].end)) {
      return { kind: 'period', index: i };
    }
    const next = times[i + 1];
    if (next && nowMin >= toMinutes(times[i].end) && nowMin < toMinutes(next.start)) {
      return { kind: 'break', nextIndex: i + 1 };
    }
  }
  return { kind: 'after' };
}

/** 최소화 화면에 보여줄 한 줄 상태 메시지. `currentSlot`은 phase.kind === 'period'일 때만 쓴다. */
export function getPhaseMessage(phase: DayPhase, periodTimes: PeriodTime[], currentSlot?: PeriodSlot): string {
  switch (phase.kind) {
    case 'weekend':
      return '주말이에요. 편안한 하루 보내세요.';
    case 'before':
      return `아직 일과 전이에요. ${periodTimes[0]?.start ?? ''}에 시작해요.`;
    case 'after':
      return '오늘 일과가 끝났어요. 수고하셨어요!';
    case 'break':
      return '쉬는 시간이에요';
    case 'period': {
      const label = `${phase.index + 1}교시 진행 중`;
      if (!currentSlot?.subject.trim()) return label;
      return `${label} · ${currentSlot.subject}${currentSlot.room ? ` ${currentSlot.room}` : ''}`;
    }
  }
}

/** 최소화 화면의 "다음 시간표" 줄에 쓸 교시 인덱스. 다음 교시가 없으면 null. */
export function getNextPeriodIndex(phase: DayPhase, periodCount: number): number | null {
  switch (phase.kind) {
    case 'before':
      return periodCount > 0 ? 0 : null;
    case 'break':
      return phase.nextIndex < periodCount ? phase.nextIndex : null;
    case 'period':
      return phase.index + 1 < periodCount ? phase.index + 1 : null;
    default:
      return null;
  }
}
