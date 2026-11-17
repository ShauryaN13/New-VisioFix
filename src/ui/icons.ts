/**
 * Icons: a handful of SVGs copied from Lucide (lucide.dev, v1.73.0, ISC license;
 * full text in public/licenses/lucide.txt, which ships with the extension).
 * Only the icons VisioFix uses are copied; there is no Lucide package.
 *
 * All share Lucide's style: 24px grid, 2px round stroke. They're built with
 * createElementNS (no innerHTML) and are always decorative (aria-hidden):
 * the button or text next to an icon carries the meaning.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

type Shape = ['path', string] | ['circle', number, number, number] | ['rect', number, number, number, number, number];

const ICONS = {
  settings: [
    [
      'path',
      'M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915',
    ],
    ['circle', 12, 12, 3],
  ],
  x: [
    ['path', 'M18 6 6 18'],
    ['path', 'm6 6 12 12'],
  ],
  play: [['path', 'M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z']],
  pause: [
    ['rect', 14, 3, 5, 18, 1],
    ['rect', 5, 3, 5, 18, 1],
  ],
  skipBack: [
    ['path', 'M17.971 4.285A2 2 0 0 1 21 6v12a2 2 0 0 1-3.029 1.715l-9.997-5.998a2 2 0 0 1-.003-3.432z'],
    ['path', 'M3 20V4'],
  ],
  skipForward: [
    ['path', 'M21 4v16'],
    ['path', 'M6.029 4.285A2 2 0 0 0 3 6v12a2 2 0 0 0 3.029 1.715l9.997-5.998a2 2 0 0 0 .003-3.432z'],
  ],
  bookOpen: [
    ['path', 'M12 5v16'],
    [
      'path',
      'M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z',
    ],
  ],
  volume: [
    [
      'path',
      'M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z',
    ],
    ['path', 'M16 9a5 5 0 0 1 0 6'],
    ['path', 'M19.364 18.364a9 9 0 0 0 0-12.728'],
  ],
  chevronDown: [['path', 'm6 9 6 6 6-6']],
  chevronRight: [['path', 'm9 18 6-6-6-6']],
  arrowLeft: [
    ['path', 'm12 19-7-7 7-7'],
    ['path', 'M19 12H5'],
  ],
  check: [['path', 'M20 6 9 17l-5-5']],
  info: [
    ['circle', 12, 12, 10],
    ['path', 'M12 16v-4'],
    ['path', 'M12 8h.01'],
  ],
  ban: [
    ['circle', 12, 12, 10],
    ['path', 'M4.929 4.929 19.07 19.071'],
  ],
  rotateCw: [
    ['path', 'M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8'],
    ['path', 'M21 3v5h-5'],
  ],
  circleAlert: [
    ['circle', 12, 12, 10],
    ['path', 'M12 8v4'],
    ['path', 'M12 16h.01'],
  ],
  circleCheck: [
    ['circle', 12, 12, 10],
    ['path', 'm16 9-5.5 5.5L8 12'],
  ],
  circlePause: [
    ['circle', 12, 12, 10],
    ['path', 'M10 15V9'],
    ['path', 'M14 15V9'],
  ],
  externalLink: [
    ['path', 'M15 3h6v6'],
    ['path', 'M10 14 21 3'],
    ['path', 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6'],
  ],
} satisfies Record<string, Shape[]>;

export type IconName = keyof typeof ICONS;

export interface IconOptions {
  className?: string;
  /** Also fill the shape (used for the solid Play/Pause in the round Play button). */
  filled?: boolean;
}

export function icon(name: IconName, options: IconOptions = {}): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  setAll(svg, {
    viewBox: '0 0 24 24',
    width: '24',
    height: '24',
    fill: options.filled ? 'currentColor' : 'none',
    stroke: 'currentColor',
    'stroke-width': '2',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
    focusable: 'false',
    class: `icon ${options.className ?? ''}`.trim(),
  });
  for (const shape of ICONS[name] as Shape[]) svg.appendChild(shapeElement(shape));
  return svg;
}

function shapeElement(shape: Shape): SVGElement {
  const [tag] = shape;
  const el = document.createElementNS(SVG_NS, tag);
  if (shape[0] === 'path') setAll(el, { d: shape[1] });
  else if (shape[0] === 'circle') setAll(el, { cx: shape[1], cy: shape[2], r: shape[3] });
  else setAll(el, { x: shape[1], y: shape[2], width: shape[3], height: shape[4], rx: shape[5] });
  return el;
}

export function setAll(el: Element, attrs: Record<string, string | number>): void {
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value));
}
