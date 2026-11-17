// Renders the icon SVGs to the PNG sizes Chrome needs.
//   16, 32  -> toolbar (from the simplified design)
//   48, 128 -> extensions page and Chrome Web Store (from the detailed design)
// WXT picks up public/icon/<size>.png automatically and adds them to the manifest.
// Run with: npm run icons
import { Resvg } from '@resvg/resvg-js';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const outDir = `${root}public/icon`;
mkdirSync(outDir, { recursive: true });

const sources = {
  small: readFileSync(`${root}src/assets/icon-small.svg`, 'utf8'),
  detailed: readFileSync(`${root}src/assets/icon.svg`, 'utf8'),
};

const sizes = [
  [16, 'small'],
  [32, 'small'],
  [48, 'detailed'],
  [128, 'detailed'],
];

for (const [size, design] of sizes) {
  const png = new Resvg(sources[design], {
    fitTo: { mode: 'width', value: size },
    shapeRendering: 2, // geometricPrecision: anti-aliased edges
  })
    .render()
    .asPng();
  writeFileSync(`${outDir}/${size}.png`, png);
  console.log(`public/icon/${size}.png (${design})`);
}
