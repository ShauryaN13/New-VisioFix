import { afterEach, describe, expect, it } from 'vitest';
import { extractFocusDoc, type LayoutStyle } from '@/focus/extract';
import { blockText, type FocusDoc } from '@/focus/model';

/**
 * Extraction runs Readability for real (it's built for this kind of DOM).
 * Hidden content uses a stylesheet, so the default computed-style check is
 * what's tested.
 */

afterEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  document.documentElement.removeAttribute('lang');
});

function load(head: string, body: string, lang = 'en'): void {
  document.documentElement.lang = lang;
  document.head.innerHTML = head;
  document.body.innerHTML = body;
}

const allText = (doc: FocusDoc) => doc.blocks.map(blockText).join('\n');
const headings = (doc: FocusDoc) =>
  doc.blocks.flatMap((b) => (b.kind === 'heading' ? [`h${b.level} ${blockText(b)}`] : []));

const sentence = (topic: string) =>
  `The ${topic} changes were described in detail at the meeting, with staff explaining what visitors can expect over the coming months and how to give feedback.`;

const ARTICLE = `
  <header><a href="/">Riverside Courier</a><nav><a href="/news">News</a> <a href="/sport">Sport</a></nav></header>
  <main><article>
    <h1>Library adds evening hours</h1>
    <p class="byline">By Dana Whitfield</p>
    <p>${sentence('opening hours')} ${sentence('staffing')}</p>
    <div class="newsletter is-hidden"><p>Sign up for our newsletter. This box is hidden.</p></div>
    <h2>A room built for reading</h2>
    <p>${sentence('reading room')} ${sentence('lighting')}</p>
    <p>${sentence('magnifier')} ${sentence('screen reader')}</p>
  </article>
  <aside class="related"><h2>Related</h2><ul><li><a href="/a">Other story</a></li></ul></aside></main>
  <footer><p>© Riverside Courier</p></footer>`;

const HEAD = `<title>Library adds evening hours | Riverside Courier</title>
  <meta property="og:site_name" content="Riverside Courier"><style>.is-hidden { display: none }</style>`;

describe('articles', () => {
  it('uses Readability for an article: title once, byline, site name, language', () => {
    load(HEAD, ARTICLE);
    const doc = extractFocusDoc(document);
    expect(doc.isFallback).toBe(false);
    expect(doc.title).toBe('Library adds evening hours');
    expect(doc.byline).toBe('By Dana Whitfield');
    expect(doc.siteName).toBe('Riverside Courier');
    expect(doc.lang).toBe('en');
    // The <h1> is the title; it isn't repeated as the first heading.
    expect(headings(doc)).toEqual(['h2 A room built for reading']);
    const text = allText(doc);
    expect(text).toContain('reading room changes');
    for (const unwanted of ['Sport', 'Other story', '©', 'newsletter']) expect(text).not.toContain(unwanted);
  });

  it('never changes the page', () => {
    load(HEAD, ARTICLE);
    const before = document.documentElement.outerHTML;
    extractFocusDoc(document);
    expect(document.documentElement.outerHTML).toBe(before);
  });

  it('keeps headings that a wiki wraps with an [edit] link', () => {
    load(
      '<title>Braille - Wikipedia</title>',
      `<h1>Braille</h1><div id="content">
        <p>${sentence('braille')} ${sentence('alphabet')}</p>
        <div class="mw-heading"><h2 id="History">History</h2><span>[<a href="/w/index.php?action=edit&section=1">edit</a>]</span></div>
        <p>${sentence('history')} ${sentence('writing')}</p>
        <div class="mw-heading"><h2 id="Form">Form</h2><span>[<a href="/w/index.php?action=edit&section=2">edit</a>]</span></div>
        <p>${sentence('form')} ${sentence('cells')}</p></div>`,
    );
    const doc = extractFocusDoc(document);
    expect(doc.isFallback).toBe(false);
    expect(headings(doc)).toEqual(['h2 History', 'h2 Form']);
    expect(allText(doc)).not.toContain('edit');
  });

  it('uses the page’s only <h1> when the title is that plus the site name', () => {
    const body = `<h1>Braille</h1><p>${sentence('a')} ${sentence('b')} ${sentence('c')}</p><p>${sentence('d')} ${sentence('e')}</p>`;
    // The name in the page's address (the test page is on localhost)...
    load('<title>Braille - Localhost</title>', body);
    expect(extractFocusDoc(document).title).toBe('Braille');
    // ...or the name the page gives itself.
    load('<title>Braille | MDN Web Docs</title><meta property="og:site_name" content="MDN Web Docs">', body);
    expect(extractFocusDoc(document).title).toBe('Braille');
  });

  it('keeps the title when the <h1> is the site’s name, not the story’s', () => {
    load(
      '<title>Library adds evening hours | Riverside Courier</title>',
      `<h1>Riverside Courier</h1><p>${sentence('a')} ${sentence('b')} ${sentence('c')}</p><p>${sentence('d')} ${sentence('e')}</p>`,
    );
    expect(extractFocusDoc(document).title).toBe('Library adds evening hours | Riverside Courier');
  });

  it('separates words that the page separates only with margins', () => {
    load(HEAD, ARTICLE.replace('<h2>A room', '<p>Reported <span class="gap">in Kyiv</span><span class="gap">and</span><span>Jaroslav</span>.</p><h2>A room'));
    const style = (el: Element): LayoutStyle => {
      const real = getComputedStyle(el);
      return { display: real.display, marginLeft: '0px', marginRight: el.classList.contains('gap') ? '4px' : '0px' };
    };
    expect(allText(extractFocusDoc(document, { style }))).toContain('in Kyiv and Jaroslav');
  });
});

