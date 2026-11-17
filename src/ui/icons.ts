/**
 * Icons, drawn on a 24px grid, built with createElementNS (no innerHTML).
 * Every icon is decorative (aria-hidden): the button or text next to it
 * carries the meaning, so screen readers never hear "image".
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

interface Shape {
  d: string;
  /** Filled shapes; everything else is a 2px rounded stroke. */
  fill?: boolean;
}

const ICONS = {
  close: [{ d: 'M6 6l12 12M18 6L6 18' }],
  play: [{ d: 'M8 5.2v13.6a.6.6 0 0 0 .9.5l10.6-6.8a.6.6 0 0 0 0-1L8.9 4.7a.6.6 0 0 0-.9.5z', fill: true }],
  pause: [{ d: 'M7 5h3.5v14H7zM13.5 5H17v14h-3.5z', fill: true }],
  previous: [{ d: 'M6 6v12' }, { d: 'M18 6.6v10.8a.6.6 0 0 1-.95.5L9.4 12.5a.6.6 0 0 1 0-1l7.65-5.4a.6.6 0 0 1 .95.5z', fill: true }],
  next: [{ d: 'M18 6v12' }, { d: 'M6 6.6v10.8a.6.6 0 0 0 .95.5l7.65-5.4a.6.6 0 0 0 0-1L6.95 6.1a.6.6 0 0 0-.95.5z', fill: true }],
  book: [{ d: 'M3 5.5c3-1.2 6-1 9 1v13c-3-2-6-2.2-9-1zM21 5.5c-3-1.2-6-1-9 1v13c3-2 6-2.2 9-1z' }],
  speaker: [{ d: 'M4 9.5h3.5L12 6v12l-4.5-3.5H4z' }, { d: 'M15.5 9.2a4 4 0 0 1 0 5.6M18.2 6.5a7.7 7.7 0 0 1 0 11' }],
  settings: [
    { d: 'M4 7h9M17 7h3M4 17h3M11 17h9' },
    { d: 'M15 4.8a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 1 0 0-4.4zM9 14.8a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 1 0 0-4.4z' },
  ],
  chevronDown: [{ d: 'M6 9l6 6 6-6' }],
  arrowRight: [{ d: 'M5 12h14M13 6l6 6-6 6' }],
  reload: [{ d: 'M20 12a8 8 0 1 1-2.3-5.7' }, { d: 'M20 4v5h-5' }],
  check: [{ d: 'M5 12.5l4.5 4.5L19 7.5' }],
  info: [{ d: 'M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18z' }, { d: 'M12 11v5.5M12 7.5v.01' }],
  blocked: [{ d: 'M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18z' }, { d: 'M5.7 5.7l12.6 12.6' }],
  power: [{ d: 'M12 3v8' }, { d: 'M6.6 6.6a7.8 7.8 0 1 0 10.8 0' }],
  textSmaller: [{ d: 'M4 18l5-12 5 12M5.7 14h6.6' }, { d: 'M16 12h5' }],
  textLarger: [{ d: 'M3 18l5-12 5 12M4.7 14h6.6' }, { d: 'M15 12h6M18 9v6' }],
} satisfies Record<string, Shape[]>;

export type IconName = keyof typeof ICONS;

export function icon(name: IconName, className?: string): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '24');
  svg.setAttribute('height', '24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  if (className) svg.setAttribute('class', className);
  for (const shape of ICONS[name] as Shape[]) {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', shape.d);
    if (shape.fill) {
      path.setAttribute('fill', 'currentColor');
    } else {
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', 'currentColor');
      path.setAttribute('stroke-width', '2');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
    }
    svg.appendChild(path);
  }
  return svg;
}

/**
 * The VisioFix mark (same geometry as src/assets/icon.svg, cropped to the tile).
 * Decorative: always shown next to the visible name "VisioFix".
 */
export function logoMark(className = 'logo-mark'): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '16 16 96 96');
  svg.setAttribute('width', '32');
  svg.setAttribute('height', '32');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('class', className);

  const tile = document.createElementNS(SVG_NS, 'rect');
  for (const [k, v] of Object.entries({ x: '16', y: '16', width: '96', height: '96', rx: '22', fill: '#0B0B0C' })) {
    tile.setAttribute(k, v);
  }
  const eye = document.createElementNS(SVG_NS, 'path');
  for (const [k, v] of Object.entries({
    d: 'M27 64 Q64 28 101 64 Q64 100 27 64 Z',
    fill: 'none',
    stroke: '#FFD400',
    'stroke-width': '7',
    'stroke-linejoin': 'round',
  })) {
    eye.setAttribute(k, v);
  }
  const iris = document.createElementNS(SVG_NS, 'circle');
  for (const [k, v] of Object.entries({ cx: '64', cy: '64', r: '14.5', fill: '#FFD400' })) {
    iris.setAttribute(k, v);
  }
  const check = document.createElementNS(SVG_NS, 'path');
  for (const [k, v] of Object.entries({
    d: 'M56.5 64.5 L61.8 69.8 L71.5 59.2',
    fill: 'none',
    stroke: '#0B0B0C',
    'stroke-width': '4.4',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  })) {
    check.setAttribute(k, v);
  }
  svg.append(tile, eye, iris, check);
  return svg;
}
