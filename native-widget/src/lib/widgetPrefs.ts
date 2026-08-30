/** 위젯 카드 배경의 반투명 정도(0~100, 숫자가 클수록 더 어둡고 잘 안 비침)를
 *  기억해 뒀다가 다음에 켤 때 그대로 되살린다. */

const OPACITY_KEY = 'miyo.widget.opacity';
const DEFAULT_OPACITY = 35;
/** 0까지 내리면 카드가 완전히 투명해져 끄기·설정 버튼까지 안 보이게 되고, 그 값이
 *  저장돼 다시 켜도 그대로라 되돌릴 방법이 사실상 없어진다. 그래서 하한을 둔다.
 *  (예전에 0으로 저장해 둔 값이 있어도 아래 clamp가 읽을 때 끌어올려 준다.) */
const MIN_OPACITY = 15;
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
