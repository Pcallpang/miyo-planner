import type { AppData, OnboardingProgress, ServerStatus, ViewId } from '../types';

export const SETUP_STEPS: { id: string; title: string; description: string; view: ViewId; target: string; instructions: string[] }[] = [
  { id: 'school', title: '우리 학교 등록', description: '학교를 등록하면 급식과 학사일정을 볼 수 있어요.', view: 'settings', target: 'setup-school', instructions: ['학교 이름을 두 글자 이상 입력하고 검색해 주세요.', '검색 결과에서 우리 학교를 선택해 주세요.'] },
  { id: 'periods', title: '교시 수와 일과 시간', description: '학교의 수업 시간에 맞춰 오늘의 일과를 준비해요.', view: 'settings', target: 'setup-periods', instructions: ['하루 교시 수를 정해 주세요.', '시간 편집을 눌러 각 교시의 시작·종료 시각을 확인해 주세요. 기본 시간이 맞으면 그대로 사용해도 돼요.'] },
  { id: 'timetable', title: '내 시간표 입력', description: '매주 반복되는 수업의 과목과 반을 채워 주세요.', view: 'timetable', target: 'setup-timetable', instructions: ['요일과 교시가 만나는 빈 칸을 눌러 과목과 반을 입력해 주세요.', '먼저 수업 한 칸을 입력해 보고, 나머지 수업도 같은 방법으로 채워 주세요.'] },
  { id: 'calendar', title: '구글 캘린더 연동', description: '내 일정을 불러오고, 플래너에서 만든 일정을 구글 캘린더에 등록해요.', view: 'settings', target: 'setup-calendar', instructions: ['연동 상태를 확인해 주세요. 로그인하면서 이미 연결되었다면 다시 연결할 필요가 없어요.', '연동되지 않았다면 구글 계정 연동을 누르고, 구글 화면에서 캘린더 접근 권한을 허용해 주세요.', '사용할 캘린더에서 일정이 저장될 캘린더를 선택해 주세요. 기본 캘린더를 그대로 써도 돼요.'] },
  { id: 'gemini', title: 'Gemini API 키 연결', description: '학교 쪽지를 붙여넣으면 AI가 일정과 할 일을 추출해 줘요. 필요한 경우에 연결하세요.', view: 'settings', target: 'setup-gemini', instructions: ['아래 키 발급 링크에서 Google AI Studio에 로그인해 주세요.', 'API 키 목록에서 키를 만들고 프로젝트를 선택하거나 생성해 주세요. 이미 발급한 키가 있으면 사용할 수 있어요.', '키를 복사해 Gemini API 키 입력란에 붙여넣고 연결을 눌러 주세요. 키는 다른 사람에게 공유하지 마세요.', '개인 키가 등록되면 이 단계의 확인 버튼이 활성화돼요. 실제 사용 가능 여부는 쪽지 분석 시 확인됩니다.'] },
  { id: 'alerts', title: '일정 알림 확인', description: '일정을 미리 알려 드릴 시간을 선택해 주세요.', view: 'settings', target: 'setup-alerts', instructions: ['일정 알림에서 몇 분 전에 알릴지 선택해 주세요. 알림이 필요 없다면 끔을 선택해도 돼요.', '브라우저가 알림 권한을 요청하면 허용해 주세요.'] },
];

export function shouldShowOnboarding(progress: OnboardingProgress | undefined, loading: boolean) {
  return !loading && progress?.autoShow === true && !progress.completed;
}

export function canConfirmStep(id: string, data: AppData, status: Pick<ServerStatus, 'connected' | 'geminiUserKey'> | null) {
  if (id === 'school') return !!data.settings.school;
  if (id === 'timetable') return Object.values(data.timetable).some(slots => slots.some(slot => slot.subject.trim()));
  if (id === 'calendar') return !!status?.connected;
  if (id === 'gemini') return !!status?.geminiUserKey;
  return true;
}

export function advanceOnboarding(progress: OnboardingProgress, confirmed: boolean): OnboardingProgress {
  const index = Math.max(0, Math.min(progress.step, SETUP_STEPS.length - 1));
  const id = SETUP_STEPS[index].id;
  return {
    ...progress, started: true,
    step: Math.min(index + 1, SETUP_STEPS.length - 1),
    completed: index === SETUP_STEPS.length - 1,
    checked: confirmed ? [...new Set([...progress.checked, id])] : progress.checked.filter(item => item !== id),
  };
}