describe('pages that aren’t articles', () => {
  const card = (n: number) =>
    `<a href="/story-${n}"><div><h3>Story number ${n} headline</h3><p>Summary of story ${n}.</p></div></a>`;
  const HOME = `
    <header><h1>Riverside Courier</h1><nav><a href="/news">News</a></nav></header>
    <main><h2>Top stories</h2>${[1, 2, 3, 4, 5, 6, 7].map(card).join('')}
      <h2>Weather</h2><p>Cloudy, clearing later.</p></main>
    <aside><h2>Newsletter</h2><p>Sign up.</p></aside><footer>© 2026</footer>`;

  it('falls back on a list of stories: main area only, linked headlines, with the notice flag', () => {
    load('<title>Riverside Courier: local news</title>', HOME);
    const doc = extractFocusDoc(document);
    expect(doc.isFallback).toBe(true);
    expect(doc.title).toBe('Riverside Courier: local news');
    const first = doc.blocks.find((b) => b.kind === 'heading' && b.level === 3);
    expect(first).toEqual({
      kind: 'heading',
      level: 3,
      content: [{ kind: 'link', href: 'http://localhost:3000/story-1', children: ['Story number 1 headline'] }],
    });
    const text = allText(doc);
    expect(text).toContain('Cloudy, clearing later.');
    for (const unwanted of ['News', 'Sign up', '©']) expect(text).not.toContain(unwanted);
  });

  it('never treats a page that says it’s an article (og:type) as a list of stories', () => {
    const long = `<p>${sentence('a')} ${sentence('b')} ${sentence('c')}</p><p>${sentence('d')} ${sentence('e')} ${sentence('f')}</p>`;
    load(
      '<title>Story</title><meta property="og:type" content="article">',
      `<article><h1>Story</h1>${long}</article><section>${[1, 2, 3, 4, 5, 6, 7].map(card).join('')}</section>`,
    );
    expect(extractFocusDoc(document).isFallback).toBe(false);
  });

  it('shows nothing (and says so in the view) on a page with no text', () => {
    load('<title>Empty</title>', '<div><img src="/a.png"><button>Play</button></div>');
    const doc = extractFocusDoc(document);
    expect(doc.isFallback).toBe(true);
    expect(doc.blocks).toEqual([]);
    expect(doc.title).toBe('Empty');
  });
});
