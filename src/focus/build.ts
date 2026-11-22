import { TAG_ATTR } from '@/repair/changes';
import type { Block, HeadingLevel, Inline } from './model';

/**
 * Turns part of a page into Focus Mode blocks through an allow-list.
 *
 * Kept, with their meaning: headings h1–h6 (levels unchanged), paragraphs,
 * lists (nested too), quotes, code blocks, figures with captions, images that
 * have a description, and inside text: links, strong, emphasis, code,
 * struck-out text, superscript and subscript.
 * Everything else becomes plain text. Tables become a list with one item per
 * row ("Monday: 9 a.m. – 9 p.m."); tables used for layout are read cell by cell.
 * Decorative images (alt="") are left out: they add nothing to a reading view.
 *
 * Nothing is copied from the page as HTML: the result is plain data (strings,
 * link addresses, image sources and descriptions), and the view creates fresh
 * elements from it. So no scripts, styles, classes or event handlers can come
 * along.
 *
 * Text that sits outside a <p> (directly in a <div>, for example) becomes its
 * own paragraph, so nothing readable is skipped (legacy bug 6). Paragraphs are
 * never shortened, and short headings and paragraphs are kept (bugs 7 and 13).
 */

export interface BuildOptions {
  /** Resolves relative links and image sources. */
  baseUrl: string;
  /** The page's own address: links that only jump within it become plain text. */
  pageUrl: string;
  /**
   * Page regions to leave out. Menus are always left out. 'landmarks' (the
   * fallback, when the page isn't an article) also leaves out sidebars,
   * footers and dialogs.
   */
  skip?: 'navigation' | 'landmarks';
  /** Stop after this many blocks, so huge pages can't freeze the tab. */
  maxBlocks?: number;
}

export interface BuildResult {
  blocks: Block[];
  truncated: boolean;
}

const DEFAULT_MAX_BLOCKS = 4000;

/** Never shown: not text, or page controls that do nothing in a reading view. */
const SKIP_TAGS = new Set([
  'script', 'style', 'noscript', 'template', 'head', 'title', 'meta', 'link', 'base',
  'svg', 'math', 'canvas', 'iframe', 'frame', 'frameset', 'object', 'embed', 'video', 'audio',
  'source', 'track', 'map', 'area', 'input', 'select', 'textarea', 'button', 'option',
  'optgroup', 'datalist', 'output', 'progress', 'meter', 'dialog', 'slot', 'hr', 'wbr',
  // A form field's label means nothing once the field itself is gone.
  'label',
  'visiofix-ui',
]);

/** Site menus, always left out. By element and role, never class names. */
const NAVIGATION_TAGS = new Set(['nav']);
const NAVIGATION_ROLES = new Set(['navigation', 'search', 'menu', 'menubar']);
/** Also left out in the fallback: extras around the main text. */
const LANDMARK_TAGS = new Set([...NAVIGATION_TAGS, 'aside', 'footer']);
const LANDMARK_ROLES = new Set([...NAVIGATION_ROLES, 'complementary', 'contentinfo', 'dialog', 'alertdialog']);

/** Elements that start a new block. Anything else is treated as part of the text around it. */
const BLOCK_TAGS = new Set([
  'address', 'article', 'aside', 'blockquote', 'body', 'caption', 'center', 'dd', 'details', 'dir', 'div',
  'dl', 'dt', 'fieldset', 'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'header', 'hgroup', 'legend', 'li', 'main', 'menu', 'nav', 'ol', 'p', 'pre', 'search', 'section',
  'summary', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'ul',
]);

/**
 * Set by extract.ts on its copy of the page: an inline element (a <span>, a
 * link) that the page displays as a block, so it's treated as one here.
 */
export const BLOCK_MARK = 'data-vf-block';

/**
 * Also set by extract.ts: an inline element with a margin the page uses
 * instead of a space ("before", "after" or "both"). Without it, words in
 * separate <span>s run together ("in Kyiv" + "and" → "in Kyivand").
 */
export const GAP_MARK = 'data-vf-gap';

export function isBlockTag(tag: string): boolean {
  return BLOCK_TAGS.has(tag);
}

const LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);

/** An image while its paragraph is being collected; becomes a figure or its description. */
interface ImagePiece {
  kind: 'image';
  src: string;
  alt: string;
}
type Piece =
  | string
  | ImagePiece
  | { kind: 'link'; href: string; children: Piece[] }
  | { kind: 'strong' | 'em' | 'code' | 'del' | 'sup' | 'sub'; children: Piece[] };

