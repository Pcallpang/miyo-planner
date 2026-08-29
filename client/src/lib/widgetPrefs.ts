/** 위젯 창의 배경 진하기(0~100)와 마지막으로 조절한 창 크기를 localStorage에
 *  기억해 뒀다가, 다음에 위젯을 열 때 그대로 되살린다. */

const OPACITY_KEY = 'haru.widget.opacity';
const SIZE_KEY = 'haru.widget.size';

const DEFAULT_OPACITY = 100;
const DEFAULT_SIZE: WidgetSize = { width: 320, height: 420 };

export interface WidgetSize {
  width: number;
  height: number;
}

export function getWidgetOpacity(): number {
  const raw = localStorage.getItem(OPACITY_KEY);
  const n = raw === null ? NaN : Number(raw);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : DEFAULT_OPACITY;
}

export function setWidgetOpacity(value: number): void {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  localStorage.setItem(OPACITY_KEY, String(clamped));
}

export function getWidgetSize(): WidgetSize {
  const raw = localStorage.getItem(SIZE_KEY);
  if (!raw) return DEFAULT_SIZE;
  try {
    const parsed = JSON.parse(raw) as Partial<WidgetSize>;
    if (
      typeof parsed.width === 'number' &&
      typeof parsed.height === 'number' &&
      parsed.width > 0 &&
      parsed.height > 0
    ) {
      return { width: parsed.width, height: parsed.height };
    }
  } catch {
    /* 깨진 JSON이면 기본값으로 */
  }
  return DEFAULT_SIZE;
}

export function setWidgetSize(size: WidgetSize): void {
  localStorage.setItem(SIZE_KEY, JSON.stringify(size));
}
