import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Checks every text/background pair in the design against WCAG 2.2:
 *   - popup and settings: AA, 4.5:1 for text, 3:1 for control outlines and focus rings
 *   - Focus Mode: AAA, 7:1 for text, 3:1 for outlines, rings and the reading underline
 * Colors are read straight from the CSS, so changing a color that breaks
 * contrast fails this test.
 */

// (Not `new URL(path, import.meta.url)`: Vite rewrites that pattern as an asset import.)
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');

function luminance(hex: string): number {
  const value = hex.replace('#', '');
  const channels = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)) as [
    number,
    number,
    number,
  ];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Popup/settings tokens: `--name: light-dark(#light, #dark);` */
function uiTokens(): { light: Record<string, string>; dark: Record<string, string> } {
  const light: Record<string, string> = {};
  const dark: Record<string, string> = {};
  for (const m of read('src/ui/tokens.css').matchAll(/--([\w-]+):\s*light-dark\((#[0-9a-f]{6}),\s*(#[0-9a-f]{6})\)/gi)) {
    light[m[1]!] = m[2]!;
    dark[m[1]!] = m[3]!;
  }
  return { light, dark };
}

/** Focus Mode themes: `.vf-focus[data-theme='x'] { --f-name: #hex; }` */
function focusThemes(): Record<string, Record<string, string>> {
  const themes: Record<string, Record<string, string>> = {};
  for (const block of read('src/focus/focus.css').matchAll(/\.vf-focus\[data-theme='(\w+)'\]\s*\{([^}]*)\}/g)) {
    const vars: Record<string, string> = {};
    for (const m of block[2]!.matchAll(/--f-([\w-]+):\s*(#[0-9a-f]{6})/gi)) vars[m[1]!] = m[2]!;
    themes[block[1]!] = vars;
  }
  return themes;
}

type Pair = [foreground: string, background: string, minimum: number];

const AA = 4.5;
const AAA = 7;
const NON_TEXT = 3;

const UI_PAIRS: Pair[] = [
  ['text', 'bg', AA],
  ['text', 'surface', AA],
  ['text', 'tint', AA], // rows grouped on a tint
  ['text', 'tint-strong', AA], // keyboard shortcut chips, hover
  ['text-muted', 'bg', AA],
  ['text-muted', 'surface', AA],
  ['text-muted', 'tint', AA],
  ['accent', 'surface', AA], // "See what changed", text buttons
  ['accent', 'bg', AA], // Back button
  ['accent', 'tint-strong', AA], // Back button on hover
  ['on-accent', 'accent', AA], // primary button text
  ['on-accent', 'accent-hover', AA],
  ['on-accent', 'accent-press', AA],
  ['on-accent-soft', 'accent-soft', AA], // tiles, tonal buttons
  ['on-accent-soft', 'accent-soft-hover', AA],
  ['control-border', 'surface', NON_TEXT], // switch, inputs, outlined buttons
  ['control-border', 'bg', NON_TEXT],
  ['control-border', 'tint', NON_TEXT],
  ['control-border', 'tint-strong', NON_TEXT], // switch knob on its track (off)
  ['accent', 'surface', NON_TEXT], // switch track (on)
  ['status-on', 'surface', NON_TEXT], // status dot
  ['focus', 'surface', NON_TEXT],
  ['focus', 'bg', NON_TEXT],
];

const FOCUS_PAIRS: Pair[] = [
  ['text', 'bg', AAA],
  ['h1', 'bg', AAA],
  ['h2', 'bg', AAA],
  ['h3', 'bg', AAA],
  ['link', 'bg', AAA],
  ['muted', 'bg', AAA],
  ['text', 'code-bg', AAA],
  ['control-text', 'toolbar-bg', AAA], // site name, Close
  ['control-text', 'round-bg', AAA], // "Aa", previous/next
  ['control-text', 'control-hover', AAA],
  ['control-text', 'panel-bg', AAA], // Aa panel labels
  ['primary-text', 'primary-bg', AAA], // Play
  ['primary-text', 'primary-hover', AAA],
  ['hl-text', 'hl-bg', AAA], // the sentence being read
  ['control-border', 'toolbar-bg', NON_TEXT], // Close outline
  ['control-border', 'bg', NON_TEXT], // "read from here" button
  ['primary-bg', 'toolbar-bg', NON_TEXT], // Play button shape
  ['range', 'panel-bg', NON_TEXT], // sliders and radios in the panel
  ['progress', 'progress-track', NON_TEXT],
  ['focus', 'bg', NON_TEXT],
  ['focus', 'toolbar-bg', NON_TEXT],
  ['focus', 'panel-bg', NON_TEXT],
  ['hl-line', 'hl-bg', NON_TEXT], // underline under the sentence being read
  ['quote-bar', 'bg', NON_TEXT],
  ['notice-border', 'bg', NON_TEXT],
];

describe('popup and settings colors (WCAG AA)', () => {
  const tokens = uiTokens();
  for (const scheme of ['light', 'dark'] as const) {
    for (const [fg, bg, min] of UI_PAIRS) {
      it(`${scheme}: ${fg} on ${bg} ≥ ${min}:1`, () => {
        const a = tokens[scheme][fg];
        const b = tokens[scheme][bg];
        expect(a, `missing token --${fg}`).toBeDefined();
        expect(b, `missing token --${bg}`).toBeDefined();
        expect(contrast(a!, b!)).toBeGreaterThanOrEqual(min);
      });
    }
  }
});

describe('Focus Mode colors (WCAG AAA)', () => {
  const themes = focusThemes();

  it('defines all three themes', () => {
    expect(Object.keys(themes).sort()).toEqual(['contrast', 'dark', 'light']);
  });

  it('keeps the original high-contrast palette', () => {
    expect(themes.contrast).toMatchObject({
      bg: '#000000',
      h1: '#ffff00',
      h2: '#ffd700',
      text: '#ffffff',
      link: '#00ffff',
    });
  });

  for (const theme of ['contrast', 'dark', 'light']) {
    for (const [fg, bg, min] of FOCUS_PAIRS) {
      it(`${theme}: ${fg} on ${bg} ≥ ${min}:1`, () => {
        const a = themes[theme]?.[fg];
        const b = themes[theme]?.[bg];
        expect(a, `missing --f-${fg}`).toBeDefined();
        expect(b, `missing --f-${bg}`).toBeDefined();
        expect(contrast(a!, b!)).toBeGreaterThanOrEqual(min);
      });
    }
  }
});

describe('brand', () => {
  it('logo yellow on its tile is high contrast', () => {
    expect(contrast('#FFD400', '#0B0B0C')).toBeGreaterThanOrEqual(AAA);
  });
  it('the contrast helper matches known values', () => {
    expect(contrast('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrast('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
  });
});
