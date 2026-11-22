import { isProbablyReaderable, Readability } from '@mozilla/readability';
import { BLOCK_MARK, buildBlocks, type BuildResult, GAP_MARK, isBlockTag } from './build';
import { type Block, blockText, type FocusDoc, inlineText } from './model';

/**
 * Reads the page's main content for Focus Mode. Runs only when Focus Mode
 * opens, never in the background, and never changes the page.
 *
 *   1. Copy the page, leaving out everything the page itself hides
 *      (display: none), like closed menus and pop-ups that aren't showing.
 *   2. Unless the page is a list of stories (most headlines link elsewhere),
 *      and if it passes Readability's own "is this an article?" check (the
 *      one Firefox uses to offer Reader View), run Readability (the engine
 *      behind Firefox Reader View) on a second copy, since it rearranges what
 *      it's given. Keep its result if it's long enough, not mostly links, and
 *      not a list of linked headlines.
 *   3. Otherwise fall back to the headings, paragraphs and lists in the
 *      page's main area, skipping navigation, sidebars and footers, and say
 *      so with a notice.
 *
 * Either way the result goes through the allow-list in build.ts.
 */

/** Readability results shorter than this aren't treated as an article (Readability's own default threshold). */
const MIN_ARTICLE_CHARS = 500;
/** More than this share of the text in links: a list of links (a home page), not an article. */
const MAX_LINK_DENSITY = 0.5;
/** At least this many headings that are links, and at least half of all headings: a list of stories. */
const MIN_LINKED_HEADINGS = 3;
/** A <main> with less text than this is probably a wrapper for something else; read the whole page. */
const MIN_MAIN_CHARS = 200;
/** A list of stories: at least this many headlines that link to other pages, and at least half of all headings. */
const MIN_LISTING_LINKS = 6;
/** A margin at least this wide between inline elements reads as a space. */
const MIN_GAP_PX = 3;
/** Extra text allowed next to a heading in a wrapper that gets unwrapped ("[edit]", "#", "¶"). */
const MAX_HEADING_EXTRAS = 20;

/** The parts of an element's computed style that extraction looks at. */
export type LayoutStyle = Pick<CSSStyleDeclaration, 'display' | 'marginLeft' | 'marginRight'>;

export interface ExtractOptions {
  /** The element's style on the page. The default is its computed style (tests pass their own). */
  style?: (el: Element) => LayoutStyle;
  maxBlocks?: number;
}

export function extractFocusDoc(doc: Document, options: ExtractOptions = {}): FocusDoc {
  const page = visibleCopy(doc, options.style ?? getComputedStyle);
  const build = { baseUrl: doc.baseURI, pageUrl: doc.URL, maxBlocks: options.maxBlocks };
  const host = doc.location?.hostname?.replace(/^www\./, '') ?? '';

  // Readability is the slow part on big pages (1.5s on the stress page), so
  // it only runs when the quick checks say this could be an article.
  const candidate = !looksLikeListing(page, doc) && isProbablyReaderable(page);
  const article = candidate ? readArticle(page.cloneNode(true) as Document) : null;
  const meta = {
    siteName: clip(article?.siteName, 60) ?? clip(metaContent(doc, 'og:site_name'), 60) ?? (host || null),
    lang: clean(article?.lang) || doc.documentElement.lang || null,
    dir: direction(clean(article?.dir) || doc.documentElement.dir),
  };

  if (article?.content instanceof Element) {
    const result = buildBlocks(article.content, { ...build, skip: 'navigation' });
    if (looksLikeArticle(result)) {
      const title = pageTitle(page, clean(article.title) || clean(doc.title), meta.siteName, host) || firstHeading(result.blocks) || host;
      const byline = clip(article.byline, 120);
      return {
        title,
        siteName: meta.siteName,
        byline: byline && byline !== meta.siteName ? byline : null,
        lang: meta.lang,
        dir: meta.dir,
        isFallback: false,
        truncated: result.truncated,
        blocks: dropTitleHeading(result.blocks, title),
      };
    }
  }

  const root = fallbackRoot(page);
  const result = root ? buildBlocks(root, { ...build, skip: 'landmarks' }) : { blocks: [], truncated: false };
  const title = pageTitle(page, clean(doc.title), meta.siteName, host) || firstHeading(result.blocks) || host;
  return {
    title,
    siteName: meta.siteName,
    byline: null,
    lang: meta.lang,
    dir: meta.dir,
    isFallback: true,
    truncated: result.truncated,
    blocks: dropTitleHeading(result.blocks, title),
  };
}

