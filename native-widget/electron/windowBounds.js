const fs = require('node:fs');
const path = require('node:path');
const { app } = require('electron');

const DEFAULT_BOUNDS = { width: 320, height: 420 };

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
    width: bounds.width, height: bounds.height, x: bounds.x, y: bounds.y,
  }));
}

module.exports = { loadWindowBounds, saveWindowBounds };
