import type { Settings } from '../types';

export type ColorThemeId = Settings['colorTheme'];

type Ramp = Record<'50' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900', string>;

/** 각 팔레트는 index.css의 기본 mint 램프와 같은 명도 곡선(50=밝음 → 900=어두움)을
 *  유지하도록 만들었다 — 색상환만 다르고 대비/가독성 단계는 그대로다. */
export const COLOR_THEMES: Record<ColorThemeId, Ramp> = {
  mint: {
    '50': '#f0fbf8', '100': '#d9f5ee', '200': '#b3ebdd', '300': '#7edcc5', '400': '#45c5a8',
    '500': '#23ab8e', '600': '#178a74', '700': '#146e5e', '800': '#14584d', '900': '#134940',
  },
  blue: {
    '50': '#f0f4f9', '100': '#d8e3f4', '200': '#b2caeb', '300': '#7ca5de', '400': '#3577d4',
    '500': '#1f5aad', '600': '#17488c', '700': '#13386c', '800': '#133058', '900': '#122949',
  },
  purple: {
    '50': '#f4f0f9', '100': '#e3d8f4', '200': '#cab2eb', '300': '#a57cde', '400': '#7735d4',
    '500': '#5a1fad', '600': '#48178c', '700': '#38136c', '800': '#301358', '900': '#291249',
  },
  pink: {
    '50': '#f9f0f5', '100': '#f4d8e6', '200': '#ebb2cf', '300': '#de7cad', '400': '#d43585',
    '500': '#ad1f66', '600': '#8c1752', '700': '#6c1340', '800': '#581336', '900': '#49122e',
  },
  orange: {
    '50': '#f9f5f0', '100': '#f4e5d8', '200': '#ebcdb2', '300': '#deaa7c', '400': '#d47f35',
    '500': '#ad611f', '600': '#8c4e17', '700': '#6c3d13', '800': '#583313', '900': '#492c12',
  },
};

export const COLOR_THEME_IDS = Object.keys(COLOR_THEMES) as ColorThemeId[];

/** 선택된 팔레트를 <html>에 인라인 CSS 변수로 덮어써 mint-* 유틸리티 클래스 전체를
 *  리스킨한다. mint(기본)를 고르면 인라인 오버라이드를 지워 index.css의 값이 다시 보이게 한다. */
export function applyColorTheme(theme: ColorThemeId) {
  const root = document.documentElement.style;
  const shades = COLOR_THEMES[theme];
  (Object.keys(shades) as (keyof Ramp)[]).forEach((shade) => {
    if (theme === 'mint') {
      root.removeProperty(`--color-mint-${shade}`);
    } else {
      root.setProperty(`--color-mint-${shade}`, shades[shade]);
    }
  });
}
