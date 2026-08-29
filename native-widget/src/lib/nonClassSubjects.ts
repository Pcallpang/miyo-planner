export const NON_CLASS_SUBJECTS = ['점심시간'];

export function isNonClassSubject(subject: string): boolean {
  return NON_CLASS_SUBJECTS.includes(subject.trim());
}
