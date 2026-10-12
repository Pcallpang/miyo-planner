import { describe, expect, it } from 'vitest';
import { defaultAppData } from './appData';
import { canConfirmStep, shouldShowOnboarding, advanceOnboarding } from './onboarding';

describe('처음 사용 안내', () => {
  const progress = { autoShow: true, step: 0, started: false, completed: false, checked: [] as string[] };
  it('로드 중, 기존 계정, 완료 계정에는 자동으로 뜨지 않는다', () => {
    expect(shouldShowOnboarding(undefined, false)).toBe(false);
    expect(shouldShowOnboarding(progress, true)).toBe(false);
    expect(shouldShowOnboarding({ ...progress, completed: true }, false)).toBe(false);
    expect(shouldShowOnboarding(progress, false)).toBe(true);
    expect(shouldShowOnboarding({ ...progress, started: true, step: 3 }, false)).toBe(true);
    expect(shouldShowOnboarding({ ...progress, autoShow: false, started: true }, false)).toBe(false);
  });
  it('연결되지 않은 구글 계정이나 서버 공용 Gemini 키를 개인 연결 완료로 처리하지 않는다', () => {
    const data = defaultAppData();
    expect(canConfirmStep('calendar', data, { connected: false, geminiUserKey: false })).toBe(false);
    expect(canConfirmStep('calendar', data, { connected: true, geminiUserKey: false })).toBe(true);
    expect(canConfirmStep('gemini', data, { connected: true, geminiUserKey: false })).toBe(false);
    expect(canConfirmStep('gemini', data, { connected: true, geminiUserKey: true })).toBe(true);
    expect(canConfirmStep('gemini', data, null)).toBe(false);
  });
  it('학교와 시간표를 실제로 입력해야 확인할 수 있다', () => {
    const data = defaultAppData();
    expect(canConfirmStep('school', data, null)).toBe(false);
    expect(canConfirmStep('timetable', data, null)).toBe(false);
    data.settings.school = { name: '테스트학교', schoolCode: '1', atptCode: 'B10' };
    data.timetable = { 1: [{ subject: '과학', room: '1-1' }] };
    expect(canConfirmStep('school', data, null)).toBe(true);
    expect(canConfirmStep('timetable', data, null)).toBe(true);
  });
  it('건너뛴 단계는 완료 체크하지 않고 마지막 단계에서만 안내를 종료한다', () => {
    const skipped = advanceOnboarding(progress, false);
    expect(skipped).toMatchObject({ step: 1, completed: false, checked: [] });
    const checked = advanceOnboarding(progress, true);
    expect(checked.checked).toEqual(['school']);
    expect(advanceOnboarding({ ...checked, step: 5 }, true)).toMatchObject({ completed: true, checked: ['school', 'alerts'] });
  });
});
