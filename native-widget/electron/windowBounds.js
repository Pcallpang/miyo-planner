const fs = require('node:fs');
const path = require('node:path');
const { app } = require('electron');

/** height는 "펼침" 상태의 창 높이, minimizedHeight는 "최소화" 상태의 창 높이를
 *  따로 기억한다 — 최소화 토글이 이 두 값 사이로 창 자체를 리사이즈하기 때문에,
 *  같은 값 하나로 두 상태를 겸하면 사용자가 한쪽에서 크기를 조절할 때마다 다른
 *  쪽 크기까지 덩달아 바뀌어 버린다. */
const DEFAULT_BOUNDS = { width: 320, height: 420, minimizedHeight: 140 };

function boundsFilePath() {
  return path.join(app.getPath('userData'), 'window-bounds.json');
}

function loadWindowBounds() {
  try {
    return { ...DEFAULT_BOUNDS, ...JSON.parse(fs.readFileSync(boundsFilePath(), 'utf-8')) };
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
  }));
}

module.exports = { loadWindowBounds, saveWindowBounds };
