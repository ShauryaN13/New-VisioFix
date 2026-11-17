/**
 * The VisioFix icon, defined once as data.
 *   - scripts/build-icons.mjs turns it into the PNGs Chrome uses (public/icon/).
 *   - logoMark() in src/ui/logo.ts draws the same shapes inline in the popup,
 *     settings page and Focus Mode toolbar.
 * Plain data only (no imports, no enums), so Node can load this file directly.
 *
 * Two drawings per concept:
 *   - small: 16 and 32px (toolbar), drawn on a 16px grid, tile fills the canvas
 *   - detailed: 48 and 128px, 128px canvas with a 96px tile and 16px transparent
 *     padding (Chrome Web Store guidance)
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

export interface IconConcept {
  id: string;
  name: string;
  description: string;
  small: BrandShape[];
  detailed: BrandShape[];
}

const tileSmall: BrandShape = { tag: 'rect', attrs: { x: 0, y: 0, width: 16, height: 16, rx: 3.5, fill: BRAND.navy } };
const tileDetailed: BrandShape = {
  tag: 'rect',
  attrs: { x: 16, y: 16, width: 96, height: 96, rx: 22, fill: BRAND.navy },
};

const stroke = (d: string, width: number, color: string = BRAND.white): BrandShape => ({
  tag: 'path',
  attrs: { d, fill: 'none', stroke: color, 'stroke-width': width, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
});
const dot = (cx: number, cy: number, r: number, color: string = BRAND.yellow): BrandShape => ({
  tag: 'circle',
  attrs: { cx, cy, r, fill: color },
});

export const ICON_CONCEPTS: IconConcept[] = [
  {
    id: 'brackets',
    name: 'Code eye  < • >',
    description:
      'An eye whose corners are HTML angle brackets, with a yellow pupil: vision and code repair in one mark. At 16px it reads as “< • >”.',
    small: [
      tileSmall,
      stroke('M5.9 4.2 2.6 8l3.3 3.8', 1.7),
      stroke('M10.1 4.2 13.4 8l-3.3 3.8', 1.7),
      dot(8, 8, 2.1),
    ],
    detailed: [
      tileDetailed,
      // Thin lids with a small gap before each bracket, so the brackets still
      // read as < and > while together they form the eye's corners.
      stroke('M51 39Q64 30 77 39', 5.5),
      stroke('M51 89Q64 98 77 89', 5.5),
      stroke('M43 42 26 64l17 22', 8.5),
      stroke('M85 42l17 22-17 22', 8.5),
      dot(64, 64, 12.5),
    ],
  },
  {
    id: 'v-check',
    name: 'V check',
    description:
      'A V monogram with a short left arm, so it also reads as a check mark: “VisioFix fixed this”. Yellow on navy.',
    small: [tileSmall, stroke('M4.3 6.2 7.2 11.8 12 4.2', 2.2, BRAND.yellow)],
    detailed: [tileDetailed, stroke('M37 52 57 87 93 37', 12, BRAND.yellow)],
  },
  {
    id: 'focus-frame',
    name: 'Focus frame',
    description:
      'Viewfinder corners around a yellow point: bringing a page into focus. Ties the brand to Focus Mode; less about repairs.',
    small: [
      tileSmall,
      stroke('M3.2 6.2V3.2h3M9.8 3.2h3v3M12.8 9.8v3h-3M6.2 12.8h-3v-3', 1.5),
      dot(8, 8, 2.2),
    ],
    detailed: [
      tileDetailed,
      stroke('M34 52V34h18M76 34h18v18M94 76v18H76M52 94H34V76', 8),
      dot(64, 64, 13),
    ],
  },
];

/** The concept used for the real icon and logo mark (the recommendation, until chosen). */
export const CHOSEN_ICON = 'brackets';

export function getConcept(id: string): IconConcept {
  return ICON_CONCEPTS.find((c) => c.id === id) ?? (ICON_CONCEPTS[0] as IconConcept);
}

/** Serializes one drawing to an SVG string (used by the build script, not the extension). */
export function toSvgString(shapes: BrandShape[], viewBox: string, size: number): string {
  const body = shapes
    .map((s) => `<${s.tag} ${Object.entries(s.attrs).map(([k, v]) => `${k}="${v}"`).join(' ')}/>`)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${size}" height="${size}">${body}</svg>`;
}
