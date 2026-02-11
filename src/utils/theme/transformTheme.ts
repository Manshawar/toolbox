import type { AppConfig } from '@/store/types';

const body = document.documentElement as HTMLElement;

/** 简单 hex 颜色混合（weight 0~1，越大约接近 color2） */
function mixHex(color1: string, color2: string, weight: number): string {
  const hex = (c: string) => {
    const n = parseInt(c.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const [r1, g1, b1] = hex(color1);
  const [r2, g2, b2] = hex(color2);
  const r = Math.round(r1 + (r2 - r1) * weight);
  const g = Math.round(g1 + (g2 - g1) * weight);
  const b = Math.round(b1 + (b2 - b1) * weight);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

export function updateColor(primaryColor: string, themeMode: 'light' | 'dark') {
  if (!primaryColor) return;

  const style = document.getElementById('admin-style-root-color');

  const mixColor = themeMode === 'dark' ? '#141414' : '#ffffff';
  let innerHTML = `html${themeMode === 'dark' ? '.dark' : ''}:root{ --el-color-primary: ${primaryColor};\n`;

  for (let i = 1; i <= 9; i++) {
    innerHTML += `--el-color-primary-light-${i}: ${mixHex(primaryColor, mixColor, i * 0.1)};\n`;
  }

  if (style) style.innerHTML = `${innerHTML}}`;
}

export function themeHtmlClassName(className: string, isShow: boolean) {
  if (isShow) {
    body.classList.add(className);
  } else {
    body.classList.remove(className);
  }
}

export function configTheme(appConfig: AppConfig) {
  if (!appConfig) return;
  const { primaryColor, themeMode, colorWeaknessMode, greyMode } = appConfig;

  updateColor(primaryColor, themeMode);
  if (greyMode || colorWeaknessMode) {
    if (greyMode) themeHtmlClassName('html-grey', greyMode);
    else if (colorWeaknessMode) themeHtmlClassName('html-weakness', colorWeaknessMode);
  }
}
