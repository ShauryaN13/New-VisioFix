// Renders the icon to the PNG sizes Chrome needs, from src/assets/brand.ts.
//   16, 32  -> toolbar (the "small" drawing)
//   48, 128 -> extensions page and Chrome Web Store (the "detailed" drawing)
// WXT picks up public/icon/<size>.png automatically.
// Also renders every concept into preview/concepts/ for the design preview.
// Run with: npm run icons
import { Resvg } from '@resvg/resvg-js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
// Node runs this TypeScript file directly (type stripping, Node 23.6+).
import { CHOSEN_ICON, ICON_CONCEPTS, getConcept, toSvgString } from '../src/assets/brand.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const SIZES = [16, 32, 48, 128];

function render(concept, size) {
  const small = size <= 32;
  const svg = small
    ? toSvgString(concept.small, '0 0 16 16', size)
    : toSvgString(concept.detailed, '0 0 128 128', size);
  return new Resvg(svg, { fitTo: { mode: 'width', value: size }, shapeRendering: 2 }).render().asPng();
}

mkdirSync(`${root}public/icon`, { recursive: true });
const chosen = getConcept(CHOSEN_ICON);
for (const size of SIZES) {
  writeFileSync(`${root}public/icon/${size}.png`, render(chosen, size));
}
console.log(`public/icon/{${SIZES.join(',')}}.png  (${chosen.id})`);

mkdirSync(`${root}preview/concepts`, { recursive: true });
for (const concept of ICON_CONCEPTS) {
  for (const size of SIZES) {
    writeFileSync(`${root}preview/concepts/${concept.id}-${size}.png`, render(concept, size));
  }
  console.log(`preview/concepts/${concept.id}-{${SIZES.join(',')}}.png`);
}
