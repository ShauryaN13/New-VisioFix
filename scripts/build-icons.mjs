// Renders the VisioFix icon to the PNG sizes Chrome needs, from src/assets/brand.ts.
//   16, 32  -> toolbar (the "small" drawing)
//   48, 128 -> extensions page and Chrome Web Store (the "detailed" drawing)
// WXT picks up public/icon/<size>.png automatically.
// Run with: npm run icons
import { Resvg } from '@resvg/resvg-js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
// Node runs this TypeScript file directly (type stripping, Node 23.6+).
import { ICON, toSvgString } from '../src/assets/brand.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const SIZES = [16, 32, 48, 128];

mkdirSync(`${root}public/icon`, { recursive: true });
for (const size of SIZES) {
  const svg =
    size <= 32 ? toSvgString(ICON.small, '0 0 16 16', size) : toSvgString(ICON.detailed, '0 0 128 128', size);
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: size }, shapeRendering: 2 }).render().asPng();
  writeFileSync(`${root}public/icon/${size}.png`, png);
}
console.log(`public/icon/{${SIZES.join(',')}}.png`);
