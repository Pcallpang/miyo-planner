import type { Timetable } from '../types';
import { isNonClassSubject } from './nonClassSubjects';

/** 시간표 칸 배경/글자색 + 색상 선택창에 쓰는 동그란 점(dot) 색 + 한글 이름. */
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

export type SubjectColor = (typeof SUBJECT_COLORS)[number];

/** 색상 저장/조회에 쓰는 (과목, 반) 키. 반이 달라도 같은 과목이면 기본은 같은 색을
 *  쓰지만, 이 키 단위로 따로 지정할 수 있다. */
export function classColorKey(subject: string, className: string): string {
  return `${subject.trim()}::${className.trim()}`;
}

/**
 * 시간표 전체(모든 요일)를 훑어, 처음 등장한 순서대로 과목마다 색을 하나씩 자동
 * 배정한다 — 같은 과목은 반이 달라도 기본은 같은 색을 공유한다. overrides(반별
 * classColorKey -> SUBJECT_COLORS 인덱스)에 지정된 (과목, 반) 조합은 그 반만 다른
 * 색을 쓰고, 자동 배정 순서에는 영향을 주지 않는다.
 */
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
      if (!name || isNonClassSubject(name)) continue;
      const className = slot.room.trim();
      const key = classColorKey(name, className);
      if (map.has(key)) continue;

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
