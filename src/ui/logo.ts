import { type BrandShape, CHOSEN_ICON, getConcept } from '@/assets/brand';
import { setAll } from '@/ui/icons';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * The VisioFix mark, drawn inline from the same data as the toolbar icon
 * (src/assets/brand.ts). Decorative: it always sits next to the visible name.
 * Below 24px it uses the simplified drawing made for small sizes.
 */
export function logoMark(size = 32, className = 'logo-mark', conceptId = CHOSEN_ICON): SVGSVGElement {
  const concept = getConcept(conceptId);
  const small = size < 24;
  const svg = document.createElementNS(SVG_NS, 'svg');
  setAll(svg, {
    viewBox: small ? '0 0 16 16' : '16 16 96 96',
    width: size,
    height: size,
    'aria-hidden': 'true',
    focusable: 'false',
    class: className,
  });
  for (const shape of small ? concept.small : concept.detailed) svg.appendChild(toElement(shape));
  return svg;
}

function toElement(shape: BrandShape): SVGElement {
  const el = document.createElementNS(SVG_NS, shape.tag);
  setAll(el, shape.attrs);
  return el;
}
