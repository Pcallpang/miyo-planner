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
  /** 핑크·오렌지·옐로우는 밝고 화사한 느낌을 살리기 위해 mint 램프보다 전체적으로
   *  밝고 채도 높은 곡선을 쓴다(다른 팔레트와 명도 곡선이 다르다). */
  pink: {
    '50': '#fdf2f8', '100': '#fce7f3', '200': '#fbcfe8', '300': '#f9a8d4', '400': '#f472b6',
    '500': '#ec4899', '600': '#db2777', '700': '#be185d', '800': '#9d174d', '900': '#831843',
  },
  orange: {
    '50': '#fff7ed', '100': '#ffedd5', '200': '#fed7aa', '300': '#fdba74', '400': '#fb923c',
    '500': '#f97316', '600': '#ea580c', '700': '#c2410c', '800': '#9a3412', '900': '#7c2d12',
  },
  yellow: {
    '50': '#fffbeb', '100': '#fef3c7', '200': '#fde68a', '300': '#fcd34d', '400': '#fbbf24',
    '500': '#f59e0b', '600': '#d97706', '700': '#b45309', '800': '#92400e', '900': '#78350f',
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

  // 모바일 브라우저 주소창/상태표시줄(PWA 포함) 색도 함께 맞춘다.
  const themeColorTag = document.querySelector('meta[name="theme-color"]');
  themeColorTag?.setAttribute('content', shades['500']);
}
