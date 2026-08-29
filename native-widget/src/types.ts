export interface PeriodTime {
  start: string; // HH:mm
  end: string; // HH:mm
}

export interface PeriodSlot {
  subject: string;
  room: string;
}

/** 요일(1=월 ~ 5=금) → 교시별 과목/반 */
export type Timetable = Record<number, PeriodSlot[]>;

export interface CanceledLesson {
  date: string; // YYYY-MM-DD
  period: number;
}

export interface SwapOverride {
  date: string; // YYYY-MM-DD
  period: number;
  subject: string;
  room: string;
}

export interface MakeupLesson {
  date: string; // YYYY-MM-DD
  period: number;
  subject: string;
  room: string;
}

/** 서버 /api/data가 돌려주는 state 중 이 위젯이 실제로 쓰는 부분만 뽑은 타입.
 *  서버 응답은 이보다 필드가 훨씬 많지만(AppData), 구조적으로 호환된다. */
export interface WidgetData {
  timetable: Timetable;
  settings: {
    periodCount: number;
    periodTimes: PeriodTime[];
  };
  canceledLessons: CanceledLesson[];
  swapOverrides: SwapOverride[];
  makeupLessons: MakeupLesson[];
  subjectColors: Record<string, number>;
}
