import { beforeEach, describe, expect, test } from 'vitest';
import { getWidgetOpacity, getWidgetSize, setWidgetOpacity, setWidgetSize } from './widgetPrefs';

/** 이 저장소는 jsdom을 안 쓰므로, localStorage를 흉내 내는 메모리 저장소를 직접 만든다. */
function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
}

beforeEach(() => {
  (globalThis as unknown as { localStorage: Storage }).localStorage = createMemoryStorage();
});

describe('getWidgetOpacity / setWidgetOpacity', () => {
  test('저장된 값이 없으면 기본값 100을 반환한다', () => {
    expect(getWidgetOpacity()).toBe(100);
  });

  test('저장한 값을 그대로 돌려준다', () => {
    setWidgetOpacity(40);
    expect(getWidgetOpacity()).toBe(40);
  });

  test('0~100 범위를 벗어나면 반올림·경계값으로 자른다', () => {
    setWidgetOpacity(150);
    expect(getWidgetOpacity()).toBe(100);
    setWidgetOpacity(-20);
    expect(getWidgetOpacity()).toBe(0);
    setWidgetOpacity(55.6);
    expect(getWidgetOpacity()).toBe(56);
  });

  test('저장된 값이 깨져 있으면 기본값으로 되돌아간다', () => {
    localStorage.setItem('haru.widget.opacity', 'not-a-number');
    expect(getWidgetOpacity()).toBe(100);
  });
});

describe('getWidgetSize / setWidgetSize', () => {
  test('저장된 값이 없으면 기본 크기(320x420)를 반환한다', () => {
    expect(getWidgetSize()).toEqual({ width: 320, height: 420 });
  });

  test('저장한 크기를 그대로 돌려준다', () => {
    setWidgetSize({ width: 400, height: 500 });
    expect(getWidgetSize()).toEqual({ width: 400, height: 500 });
  });

  test('저장된 값이 깨져 있으면 기본 크기로 되돌아간다', () => {
    localStorage.setItem('haru.widget.size', '{ broken json');
    expect(getWidgetSize()).toEqual({ width: 320, height: 420 });
  });
});
