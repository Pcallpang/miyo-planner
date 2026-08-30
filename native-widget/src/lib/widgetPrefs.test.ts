import { beforeEach, describe, expect, test } from 'vitest';
import { getMinimized, getOpacity, setMinimized, setOpacity } from './widgetPrefs';

/** 이 프로젝트는 jsdom을 안 쓰므로, localStorage를 흉내 내는 메모리 저장소를 직접 만든다. */
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

describe('getOpacity / setOpacity', () => {
  test('저장된 값이 없으면 기본값(35)을 반환한다', () => {
    expect(getOpacity()).toBe(35);
  });

  test('저장한 값을 그대로 돌려준다', () => {
    setOpacity(60);
    expect(getOpacity()).toBe(60);
  });

  test('범위(15~90)를 벗어나면 잘라낸다', () => {
    setOpacity(150);
    expect(getOpacity()).toBe(90);
    setOpacity(-20);
    expect(getOpacity()).toBe(15);
  });

  test('예전에 0으로 저장해 둔 값도 읽을 때 하한(15)으로 끌어올린다', () => {
    localStorage.setItem('miyo.widget.opacity', '0');
    expect(getOpacity()).toBe(15);
  });

  test('저장된 값이 숫자가 아니면 기본값으로 되돌아간다', () => {
    localStorage.setItem('miyo.widget.opacity', 'not-a-number');
    expect(getOpacity()).toBe(35);
  });
});

describe('getMinimized / setMinimized', () => {
  test('저장된 값이 없으면 기본값(false, 펼침)을 반환한다', () => {
    expect(getMinimized()).toBe(false);
  });

  test('true로 저장하면 true를 돌려준다', () => {
    setMinimized(true);
    expect(getMinimized()).toBe(true);
  });

  test('false로 저장하면 false를 돌려준다', () => {
    setMinimized(true);
    setMinimized(false);
    expect(getMinimized()).toBe(false);
  });
});
