import type { Timetable } from '../types';
import { isNonClassSubject } from './nonClassSubjects';

/** 과목 칸은 옅은 파스텔 배경(bg-*-100) 위에 진한 텍스트(text-*-800)를 얹어
 *  대비를 준다 — 웹앱의 시간표 칸(밝은 카드 위)과 같은 조합이라 위젯의 어두운
 *  카드 배경과 무관하게 칸 자체는 항상 읽힌다. */
export const SUBJECT_COLORS = [
  { bg: 'bg-mint-100', text: 'text-mint-800', dot: 'bg-mint-400', name: '민트' },
  { bg: 'bg-sky-100', text: 'text-sky-800', dot: 'bg-sky-400', name: '스카이' },
  { bg: 'bg-amber-100', text: 'text-amber-800', dot: 'bg-amber-400', name: '앰버' },
  { bg: 'bg-rose-100', text: 'text-rose-800', dot: 'bg-rose-400', name: '로즈' },
  { bg: 'bg-violet-100', text: 'text-violet-800', dot: 'bg-violet-400', name: '보라' },
  { bg: 'bg-teal-100', text: 'text-teal-800', dot: 'bg-teal-400', name: '틸' },
  { bg: 'bg-orange-100', text: 'text-orange-800', dot: 'bg-orange-400', name: '오렌지' },
  { bg: 'bg-fuchsia-100', text: 'text-fuchsia-800', dot: 'bg-fuchsia-400', name: '푸시아' },
] as const;

export interface SubjectColor {
  bg: string;
  text: string;
  dot: string;
  name: string;
}

export const NON_CLASS_COLOR: SubjectColor = {
  bg: 'bg-yellow-200',
  text: 'text-yellow-900',
  dot: 'bg-yellow-400',
  name: '점심',
};

export function classColorKey(subject: string, className: string): string {
  return `${subject.trim()}::${className.trim()}`;
}

export function buildSubjectColors(
  timetable: Timetable,
  overrides: Record<string, number> = {},
): Map<string, SubjectColor> {
  const map = new Map<string, SubjectColor>();
  const autoBySubject = new Map<string, SubjectColor>();
  let autoIndex = 0;
  for (const day of [1, 2, 3, 4, 5]) {
    for (const slot of timetable[day] ?? []) {
      const name = slot.subject.trim();
      if (!name) continue;
      const className = slot.room.trim();
      const key = classColorKey(name, className);
      if (map.has(key)) continue;

      if (isNonClassSubject(name)) {
        map.set(key, NON_CLASS_COLOR);
        continue;
      }

      const overrideIndex = overrides[key];
      if (overrideIndex !== undefined && SUBJECT_COLORS[overrideIndex]) {
        map.set(key, SUBJECT_COLORS[overrideIndex]);
        continue;
      }

      let autoColor = autoBySubject.get(name);
      if (!autoColor) {
        autoColor = SUBJECT_COLORS[autoIndex % SUBJECT_COLORS.length];
        autoBySubject.set(name, autoColor);
        autoIndex++;
      }
      map.set(key, autoColor);
    }
  }
  return map;
}
