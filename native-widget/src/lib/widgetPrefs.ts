/** 위젯 카드 배경의 반투명 정도(0~100, 숫자가 클수록 더 어둡고 잘 안 비침)를
 *  기억해 뒀다가 다음에 켤 때 그대로 되살린다. */

const OPACITY_KEY = 'miyo.widget.opacity';
const DEFAULT_OPACITY = 35;
const MIN_OPACITY = 0;
const MAX_OPACITY = 90;

function clamp(value: number): number {
  if (Number.isNaN(value)) return DEFAULT_OPACITY;
  return Math.min(MAX_OPACITY, Math.max(MIN_OPACITY, value));
}

export function getOpacity(): number {
  const raw = localStorage.getItem(OPACITY_KEY);
  if (raw === null) return DEFAULT_OPACITY;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? clamp(parsed) : DEFAULT_OPACITY;
}

export function setOpacity(value: number): void {
  localStorage.setItem(OPACITY_KEY, String(clamp(value)));
}
