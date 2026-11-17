/**
 * The VisioFix icon ("code eye"), defined once as data.
 *   - scripts/build-icons.mjs turns it into the PNGs Chrome uses (public/icon/).
 *   - logoMark() in src/ui/logo.ts draws the same shapes inline in the popup,
 *     settings page and Focus Mode toolbar.
 * Plain data only (no imports, no enums), so Node can load this file directly.
 *
 * An eye whose corners are HTML angle brackets, with a yellow pupil: vision
 * and code repair in one mark. Two drawings:
 *   - small: 16 and 32px (toolbar), on a 16px grid, tile fills the canvas.
 *     No eyelids, so at 16px it reads as "< • >".
 *   - detailed: 48 and 128px, 128px canvas with a 96px tile and 16px transparent
 *     padding (Chrome Web Store guidance).
 */

export const BRAND = {
  /** Deep navy: the brand color for the icon tile and logo mark. */
  navy: '#0B1F4D',
  /** VisioFix yellow: only in the icon and Focus Mode's High contrast theme. */
  yellow: '#FFD400',
  white: '#FFFFFF',
} as const;

export interface BrandShape {
  tag: 'rect' | 'circle' | 'path';
  attrs: Record<string, string | number>;
}

const stroke = (d: string, width: number): BrandShape => ({
  tag: 'path',
  attrs: {
    d,
    fill: 'none',
    stroke: BRAND.white,
    'stroke-width': width,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  },
});
const pupil = (cx: number, cy: number, r: number): BrandShape => ({
  tag: 'circle',
  attrs: { cx, cy, r, fill: BRAND.yellow },
});

export const ICON: { small: BrandShape[]; detailed: BrandShape[] } = {
  small: [
    { tag: 'rect', attrs: { x: 0, y: 0, width: 16, height: 16, rx: 3.5, fill: BRAND.navy } },
    stroke('M5.9 4.2 2.6 8l3.3 3.8', 1.7),
    stroke('M10.1 4.2 13.4 8l-3.3 3.8', 1.7),
    pupil(8, 8, 2.1),
  ],
  detailed: [
    { tag: 'rect', attrs: { x: 16, y: 16, width: 96, height: 96, rx: 22, fill: BRAND.navy } },
    // Thin lids with a small gap before each bracket, so the brackets still
    // read as < and > while together they form the eye's corners.
    stroke('M51 39Q64 30 77 39', 5.5),
    stroke('M51 89Q64 98 77 89', 5.5),
    stroke('M43 42 26 64l17 22', 8.5),
    stroke('M85 42l17 22-17 22', 8.5),
    pupil(64, 64, 12.5),
  ],
};

/** Serializes one drawing to an SVG string (used by the build script, not the extension). */
export function toSvgString(shapes: BrandShape[], viewBox: string, size: number): string {
  const body = shapes
    .map((s) => `<${s.tag} ${Object.entries(s.attrs).map(([k, v]) => `${k}="${v}"`).join(' ')}/>`)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${size}" height="${size}">${body}</svg>`;
}
