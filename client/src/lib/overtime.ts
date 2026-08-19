import type { OvertimeLog, OvertimeSession } from '../types';

/** 국내 학교에서 흔히 쓰는 월 초과근무 수당 지급 상한(57시간) */
export const OVERTIME_MONTHLY_CAP_MINUTES = 57 * 60;

/** 하루 초과근무 인정 상한(4시간). 아침+저녁 합산이 이를 넘으면 초과분은 합계에서 제외한다. */
export const DAILY_OVERTIME_CAP_MINUTES = 4 * 60;

/** 종료-시작(분). 종료가 시작보다 빠르면 0(자정을 넘긴 경우는 다루지 않음). */
export function durationMinutes(log: Pick<OvertimeLog, 'startTime' | 'endTime'>): number {
  const [sh, sm] = log.startTime.split(':').map(Number);
  const [eh, em] = log.endTime.split(':').map(Number);
  const diff = eh * 60 + em - (sh * 60 + sm);
  return diff > 0 ? diff : 0;
}

/** monthDate와 같은 연/월에 속한 로그의 분 합계. session을 주면 해당 세션만 집계. */
export function monthlyTotalMinutes(logs: OvertimeLog[], monthDate: Date, session?: OvertimeSession): number {
  const y = monthDate.getFullYear();
  const m = monthDate.getMonth();
  return logs
    .filter((l) => {
      const d = new Date(`${l.date}T00:00:00`);
      return d.getFullYear() === y && d.getMonth() === m && (!session || l.session === session);
    })
    .reduce((sum, l) => sum + durationMinutes(l), 0);
}

/** date(YYYY-MM-DD)와 같은 날짜인 로그의 분 합계(하루 상한 미적용, 원본 합계). */
function dailyRawMinutes(logs: OvertimeLog[], date: string): number {
  return logs.filter((l) => l.date === date).reduce((sum, l) => sum + durationMinutes(l), 0);
}

/** date의 하루 합계에 4시간 상한을 적용한 값. 아침 기록 후 저녁 기록이 더해져 4시간을 넘으면 4시간만 인정한다. */
export function dailyCappedMinutes(logs: OvertimeLog[], date: string): number {
  return Math.min(dailyRawMinutes(logs, date), DAILY_OVERTIME_CAP_MINUTES);
}

/**
 * monthDate와 같은 연/월의 총 합계(월 요약·예상 수당용). 날짜별로 4시간 상한을 적용한 뒤
 * 합산한다 — 즉 하루에 아침+저녁을 합쳐도 최대 4시간까지만 총합에 반영된다.
 */
export function monthlyCappedTotalMinutes(logs: OvertimeLog[], monthDate: Date): number {
  const y = monthDate.getFullYear();
  const m = monthDate.getMonth();
  const dates = new Set(
    logs
      .filter((l) => {
        const d = new Date(`${l.date}T00:00:00`);
        return d.getFullYear() === y && d.getMonth() === m;
      })
      .map((l) => l.date),
  );
  let total = 0;
  for (const date of dates) total += dailyCappedMinutes(logs, date);
  return total;
}

/** "12시간 30분" 형식. 0분이면 "0분". */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}분`;
  if (m === 0) return `${h}시간`;
  return `${h}시간 ${m}분`;
}

/**
 * 참고용 예상 수당(원). 실제 지급 규정의 공제·가산율 등 세부 보정은 반영하지 않은
 * 단순 계산(분/60 × 시간당 단가)이다.
 */
export function estimatedPay(minutes: number, hourlyRate: number): number {
  return Math.round((minutes / 60) * hourlyRate);
}

/** 현재 시각을 "HH:mm"으로 (원터치 출퇴근 버튼용) */
export function nowHHmm(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

/** 오늘 날짜를 "YYYY-MM-DD"로 */
export function todayYMD(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** 아침 원터치 로그 생성. now가 endTime 이후(같은 시각 포함)면 null. */
export function buildMorningPunchLog(date: string, now: string, endTime: string): OvertimeLog | null {
  if (now >= endTime) return null;
  return {
    id: crypto.randomUUID(),
    date,
    session: '아침',
    startTime: now,
    endTime,
    createdAt: new Date().toISOString(),
  };
}

/** 저녁 원터치 로그 생성. now가 startTime 이전(같은 시각 포함)이면 null. */
export function buildEveningPunchLog(date: string, now: string, startTime: string): OvertimeLog | null {
  if (now <= startTime) return null;
  return {
    id: crypto.randomUUID(),
    date,
    session: '저녁',
    startTime,
    endTime: now,
    createdAt: new Date().toISOString(),
  };
}
