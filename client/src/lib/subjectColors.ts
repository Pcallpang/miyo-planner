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

/**
 * 시간표 전체(모든 요일)를 훑어 처음 등장한 순서대로 과목마다 색을 하나씩 자동 배정한다.
 * overrides(과목 이름 -> SUBJECT_COLORS 인덱스)에 지정된 과목은 그 색을 그대로 쓰고,
 * 자동 배정 순서에서는 건너뛴다 — 다른 과목들이 색을 밀려 받지 않도록.
 */
export function buildSubjectColors(
  timetable: Timetable,
  overrides: Record<string, number> = {},
): Map<string, SubjectColor> {
  const map = new Map<string, SubjectColor>();
  let autoIndex = 0;
  for (const day of [1, 2, 3, 4, 5]) {
    for (const slot of timetable[day] ?? []) {
      const name = slot.subject.trim();
      if (!name || map.has(name) || isNonClassSubject(name)) continue;
      const overrideIndex = overrides[name];
      if (overrideIndex !== undefined && SUBJECT_COLORS[overrideIndex]) {
        map.set(name, SUBJECT_COLORS[overrideIndex]);
      } else {
        map.set(name, SUBJECT_COLORS[autoIndex % SUBJECT_COLORS.length]);
        autoIndex++;
      }
    }
  }
  return map;
}
