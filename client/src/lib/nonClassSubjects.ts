/**
 * 점심시간처럼 시간표 칸에는 표시하고 싶지만 실제 수업은 아닌 이름들. 시간표 칸에
 * 이 이름을 그대로 입력하면 되고, 색상 자동 배정과 차시 계획표(총 수업차시/진행
 * 차시) 양쪽에서 제외된다.
 */
export const NON_CLASS_SUBJECTS = ['점심시간'];

export function isNonClassSubject(subject: string): boolean {
  return NON_CLASS_SUBJECTS.includes(subject.trim());
}
