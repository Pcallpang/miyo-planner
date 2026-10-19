import { useSyncExternalStore } from 'react';
import { DEV_LOG, type DevLogEntry } from '../data/devLog';

const STORAGE_KEY = 'haru.devLogSeen';

/** 항목 하나를 가리키는 값. 최신 항목이 바뀌면 "안 읽음"으로 본다. */
export function devLogKey(entry: DevLogEntry | undefined): string {
  return entry ? `${entry.date}|${entry.title}` : '';
}

/** 저장된 값과 최신 항목을 비교해 안 읽은 새 소식이 있는지 판단한다. */
export function hasUnreadDevLog(seenKey: string | null, log: DevLogEntry[] = DEV_LOG): boolean {
  return log.length > 0 && seenKey !== devLogKey(log[0]);
}

function readSeen(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

// 저장소를 못 쓰는 환경(사생활 보호 창 등)에서도 이번 방문 동안은 배지가 꺼지도록 메모리에도 둔다.
let seen: string | null = readSeen();
const listeners = new Set<() => void>();

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** 개발 노트를 확인했다고 표시한다(배지가 사라진다). */
export function markDevLogSeen(): void {
  const key = devLogKey(DEV_LOG[0]);
  if (seen === key) return;
  seen = key;
  try {
    localStorage.setItem(STORAGE_KEY, key);
  } catch {
    // 저장 실패는 무시 — 다음 방문에 배지가 다시 뜰 뿐이다.
  }
  listeners.forEach((cb) => cb());
}

/** 개발 노트에 아직 안 본 새 소식이 있는지. 여러 컴포넌트가 같은 상태를 공유한다. */
export function useDevLogUnread(): boolean {
  const current = useSyncExternalStore(subscribe, () => seen);
  return hasUnreadDevLog(current);
}
