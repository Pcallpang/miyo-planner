/** 서버 응답(AppData 전체) 중 위젯이 실제로 화면에 쓰는 부분만 뽑는다.
 *  할 일·메모·회의·초과근무 기록 등 나머지는 디스크 캐시에 아예 남기지 않는다.
 *  (Electron에 의존하지 않는 순수 함수 — 그래서 별도 파일로 두고 테스트한다.) */
function toWidgetData(state) {
  return {
    timetable: state.timetable,
    settings: {
      periodCount: state.settings.periodCount,
      periodTimes: state.settings.periodTimes,
    },
    canceledLessons: state.canceledLessons,
    swapOverrides: state.swapOverrides,
    makeupLessons: state.makeupLessons,
    subjectColors: state.subjectColors,
  };
}

module.exports = { toWidgetData };
