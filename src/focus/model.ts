/**
 * Focus Mode's content model: the page's main content reduced to a small set of
 * semantic blocks. extract.ts builds it from Readability's output (or the
 * fallback extractor) through the allow-list in build.ts; the view renders it
 * as real HTML elements so screen readers navigate it natively.
 *
 * Text is plain strings with whitespace already collapsed. The only line
 * breaks ("
") come from <br> in the page (addresses, poems).
 */

export type Inline =
  | string
  | { kind: 'link'; href: string; children: Inline[] }
  /**
   * del: struck-out text ("June 1" replaced by "June 15"); dropping it would change the meaning.
   * sup/sub: footnote markers and formulas, which otherwise run into the word before them.
   */
  | { kind: 'strong' | 'em' | 'code' | 'del' | 'sup' | 'sub'; children: Inline[] };

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export type Block =
  | { kind: 'heading'; level: HeadingLevel; content: Inline[] }
  | { kind: 'paragraph'; content: Inline[] }
  /** Each item is a list of blocks, so items can hold nested lists. */
  | { kind: 'list'; ordered: boolean; items: Block[][] }
  | { kind: 'quote'; blocks: Block[] }
  | { kind: 'code'; text: string }
  /** alt "" only when the caption describes the image. Images with no description, and decorative ones, are dropped before this point. */
  | { kind: 'figure'; src: string; alt: string; caption: Inline[] | null };

export interface FocusDoc {
  title: string;
  siteName: string | null;
  byline: string | null;
  /** The page's language, so screen readers and read-aloud pick the right voice. */
  lang: string | null;
  dir: 'ltr' | 'rtl' | null;
  /** True when Readability found no article and the fallback extractor was used. */
  isFallback: boolean;
  /** True when the page was so long that Focus Mode stopped partway. */
  truncated: boolean;
  blocks: Block[];
}

export type FocusTheme = 'contrast' | 'dark' | 'light';

export const THEMES: { id: FocusTheme; label: string }[] = [
  { id: 'contrast', label: 'High contrast' },
  { id: 'dark', label: 'Dark' },
  { id: 'light', label: 'Light' },
];

/** Text sizes in CSS pixels. */
export const TEXT_SIZES = [16, 18, 20, 22, 24, 28, 32, 40] as const;
export const DEFAULT_TEXT_SIZE = 22;

export const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;
export const DEFAULT_SPEED = 1;

export interface FocusSettings {
  theme: FocusTheme;
  textSize: number;
  speed: number;
}

/** Average silent reading speed for adults (words per minute). */
const WORDS_PER_MINUTE = 230;

/** Plain text of a list of inlines. */
export function inlineText(inlines: Inline[]): string {
  return inlines.map((i) => (typeof i === 'string' ? i : inlineText(i.children))).join('');
}

/** Plain text of a block (and its children). */
export function blockText(block: Block): string {
  switch (block.kind) {
    case 'heading':
    case 'paragraph':
      return inlineText(block.content);
    case 'list':
      return block.items.map((item) => item.map(blockText).join(' ')).join(' ');
    case 'quote':
      return block.blocks.map(blockText).join(' ');
    case 'code':
      return block.text;
    case 'figure':
      return block.caption ? inlineText(block.caption) : '';
  }
}

export function wordCount(doc: FocusDoc): number {
  const text = [doc.title, ...doc.blocks.map(blockText)].join(' ');
  return text.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}

/** Estimated reading time in whole minutes (at least 1). */
export function readingMinutes(doc: FocusDoc): number {
  return Math.max(1, Math.round(wordCount(doc) / WORDS_PER_MINUTE));
}
