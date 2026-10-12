type TargetRect = { left: number; top: number; right: number; bottom: number };
export function tourPosition(target: TargetRect | null, viewportWidth: number, viewportHeight: number, cardHeight: number) {
  const width = Math.min(340, viewportWidth - 24);
  const desktop = viewportWidth >= 1280;
  const maxHeight = Math.max(100, desktop ? viewportHeight - 24 : Math.min(360, viewportHeight * 0.46));
  const height = Math.min(cardHeight, maxHeight);
  return {
    width, maxHeight,
    left: desktop && target ? Math.min(target.right + 20, viewportWidth - width - 12) : viewportWidth - width - 12,
    top: desktop && target ? Math.max(12, Math.min(target.top, viewportHeight - height - 12)) : Math.max(12, viewportHeight - height - 12),
  };
}
