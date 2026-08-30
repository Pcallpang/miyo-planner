import type { Timetable } from '../types';
import { isNonClassSubject } from './nonClassSubjects';

/** 위젯 배경이 어두운 반투명 카드(bg-black/35)라, 웹앱(밝은 카드)과 달리
 *  텍스트는 밝은 톤(200번대)을 쓴다. */
export const SUBJECT_COLORS = [
  { bg: 'bg-mint-100', text: 'text-mint-200', dot: 'bg-mint-400', name: '민트' },
  { bg: 'bg-sky-100', text: 'text-sky-200', dot: 'bg-sky-400', name: '스카이' },
  { bg: 'bg-amber-100', text: 'text-amber-200', dot: 'bg-amber-400', name: '앰버' },
  { bg: 'bg-rose-100', text: 'text-rose-200', dot: 'bg-rose-400', name: '로즈' },
  { bg: 'bg-violet-100', text: 'text-violet-200', dot: 'bg-violet-400', name: '보라' },
  { bg: 'bg-teal-100', text: 'text-teal-200', dot: 'bg-teal-400', name: '틸' },
  { bg: 'bg-orange-100', text: 'text-orange-200', dot: 'bg-orange-400', name: '오렌지' },
  { bg: 'bg-fuchsia-100', text: 'text-fuchsia-200', dot: 'bg-fuchsia-400', name: '푸시아' },
] as const;

export interface SubjectColor {
  bg: string;
  text: string;
  dot: string;
  name: string;
}

export const NON_CLASS_COLOR: SubjectColor = {
  bg: 'bg-yellow-200',
  text: 'text-yellow-200',
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