/** A link that wraps whole blocks (a card: <a><h3>Title</h3><p>Summary</p></a>). */
interface LinkContext {
  href: string;
  used: boolean;
}

export function buildBlocks(root: Element, options: BuildOptions): BuildResult {
  const builder = new Builder(options);
  const blocks = builder.blocks(root, null);
  return { blocks, truncated: builder.truncated };
}

class Builder {
  truncated = false;
  private count = 0;
  private readonly max: number;

  constructor(private readonly opts: BuildOptions) {
    this.max = opts.maxBlocks ?? DEFAULT_MAX_BLOCKS;
  }

  /** The children of a container, as blocks. Loose text between blocks becomes paragraphs. */
  blocks(parent: Element, link: LinkContext | null): Block[] {
    const out: Block[] = [];
    let run: Piece[] = [];
    const flush = () => {
      if (run.length > 0) out.push(...this.paragraph(run, link));
      run = [];
    };

    for (const node of Array.from(parent.childNodes)) {
      if (this.truncated) break;
      if (node.nodeType === Node.TEXT_NODE) {
        run.push(text(node));
        continue;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      const el = node as Element;
      if (this.skip(el)) continue;

      if (BLOCK_TAGS.has(el.localName) || el.getAttribute('role') === 'heading') {
        flush();
        out.push(...this.block(el, link));
      } else if (hasBlockInside(el)) {
        // An inline element wrapping blocks, like a link around a whole card.
        flush();
        const href = el.localName === 'a' ? this.linkTarget(el) : null;
        out.push(...this.blocks(el, href && !link ? { href, used: false } : link));
      } else if (el.hasAttribute(BLOCK_MARK)) {
        // A <span> or link the page shows on its own line: its own paragraph.
        flush();
        out.push(...this.paragraph(this.inline(el), link));
      } else {
        run.push(...this.inline(el));
      }
    }
    flush();
    return out;
  }

  private block(el: Element, link: LinkContext | null): Block[] {
    const tag = el.localName;
    const level = headingLevel(el);
    if (level !== null) return this.heading(el, level, link);

    switch (tag) {
      case 'p':
        return this.paragraph(this.inlineChildren(el), link);
      case 'ul':
      case 'ol':
      case 'menu':
      case 'dir':
        return this.list(el, tag === 'ol', link);
      case 'blockquote': {
        const blocks = this.blocks(el, link);
        return blocks.length > 0 ? [this.add({ kind: 'quote', blocks })] : [];
      }
      case 'pre':
        return this.code(el);
      case 'figure':
        return this.figure(el, link);
      case 'table':
        return this.table(el, link);
      case 'dt':
        // A term in a description list: shown in bold, its description follows.
        return this.paragraph([{ kind: 'strong', children: this.inlineChildren(el) }], link);
      default:
        // div, section, article, li outside a list, and so on: just a container.
        return this.blocks(el, link);
    }
  }

  private heading(el: Element, level: HeadingLevel, link: LinkContext | null): Block[] {
    const content = this.withLink(tidy(this.resolveImages(this.inlineChildren(el))), link);
    if (!hasWords(content)) return [];
    return [this.add({ kind: 'heading', level, content })];
  }

  /** One paragraph from collected text. A "paragraph" of only images becomes figures instead. */
  private paragraph(pieces: Piece[], link: LinkContext | null): Block[] {
    if (this.truncated) return [];
    const images = onlyImages(pieces);
    if (images) {
      return images
        .filter((img) => img.alt !== '') // decorative
        .map((img) => this.add({ kind: 'figure', src: img.src, alt: img.alt, caption: null }));
    }
    const content = this.withLink(tidy(this.resolveImages(pieces)), link);
    if (!hasWords(content)) return [];
    return [this.add({ kind: 'paragraph', content })];
  }

  private list(el: Element, ordered: boolean, link: LinkContext | null): Block[] {
    const items: Block[][] = [];
    for (const child of Array.from(el.children)) {
      if (this.truncated) break;
      if (this.skip(child)) continue;
      const blocks = this.blocks(child, link);
      if (blocks.length > 0) items.push(blocks);
    }
    return items.length > 0 ? [this.add({ kind: 'list', ordered, items })] : [];
  }

  private code(el: Element): Block[] {
    // textContent keeps the code's own spacing and line breaks.
    const value = (el.textContent ?? '').replace(/^\n/, '').replace(/\s+$/, '');
    return value.trim() ? [this.add({ kind: 'code', text: value })] : [];
  }

  private figure(el: Element, link: LinkContext | null): Block[] {
    const images = Array.from(el.querySelectorAll('img')).filter((img) => !this.skippedInside(img, el));
    const captionEl = Array.from(el.children).find((child) => child.localName === 'figcaption') ?? null;
    const image = images.length === 1 ? images[0] : undefined;
    if (!image) return this.blocks(el, link); // a quote with a caption, or a gallery

    const caption = captionEl ? tidy(this.resolveImages(this.inlineChildren(captionEl))) : [];
    const captionOrNull = hasWords(caption) ? caption : null;
    const src = imageSource(image, this.opts.baseUrl);
    // The caption sits right under the image, so an image without its own
    // description is still shown, with alt="" (the caption describes it).
    // Without a caption, decorative images (alt="") are left out.
    const alt = imageAlt(image) ?? (captionOrNull ? '' : null);
    if (src && alt !== null && (alt || captionOrNull)) {
      return [this.add({ kind: 'figure', src, alt, caption: captionOrNull })];
    }
    return captionOrNull ? [this.add({ kind: 'paragraph', content: captionOrNull })] : [];
  }

  private table(el: Element, link: LinkContext | null): Block[] {
    const table = el as HTMLTableElement;
    const rows = Array.from(table.rows ?? []);
    if (rows.length === 0) return this.blocks(el, link);
    if (isLayoutTable(table, rows)) {
      // A table used to lay out the page: read it cell by cell, like any other container.
      return rows.flatMap((row) => Array.from(row.cells).flatMap((cell) => this.blocks(cell, link)));
    }

    // A data table: one list item per row. A header row labels the values
    // instead of being a row of its own:
    //   Day | Hours, then Monday | 9–9   →  "Monday: 9–9"
    //   Name | Age, then Ana | 34        →  "Name: Ana · Age: 34"
    //   Day | Open | Close, then Mon | 9 | 5  →  "Mon — Open: 9 · Close: 5"
    const out: Block[] = [];
    if (table.caption) out.push(...this.paragraph([{ kind: 'strong', children: this.inlineChildren(table.caption) }], link));
    const cellsOf = (row: HTMLTableRowElement) =>
      Array.from(row.cells).map((cell) => ({
        header: cell.localName === 'th',
        content: tidy(this.resolveImages(this.inlineChildren(cell))),
      }));
    const first = rows[0] ? cellsOf(rows[0]) : [];
    const columnHeaders = first.length > 1 && first.every((cell) => cell.header) ? first.map((cell) => cell.content) : null;

    const items: Block[][] = [];
    for (const row of columnHeaders ? rows.slice(1) : rows) {
      if (this.truncated) break;
      // A row that's only a picture (the photo at the top of an infobox): show it.
      const images = onlyImages(Array.from(row.cells).flatMap((cell) => this.inlineChildren(cell)));
      if (images) {
        const figures = images
          .filter((img) => img.alt !== '')
          .map((img) => this.add({ kind: 'figure', src: img.src, alt: img.alt, caption: null }));
        if (figures.length > 0) items.push(figures);
        continue;
      }
      const cells = cellsOf(row);
      // Labels only line up when the row has one cell per header (no merged cells).
      const labels = columnHeaders && columnHeaders.length === cells.length ? columnHeaders : null;
      const rowHeader = cells.length > 1 && cells[0]?.header ? cells[0] : null;
      const values = cells
        .map((cell, i) => ({ ...cell, label: labels?.[i] ?? null }))
        .slice(rowHeader ? 1 : 0)
        .filter((cell) => hasWords(cell.content));
      if (values.length === 0) continue;
      const content: Inline[] = [];
      if (rowHeader) content.push(...rowHeader.content, values.length > 1 ? ' — ' : ': ');
      values.forEach((cell, i) => {
        if (i > 0) content.push(' · ');
        // With a row header and a single value, "Monday: 9–9" says it all.
        if (cell.label && hasWords(cell.label) && (!rowHeader || values.length > 1)) content.push(...cell.label, ': ');
        content.push(...cell.content);
      });
      items.push([this.add({ kind: 'paragraph', content: tidy(content) })]);
    }
    if (items.length > 0) out.push(this.add({ kind: 'list', ordered: false, items }));
    return out;
  }

  /* ---------------- Inline content ---------------- */

  private inlineChildren(el: Element): Piece[] {
    const out: Piece[] = [];
    for (const node of Array.from(el.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE) out.push(text(node));
      else if (node.nodeType === Node.ELEMENT_NODE) out.push(...this.inline(node as Element));
    }
    return out;
  }

  private inline(el: Element): Piece[] {
    if (this.skip(el)) return [];
    const pieces = this.inlineContent(el);
    const gap = el.getAttribute(GAP_MARK);
    if (!gap || pieces.length === 0) return pieces;
    return [...(gap === 'after' ? [] : [' ']), ...pieces, ...(gap === 'before' ? [] : [' '])];
  }

  private inlineContent(el: Element): Piece[] {
    switch (el.localName) {
      case 'br':
        return ['\n'];
      case 'img': {
        const src = imageSource(el, this.opts.baseUrl);
        const alt = imageAlt(el);
        return src && alt !== null ? [{ kind: 'image', src, alt }] : [];
      }
      case 'a': {
        const href = this.linkTarget(el);
        const children = this.inlineChildren(el);
        if (!href) return children;
        // An icon-only link: use its name if the site gave it one. Not a name
        // VisioFix's repairs added (the link's address): that helps on the page
        // with a screen reader, but in a reading view it's just clutter.
        if (!hasText(children)) {
          const ours = (el.getAttribute(TAG_ATTR) ?? '').split(' ').includes('aria-label');
          const label = ours ? '' : el.getAttribute('aria-label')?.trim();
          return label ? [{ kind: 'link', href, children: [label] }] : [];
        }
        return [{ kind: 'link', href, children }];
      }
      case 'strong':
      case 'b':
        return [{ kind: 'strong', children: this.inlineChildren(el) }];
      case 'em':
      case 'i':
      case 'cite':
      case 'dfn':
        return [{ kind: 'em', children: this.inlineChildren(el) }];
      case 'code':
      case 'kbd':
      case 'samp':
      case 'tt':
      case 'var':
        return [{ kind: 'code', children: this.inlineChildren(el) }];
      case 'del':
      case 's':
      case 'strike':
        return [{ kind: 'del', children: this.inlineChildren(el) }];
      case 'sup':
      case 'sub':
        return [{ kind: el.localName, children: this.inlineChildren(el) }];
      case 'q':
        return ['“', ...this.inlineChildren(el), '”'];
      case 'ul':
      case 'ol': {
        // A list inside a line (a table cell, a heading): "English, French".
        const items = Array.from(el.children).filter((child) => !this.skip(child));
        return [' ', ...items.flatMap((item, i) => (i > 0 ? [', ', ...this.inlineChildren(item)] : this.inlineChildren(item))), ' '];
      }
      default:
        // span, mark, abbr, sup, a heading inside a link, ... : just the text.
        // Block elements flattened into a line get spaces so words don't run together.
        return isBlock(el) ? [' ', ...this.inlineChildren(el), ' '] : this.inlineChildren(el);
    }
  }

  /**
   * Images inside text become their description, so "Download <img alt="PDF">"
   * reads "Download PDF". (Images on their own become figures; see paragraph().)
   */
  private resolveImages(pieces: Piece[]): Inline[] {
    const out: Inline[] = [];
    for (const piece of pieces) {
      if (typeof piece === 'string') out.push(piece);
      else if (piece.kind === 'image') {
        if (piece.alt) out.push(piece.alt);
      } else out.push({ ...piece, children: this.resolveImages(piece.children) });
    }
    return out;
  }

  /** The first heading or paragraph inside a block-wrapping link becomes that link. */
  private withLink(content: Inline[], link: LinkContext | null): Inline[] {
    if (!link || link.used || !hasWords(content) || containsLink(content)) return content;
    link.used = true;
    return [{ kind: 'link', href: link.href, children: content }];
  }

  /** A safe link address, or null for links that would do nothing useful in Focus Mode. */
  private linkTarget(el: Element): string | null {
    const raw = el.getAttribute('href')?.trim();
    if (!raw) return null;
    let url: URL;
    try {
      url = new URL(raw, this.opts.baseUrl);
    } catch {
      return null;
    }
    // javascript: and other schemes never run from Focus Mode.
    if (!LINK_PROTOCOLS.has(url.protocol)) return null;
    // Jumps within the page (#section, footnotes): their target isn't in Focus Mode.
    if (url.hash && withoutHash(url.href) === withoutHash(this.opts.pageUrl)) return null;
    return url.href;
  }

  private skip(el: Element): boolean {
    const tag = el.localName;
    if (SKIP_TAGS.has(tag)) return true;
    if (el.hasAttribute('hidden') || el.getAttribute('aria-hidden') === 'true') return true;
    const all = this.opts.skip === 'landmarks';
    if ((all ? LANDMARK_TAGS : NAVIGATION_TAGS).has(tag)) return true;
    const role = el.getAttribute('role')?.trim().split(/\s+/)[0];
    return !!role && (all ? LANDMARK_ROLES : NAVIGATION_ROLES).has(role);
  }

  /** Is `el` inside something skipped, below `top`? */
  private skippedInside(el: Element, top: Element): boolean {
    for (let node: Element | null = el; node && node !== top; node = node.parentElement) {
      if (this.skip(node)) return true;
    }
    return false;
  }

  private add<B extends Block>(block: B): B {
    this.count += 1;
    if (this.count >= this.max) this.truncated = true;
    return block;
  }
}

/* ---------------- Helpers ---------------- */

function text(node: Node): string {
  return (node.nodeValue ?? '').replace(/\s+/g, ' ');
}

function isBlock(el: Element): boolean {
  return BLOCK_TAGS.has(el.localName) || el.getAttribute('role') === 'heading' || el.hasAttribute(BLOCK_MARK);
}

/**
 * Data table or layout table? The same rules as Readability's: headers,
 * a caption or column groups mean data; tables inside it mean layout;
 * otherwise it's data when it's big enough.
 */
function isLayoutTable(table: HTMLTableElement, rows: HTMLTableRowElement[]): boolean {
  const role = table.getAttribute('role');
  if (role === 'presentation' || role === 'none') return true;
  if (table.getAttribute('summary') || table.caption || table.tHead || table.tFoot) return false;
  if (table.querySelector('th, col, colgroup')) return false;
  if (table.querySelector('table')) return true;
  const columns = Math.max(...rows.map((row) => row.cells.length));
  return !(rows.length >= 10 || columns > 4 || rows.length * columns > 10);
}

/** Does an inline element (like a link) wrap blocks? A plain walk: much cheaper than a long selector on big pages. */
function hasBlockInside(el: Element): boolean {
  for (let child = el.firstElementChild; child; child = child.nextElementSibling) {
    if (isBlock(child) || hasBlockInside(child)) return true;
  }
  return false;
}

function headingLevel(el: Element): HeadingLevel | null {
  const match = /^h([1-6])$/.exec(el.localName);
  if (match) return Number(match[1]) as HeadingLevel;
  if (el.getAttribute('role') === 'heading') {
    const level = Number(el.getAttribute('aria-level'));
    return (Number.isInteger(level) && level >= 1 && level <= 6 ? level : 2) as HeadingLevel;
  }
  return null;
}

function withoutHash(href: string): string {
  const i = href.indexOf('#');
  return i === -1 ? href : href.slice(0, i);
}

/**
 * The image's own description: alt (even ""), else the name the page gave it
 * with aria-label or aria-labelledby (VisioFix's repairs use these too).
 * null = no description; such images are left out, never given a made-up one.
 */
export function imageAlt(img: Element): string | null {
  const alt = img.getAttribute('alt');
  if (alt !== null) return alt.replace(/\s+/g, ' ').trim();
  const label = img.getAttribute('aria-label')?.replace(/\s+/g, ' ').trim();
  if (label) return label;
  const ids = img.getAttribute('aria-labelledby')?.trim().split(/\s+/) ?? [];
  const doc = img.ownerDocument;
  const named = ids
    .map((id) => doc.getElementById(id)?.textContent ?? '')
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  return named || null;
}

/**
 * Where to load the image from: src, unless it's missing or an inline
 * placeholder and the real address is in srcset or a lazy-loading attribute.
 */
export function imageSource(img: Element, baseUrl: string): string | null {
  const src = img.getAttribute('src')?.trim() ?? '';
  const isPlaceholder = !src || src.startsWith('data:');
  const candidates = [
    isPlaceholder ? null : src,
    largestCandidate(img.getAttribute('srcset')),
    largestCandidate(img.getAttribute('data-srcset')),
    img.getAttribute('data-src'),
    img.getAttribute('data-lazy-src'),
    img.getAttribute('data-original'),
    src,
  ];
  for (const candidate of candidates) {
    const url = safeImageUrl(candidate, baseUrl);
    if (url) return url;
  }
  return null;
}

function safeImageUrl(value: string | null | undefined, baseUrl: string): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  if (/^data:image\/(png|gif|jpeg|webp|avif|svg\+xml)[;,]/i.test(raw)) return raw;
  try {
    const url = new URL(raw, baseUrl);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

/** The biggest image in a srcset ("a.jpg 400w, b.jpg 800w" → b.jpg). */
function largestCandidate(srcset: string | null): string | null {
  if (!srcset) return null;
  let best: { url: string; size: number } | null = null;
  for (const match of srcset.matchAll(/(\S+?),?\s+(\d+(?:\.\d+)?)[wx]/g)) {
    const url = (match[1] ?? '').replace(/^,+/, '');
    const size = Number(match[2]);
    if (url && (!best || size > best.size)) best = { url, size };
  }
  return best?.url ?? srcset.trim().split(/\s+/)[0] ?? null;
}

/** All the images, when a paragraph holds nothing else. */
function onlyImages(pieces: Piece[]): ImagePiece[] | null {
  const images: ImagePiece[] = [];
  const walk = (list: Piece[]): boolean =>
    list.every((piece) => {
      if (typeof piece === 'string') return piece.trim() === '';
      if (piece.kind === 'image') {
        images.push(piece);
        return true;
      }
      return walk(piece.children);
    });
  return walk(pieces) && images.length > 0 ? images : null;
}

function plain(inlines: Inline[]): string {
  return inlines.map((i) => (typeof i === 'string' ? i : plain(i.children))).join('');
}

function hasText(pieces: Piece[]): boolean {
  return pieces.some((p) => (typeof p === 'string' ? p.trim() !== '' : p.kind === 'image' ? p.alt !== '' : hasText(p.children)));
}

/** Has at least one letter or digit (drops "|", "•" and other separators). */
function hasWords(inlines: Inline[]): boolean {
  return /[\p{L}\p{N}]/u.test(plain(inlines));
}

function containsLink(inlines: Inline[]): boolean {
  return inlines.some((i) => typeof i !== 'string' && (i.kind === 'link' || containsLink(i.children)));
}

/**
 * Collapses whitespace the way a browser would show it, across element
 * boundaries ("a <em> b</em>" → "a ", em "b"), trims both ends, and removes
 * empty pieces. Line breaks from <br> are kept, one at a time.
 */
export function tidy(input: Inline[]): Inline[] {
  type Leaf = { list: Inline[]; index: number };
  const leaves: Leaf[] = [];
  const collect = (list: Inline[]) =>
    list.forEach((item, index) => (typeof item === 'string' ? leaves.push({ list, index }) : collect(item.children)));
  const list = copy(input);
  collect(list);

  let prev: Leaf | null = null;
  for (const leaf of leaves) {
    let s = (leaf.list[leaf.index] as string).replace(/ *\n[ \n]*/g, '\n').replace(/ {2,}/g, ' ');
    if (!prev) {
      s = s.replace(/^[ \n]+/, '');
    } else {
      const before = prev.list[prev.index] as string;
      const end = before.slice(-1);
      const lead = /^[ \n]+/.exec(s)?.[0];
      if (lead && (end === ' ' || end === '\n')) {
        // A line break wins over a space next to it.
        if (end === ' ' && lead.includes('\n')) prev.list[prev.index] = `${before.slice(0, -1)}\n`;
        s = s.slice(lead.length);
      }
    }
    leaf.list[leaf.index] = s;
    if (s) prev = leaf;
  }
  if (prev) prev.list[prev.index] = (prev.list[prev.index] as string).replace(/[ \n]+$/, '');
  return clean(list);
}

function copy(list: Inline[]): Inline[] {
  return list.map((item) => (typeof item === 'string' ? item : { ...item, children: copy(item.children) }));
}

/** Drops empty strings and empty elements, and joins neighbouring strings. */
function clean(list: Inline[]): Inline[] {
  const out: Inline[] = [];
  for (const item of list) {
    if (typeof item === 'string') {
      if (!item) continue;
      const last = out[out.length - 1];
      if (typeof last === 'string') out[out.length - 1] = last + item;
      else out.push(item);
    } else {
      const children = clean(item.children);
      if (children.length > 0) out.push({ ...item, children });
    }
  }
  return out;
}
