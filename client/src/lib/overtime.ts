import type { OvertimeLog, OvertimeSession } from '../types';

/** 국내 학교에서 흔히 쓰는 월 초과근무 수당 지급 상한(57시간) */
export const OVERTIME_MONTHLY_CAP_MINUTES = 57 * 60;

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
