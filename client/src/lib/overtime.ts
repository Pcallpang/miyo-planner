import type { OvertimeLog, OvertimeSession } from '../types';

/** 국내 학교에서 흔히 쓰는 월 초과근무 수당 지급 상한(57시간) */
export const OVERTIME_MONTHLY_CAP_MINUTES = 57 * 60;

/** 하루 초과근무 인정 상한(4시간). 아침+저녁 합산이 이를 넘으면 초과분은 합계에서 제외한다. */
export const DAILY_OVERTIME_CAP_MINUTES = 4 * 60;

/**
 * 하루 초과근무 공제 시간(1시간). 그날의 아침+저녁 합계에서 이만큼을 뺀 나머지만 인정한다
 * (0보다 작으면 0). 세션이 하나뿐이면 그 세션에서 그대로 빠지고("~만 1시간 미만이면 산입 불가,
 * 1시간 이상이면 초과분만 산입"), 아침+저녁을 모두 기록했으면 공제는 하루에 한 번만 적용돼
 * 먼저 채워지는 세션(보통 아침)에서 소진되고 나머지 세션은 그대로 전액 더해진다("아침이 1시간
 * 넘으면 저녁은 1시간 미만이어도 그대로 산입 가능").
 */
export const DAILY_OVERTIME_GRACE_MINUTES = 60;

/**
 * 종료-시작(분)에서 방과후 차감(afterSchoolMinutes)을 뺀 값. 종료가 시작보다 빠르거나
 * 차감이 전체 시간보다 크면 0(자정을 넘긴 경우는 다루지 않음).
 */
export function durationMinutes(
  log: Pick<OvertimeLog, 'startTime' | 'endTime' | 'afterSchoolMinutes'>,
): number {
  const [sh, sm] = log.startTime.split(':').map(Number);
  const [eh, em] = log.endTime.split(':').map(Number);
  const diff = eh * 60 + em - (sh * 60 + sm);
  const raw = diff > 0 ? diff : 0;
  return Math.max(0, raw - (log.afterSchoolMinutes ?? 0));
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

/** date(YYYY-MM-DD)와 같은 날짜·세션인 로그의 분 합계(원본, 공제 미적용). */
function dailySessionMinutes(logs: OvertimeLog[], date: string, session: OvertimeSession): number {
  return logs
    .filter((l) => l.date === date && l.session === session)
    .reduce((sum, l) => sum + durationMinutes(l), 0);
}

/** date(YYYY-MM-DD)와 같은 날짜인 로그의 분 합계(하루 상한 미적용, 원본 합계). */
function dailyRawMinutes(logs: OvertimeLog[], date: string): number {
  return logs.filter((l) => l.date === date).reduce((sum, l) => sum + durationMinutes(l), 0);
}

/**
 * date 하루치 1시간 공제를 아침/저녁 세션에 나눠 적용한 값(4시간 상한 적용 전).
 * 공제 1시간은 아침에서 먼저 소진되고, 아침이 1시간을 못 채우면 남은 공제만큼 저녁에서
 * 마저 빠진다 — dailyCappedMinutes(공제 후 아침+저녁 합계)와 항상 일치한다.
 */
function dailyCountedBySession(logs: OvertimeLog[], date: string): Record<OvertimeSession, number> {
  const morning = dailySessionMinutes(logs, date, '아침');
  const evening = dailySessionMinutes(logs, date, '저녁');
  const morningCounted = Math.max(0, morning - DAILY_OVERTIME_GRACE_MINUTES);
  const graceLeftForEvening = Math.max(0, DAILY_OVERTIME_GRACE_MINUTES - morning);
  const eveningCounted = Math.max(0, evening - graceLeftForEvening);

  const total = morningCounted + eveningCounted;
  const cappedTotal = Math.min(total, DAILY_OVERTIME_CAP_MINUTES);
  if (cappedTotal === total) return { 아침: morningCounted, 저녁: eveningCounted };
  // 4시간 상한에 걸리면 두 세션 몫을 같은 비율로 줄인다(합계가 정확히 상한과 맞도록 저녁으로 보정).
  const scaledMorning = Math.round((morningCounted * cappedTotal) / total);
  return { 아침: scaledMorning, 저녁: cappedTotal - scaledMorning };
}

/**
 * date의 하루 합계에 1시간 공제를 적용한 뒤 4시간 상한을 적용한 값.
 * 예) 아침 30분만 → 0분. 아침 1시간 30분만 → 30분(초과분만). 아침 1시간 30분 + 저녁 20분
 * → 50분(아침 초과분 30분 + 저녁 전액 20분, 공제 1시간은 아침에서 소진).
 */
export function dailyCappedMinutes(logs: OvertimeLog[], date: string): number {
  const afterGrace = Math.max(0, dailyRawMinutes(logs, date) - DAILY_OVERTIME_GRACE_MINUTES);
  return Math.min(afterGrace, DAILY_OVERTIME_CAP_MINUTES);
}

/**
 * 로그 하나의 "인정 시간"(1시간 공제 반영, 실제 근무 시간과 다를 수 있다). 기록 목록의
 * 시작~종료 시각 아래에 이 값을 보여준다. 같은 날짜·세션에 로그가 여럿이면 그 세션의
 * 인정 시간을 실제 시간 비율대로 나눠 갖는다(보통은 하루 세션당 로그가 하나라 그대로 배정된다).
 */
export function countedMinutesForLog(logs: OvertimeLog[], log: OvertimeLog): number {
  const counted = dailyCountedBySession(logs, log.date)[log.session];
  const rawForSession = dailySessionMinutes(logs, log.date, log.session);
  if (rawForSession === 0) return 0;
  const raw = durationMinutes(log);
  if (rawForSession === raw) return counted; // 흔한 경우: 그 세션에 이 로그뿐
  return Math.round((counted * raw) / rawForSession);
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
 * 수당이 지급되는 시간 수. 분 단위는 절삭한다 —
 * 초과근무 수당은 시간 단위로만 지급되므로 8시간 19분은 8시간으로 친다.
 * 절삭은 월 합계에 한 번만 적용한다(날짜별로 버리지 않는다).
 */
export function payableHours(minutes: number): number {
  return Math.floor(minutes / 60);
}

/**
 * 참고용 예상 수당(원). 분 단위를 절삭한 시간 수 × 시간당 단가로 계산한다.
 * 실제 지급 규정의 공제·가산율 등 세부 보정은 반영하지 않는다.
 */
export function estimatedPay(minutes: number, hourlyRate: number): number {
  return Math.round(payableHours(minutes) * hourlyRate);
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