function readArticle(copy: Document) {
  liftHeadings(copy);
  try {
    // serializer: give back the element itself rather than an HTML string,
    // so nothing is ever parsed from HTML.
    return new Readability<Node>(copy, { serializer: (node) => node }).parse();
  } catch {
    return null;
  }
}

/**
 * Wikipedia and other wikis wrap each section heading in a <div> with an
 * "[edit]" link. Readability then drops the whole wrapper as "too many links",
 * and the heading with it. In the copy, such a wrapper is replaced by its
 * heading (the "[edit]" link is page furniture anyway).
 */
function liftHeadings(copy: Document): void {
  for (const heading of Array.from(copy.querySelectorAll('h1, h2, h3, h4, h5, h6'))) {
    const wrapper = heading.parentElement;
    if (wrapper?.localName !== 'div' || wrapper.querySelectorAll('h1, h2, h3, h4, h5, h6, img').length !== 1) continue;
    const extras = (wrapper.textContent ?? '').length - (heading.textContent ?? '').length;
    if (extras <= MAX_HEADING_EXTRAS) wrapper.replaceWith(heading);
  }
}

function looksLikeArticle(result: BuildResult): boolean {
  let total = 0;
  let linked = 0;
  let headings = 0;
  let linkedHeadings = 0;
  const count = (block: Block) => {
    if (block.kind === 'paragraph' || block.kind === 'heading') {
      for (const inline of block.content) {
        const length = typeof inline === 'string' ? inline.length : inlineText(inline.children).length;
        total += length;
        if (typeof inline !== 'string' && inline.kind === 'link') linked += length;
      }
      if (block.kind === 'heading') {
        headings += 1;
        const only = block.content.length === 1 ? block.content[0] : undefined;
        if (typeof only === 'object' && only.kind === 'link') linkedHeadings += 1;
      }
    } else if (block.kind === 'list') block.items.forEach((item) => item.forEach(count));
    else if (block.kind === 'quote') block.blocks.forEach(count);
    else total += blockText(block).length;
  };
  result.blocks.forEach(count);
  // Headlines that are links: a home page or an index of posts, not one article.
  const listing = linkedHeadings >= MIN_LINKED_HEADINGS && linkedHeadings >= headings / 2;
  return total >= MIN_ARTICLE_CHARS && linked / total <= MAX_LINK_DENSITY && !listing;
}

/**
 * A home page or an index of posts: most of its headlines are links to other
 * pages (45 of 51 on BBC News's front page). Pages that say they're an
 * article (og:type) never count, since their "related stories" can look the same.
 */
function looksLikeListing(page: Document, doc: Document): boolean {
  if (metaContent(doc, 'og:type')?.toLowerCase().includes('article')) return false;
  const here = withoutHash(doc.URL);
  const headings = Array.from(page.body?.querySelectorAll('h1, h2, h3, h4, h5, h6') ?? []).filter(
    (h) => !h.closest('nav, aside, footer, [role="navigation"], [role="complementary"], [role="contentinfo"]'),
  );
  let linked = 0;
  for (const heading of headings) {
    const href = (heading.closest('a[href]') ?? heading.querySelector('a[href]'))?.getAttribute('href');
    if (!href) continue;
    try {
      if (withoutHash(new URL(href, doc.baseURI).href) !== here) linked += 1;
    } catch {
      // Not a real address.
    }
  }
  return linked >= MIN_LISTING_LINKS && linked >= headings.length / 2;
}

function withoutHash(href: string): string {
  const i = href.indexOf('#');
  return i === -1 ? href : href.slice(0, i);
}

/** The page's main area for the fallback: <main>, else a single <article>, else the whole body. */
function fallbackRoot(page: Document): Element | null {
  const main = page.querySelector('main, [role="main"]');
  if (main && (main.textContent ?? '').trim().length >= MIN_MAIN_CHARS) return main;
  const articles = page.querySelectorAll('article');
  if (articles.length === 1 && articles[0]) return articles[0];
  return page.body;
}

/**
 * A copy of the page as it's shown, for Readability and the fallback:
 *   - Without what the page hides with display: none. Readability only sees
 *     inline styles, so on its own it would include closed menus, hidden
 *     pop-ups and the mobile copy of the navigation.
 *   - With inline elements that the page shows as blocks (a <span> set to
 *     display: block or flex) marked, and inline elements whose margin stands
 *     in for a space, so their words don't run together ("in Kyiv" + "and"
 *     → "in Kyivand").
 * The marks go on the copy only, never on the page.
 */
