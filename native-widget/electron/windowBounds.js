const fs = require('node:fs');
const path = require('node:path');
const { app } = require('electron');

/** height는 "펼침" 상태의 창 높이, minimizedHeight는 "최소화" 상태의 창 높이를
 *  따로 기억한다 — 최소화 토글이 이 두 값 사이로 창 자체를 리사이즈하기 때문에,
 *  같은 값 하나로 두 상태를 겸하면 사용자가 한쪽에서 크기를 조절할 때마다 다른
 *  쪽 크기까지 덩달아 바뀌어 버린다.
 *
 *  opacity(배경 진하기)도 여기서 같이 저장한다 — 예전에는 렌더러의 localStorage에
 *  따로 저장했는데, 재시작 후 안 돌아오는 문제가 있었다. 창 크기는 이 파일로 저장해서
 *  항상 잘 돌아왔던 것과 같은 방식(메인 프로세스가 디스크에 직접 쓰기)으로 통일한다. */
const DEFAULT_BOUNDS = { width: 320, height: 420, minimizedHeight: 140, opacity: 35 };
const MIN_OPACITY = 15;
const MAX_OPACITY = 90;

/** 0까지 내리면 카드가 완전히 투명해져 끄기·설정 버튼까지 안 보이게 되고, 그 값이
 *  저장돼 다시 켜도 그대로라 되돌릴 방법이 사실상 없어진다. 그래서 하한을 둔다. */
function clampOpacity(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return DEFAULT_BOUNDS.opacity;
  return Math.min(MAX_OPACITY, Math.max(MIN_OPACITY, num));
}

function boundsFilePath() {
  return path.join(app.getPath('userData'), 'window-bounds.json');
}

function loadWindowBounds() {
  try {
    const merged = { ...DEFAULT_BOUNDS, ...JSON.parse(fs.readFileSync(boundsFilePath(), 'utf-8')) };
    return { ...merged, opacity: clampOpacity(merged.opacity) };
  } catch {
    return DEFAULT_BOUNDS;
  }
}

function saveWindowBounds(bounds) {
  fs.writeFileSync(boundsFilePath(), JSON.stringify({
    width: bounds.width,
    height: bounds.height,
    minimizedHeight: bounds.minimizedHeight,
    x: bounds.x,
    y: bounds.y,
    wasMinimized: bounds.wasMinimized,
    opacity: bounds.opacity,
  }));
}

module.exports = { loadWindowBounds, saveWindowBounds, clampOpacity };
