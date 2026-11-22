import type { PublicPath } from 'wxt/browser';

/**
 * Focus Mode's font: the bundled Atkinson Hyperlegible Next files.
 *
 * @font-face rules inside a shadow root don't apply in Chrome, so the faces
 * are registered on the page's document with the FontFace API, under a family
 * name no site will use ("VisioFix Atkinson"), only while Focus Mode is open.
 * The files are web-accessible with a per-session URL (use_dynamic_url), so a
 * site can't use them to detect VisioFix.
 *
 * If a site blocks the font, focus.css falls back to the system sans-serif.
 * The unicode ranges match src/ui/fonts.css (checked by a test), so the Latin
 * Extended files only download when the text needs them.
 */

export const FOCUS_FONT_FAMILY = 'VisioFix Atkinson';

export const LATIN_RANGE =
  'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';
export const LATIN_EXT_RANGE =
  'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF';

const FACES: { path: PublicPath; weight: string; style: string; range: string }[] = [
  { path: '/fonts/atkinson-hyperlegible-next-latin-400-normal.woff2', weight: '400', style: 'normal', range: LATIN_RANGE },
  { path: '/fonts/atkinson-hyperlegible-next-latin-400-italic.woff2', weight: '400', style: 'italic', range: LATIN_RANGE },
  { path: '/fonts/atkinson-hyperlegible-next-latin-700-normal.woff2', weight: '700', style: 'normal', range: LATIN_RANGE },
  { path: '/fonts/atkinson-hyperlegible-next-latin-700-italic.woff2', weight: '700', style: 'italic', range: LATIN_RANGE },
  { path: '/fonts/atkinson-hyperlegible-next-latin-ext-400-normal.woff2', weight: '400', style: 'normal', range: LATIN_EXT_RANGE },
  { path: '/fonts/atkinson-hyperlegible-next-latin-ext-400-italic.woff2', weight: '400', style: 'italic', range: LATIN_EXT_RANGE },
  { path: '/fonts/atkinson-hyperlegible-next-latin-ext-700-normal.woff2', weight: '700', style: 'normal', range: LATIN_EXT_RANGE },
  { path: '/fonts/atkinson-hyperlegible-next-latin-ext-700-italic.woff2', weight: '700', style: 'italic', range: LATIN_EXT_RANGE },
];

/** Files in web_accessible_resources (the manifest lists exactly these). */
export const FONT_FILES = FACES.map((face) => face.path.slice(1));

let faces: FontFace[] | null = null;

/** Adds the faces to the page. Safe to call again; loaded faces are reused. */
export function addFocusFont(): void {
  if (typeof FontFace === 'undefined' || !document.fonts) return;
  faces ??= FACES.map(
    (face) =>
      new FontFace(FOCUS_FONT_FAMILY, `url("${browser.runtime.getURL(face.path)}") format("woff2")`, {
        weight: face.weight,
        style: face.style,
        unicodeRange: face.range,
        display: 'swap',
      }),
  );
  for (const face of faces) document.fonts.add(face);
}

/** Takes the faces off the page again when Focus Mode closes. */
export function removeFocusFont(): void {
  for (const face of faces ?? []) document.fonts.delete(face);
}