function visibleCopy(doc: Document, styleOf: (el: Element) => LayoutStyle): Document {
  const copy = doc.cloneNode(true) as Document;
  if (!doc.body || !copy.body) return copy;
  // Both lists are in document order and match one to one: the copy is exact.
  const live = doc.body.getElementsByTagName('*');
  const copied = copy.body.getElementsByTagName('*');
  if (live.length !== copied.length) return copy;

  const remove: Element[] = [];
  let hiddenRoot: Element | null = null;
  for (let i = 0; i < live.length; i += 1) {
    const el = live[i] as Element;
    if (hiddenRoot?.contains(el)) continue; // already removed with its parent
    hiddenRoot = null;
    if (el.localName === 'visiofix-ui') {
      hiddenRoot = el;
      remove.push(copied[i] as Element);
      continue;
    }
    // Only display: none counts as hidden. Not "no box": that would also drop
    // the contents of closed <details> and display: contents wrappers.
    const style = styleOf(el);
    if (style.display === 'none') {
      hiddenRoot = el;
      remove.push(copied[i] as Element);
    } else if (!isBlockTag(el.localName)) {
      if (!/^(inline|contents|ruby)/.test(style.display)) {
        (copied[i] as Element).setAttribute(BLOCK_MARK, '');
      } else {
        const before = parseFloat(style.marginLeft) >= MIN_GAP_PX;
        const after = parseFloat(style.marginRight) >= MIN_GAP_PX;
        if (before || after) (copied[i] as Element).setAttribute(GAP_MARK, before && after ? 'both' : before ? 'before' : 'after');
      }
    }
  }
  for (const el of remove) el.remove();
  return copy;
}

/**
 * Titles often end with the site's name ("Braille - Wikipedia"), and
 * Readability keeps it when the rest is short. When the page has a single
 * <h1>, the title is that <h1>, a separator and the site's name (as the page
 * gives it, or as in its address), the <h1> is the real title.
 */
function pageTitle(page: Document, title: string, siteName: string | null, host: string): string {
  const h1s = page.body?.querySelectorAll('h1') ?? [];
  const h1 = h1s.length === 1 ? clean(h1s[0]?.textContent) : '';
  if (!h1 || !title.startsWith(h1)) return title;
  const match = /^\s*[-|–—:·•»]\s+(.+)$/.exec(title.slice(h1.length));
  const rest = match?.[1]?.trim().toLowerCase() ?? '';
  if (!rest) return title;
  const isSiteName = rest === siteName?.toLowerCase() || host.toLowerCase().includes(rest.replace(/\s+/g, ''));
  return isSiteName ? h1 : title;
}

/** Readability and the fallback both keep the page's first heading; Focus Mode shows the title itself. */
function dropTitleHeading(blocks: Block[], title: string): Block[] {
  const index = blocks.slice(0, 3).findIndex((block) => block.kind === 'heading');
  const heading = blocks[index];
  if (heading?.kind !== 'heading' || !sameText(inlineText(heading.content), title)) return blocks;
  return blocks.filter((_, i) => i !== index);
}

function sameText(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const [x, y] = [norm(a), norm(b)];
  if (!x || !y) return false;
  if (x === y) return true;
  // "Library adds evening hours" vs "Library adds evening hours | Riverside Courier"
  const [short, long] = x.length < y.length ? [x, y] : [y, x];
  return long.startsWith(short) && short.length >= long.length * 0.5;
}

function firstHeading(blocks: Block[]): string {
  const heading = blocks.find((block) => block.kind === 'heading');
  return heading?.kind === 'heading' ? inlineText(heading.content) : '';
}

function metaContent(doc: Document, property: string): string | null {
  return doc.querySelector(`meta[property="${property}"]`)?.getAttribute('content') ?? null;
}

function clean(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

/** Trimmed text, or null when it's empty or too long to be what it claims (a junk byline). */
function clip(value: string | null | undefined, max: number): string | null {
  const text = clean(value);
  return text && text.length <= max ? text : null;
}

function direction(value: string): 'ltr' | 'rtl' | null {
  const dir = value.toLowerCase();
  return dir === 'ltr' || dir === 'rtl' ? dir : null;
}
