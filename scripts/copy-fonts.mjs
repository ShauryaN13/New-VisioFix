// Copies the Atkinson Hyperlegible Next files VisioFix uses from the pinned
// @fontsource package into public/fonts/, which ships with the extension.
// Only woff2 (Chrome reads it; the older woff copies would just add size),
// weights 400 and 700, normal and italic, Latin and Latin Extended subsets.
// Run with: npm run fonts   (again after upgrading the package)
import { copyFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const pkg = `${root}node_modules/@fontsource/atkinson-hyperlegible-next`;
const outDir = `${root}public/fonts`;
mkdirSync(outDir, { recursive: true });

for (const subset of ['latin', 'latin-ext']) {
  for (const weight of [400, 700]) {
    for (const style of ['normal', 'italic']) {
      const name = `atkinson-hyperlegible-next-${subset}-${weight}-${style}.woff2`;
      copyFileSync(`${pkg}/files/${name}`, `${outDir}/${name}`);
      console.log(`public/fonts/${name}`);
    }
  }
}
// The SIL Open Font License requires the license to travel with the fonts.
mkdirSync(`${root}public/licenses`, { recursive: true });
copyFileSync(`${pkg}/LICENSE`, `${root}public/licenses/atkinson-hyperlegible-next-OFL.txt`);
console.log('public/licenses/atkinson-hyperlegible-next-OFL.txt');
