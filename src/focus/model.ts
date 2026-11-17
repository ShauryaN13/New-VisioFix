/**
 * Focus Mode's content model: the page's main content reduced to a small set of
 * semantic blocks. Phase 4 builds this from Readability's output (or the
 * fallback extractor); the view renders it as real HTML elements so screen
 * readers navigate it natively.
 */

export type Inline =
  | string
  | { kind: 'link'; href: string; children: Inline[] }
  | { kind: 'strong' | 'em' | 'code'; children: Inline[] };

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export type Block =
  | { kind: 'heading'; level: HeadingLevel; content: Inline[] }
  | { kind: 'paragraph'; content: Inline[] }
  /** Each item is a list of blocks, so items can hold nested lists. */
  | { kind: 'list'; ordered: boolean; items: Block[][] }
  | { kind: 'quote'; blocks: Block[] }
  | { kind: 'code'; text: string }
  /** alt "" = decorative. Images with no alt at all are dropped before this point. */
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
