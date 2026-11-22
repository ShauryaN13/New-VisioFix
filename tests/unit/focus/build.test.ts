import { afterEach, describe, expect, it } from 'vitest';
import { BLOCK_MARK, type BuildOptions, buildBlocks, GAP_MARK, tidy } from '@/focus/build';
import type { Block } from '@/focus/model';

const PAGE = 'https://news.example.com/2026/library-hours';

afterEach(() => {
  document.body.innerHTML = '';
});

function build(html: string, options: Partial<BuildOptions> = {}) {
  document.body.innerHTML = `<div id="root">${html}</div>`;
  const root = document.getElementById('root') as Element;
  return buildBlocks(root, { baseUrl: PAGE, pageUrl: PAGE, ...options });
}

const blocks = (html: string, options: Partial<BuildOptions> = {}): Block[] => build(html, options).blocks;
const para = (...content: unknown[]) => ({ kind: 'paragraph', content });

describe('allow-list', () => {
  it('keeps heading levels and the author’s capitalization (legacy bug 8)', () => {
    expect(blocks('<h2>Getting there</h2><h4>By bus</h4><div role="heading" aria-level="3">Parking</div>')).toEqual([
      { kind: 'heading', level: 2, content: ['Getting there'] },
      { kind: 'heading', level: 4, content: ['By bus'] },
      { kind: 'heading', level: 3, content: ['Parking'] },
    ]);
  });

  it('copies nothing from the page as HTML: no attributes, styles, classes or handlers', () => {
    expect(blocks('<p onclick="steal()" style="color:red" class="lead" id="x">Hi <span style="color:blue" onmouseover="x()">there</span></p>')).toEqual([
      para('Hi there'),
    ]);
  });

  it('keeps text outside paragraphs, short paragraphs and whole paragraphs (legacy bugs 6, 7, 13)', () => {
    const long = 'One sentence. Two sentences. Three sentences. Four sentences here.';
    expect(blocks(`<div>Loose text in a div.</div><p>Yes.</p><p>${long}</p><h3>OK</h3>`)).toEqual([
      para('Loose text in a div.'),
      para('Yes.'),
      para(long),
      { kind: 'heading', level: 3, content: ['OK'] },
    ]);
  });

  it('keeps strong, emphasis, code, struck-out text, superscript and subscript; other tags become text', () => {
    expect(
      blocks('<p><b>Bold</b> <i>it</i> <code>x()</code> <s>old</s> H<sub>2</sub>O x<sup>2</sup> <mark>marked</mark> <q>quoted</q></p>'),
    ).toEqual([
      para(
        { kind: 'strong', children: ['Bold'] },
        ' ',
        { kind: 'em', children: ['it'] },
        ' ',
        { kind: 'code', children: ['x()'] },
        ' ',
        { kind: 'del', children: ['old'] },
        ' H',
        { kind: 'sub', children: ['2'] },
        'O x',
        { kind: 'sup', children: ['2'] },
        ' marked “quoted”',
      ),
    ]);
  });

  it('keeps nested lists, quotes and code blocks with their spacing', () => {
    expect(
      blocks(
        '<ul><li>One</li><li>Two<ol><li>Two A</li></ol></li></ul><blockquote><p>Said.</p></blockquote><pre>  indented\n    more\n</pre>',
      ),
    ).toEqual([
      {
        kind: 'list',
        ordered: false,
        items: [[para('One')], [para('Two'), { kind: 'list', ordered: true, items: [[para('Two A')]] }]],
      },
      { kind: 'quote', blocks: [para('Said.')] },
      { kind: 'code', text: '  indented\n    more' },
    ]);
  });

  it('leaves out scripts, styles, page controls, labels, embeds and hidden content', () => {
    expect(
      blocks(`
        <script>alert(1)</script><style>p{}</style><noscript>Enable JS</noscript>
        <button>Share</button><input value="typed"><label>Search</label><select><option>A</option></select>
        <iframe src="https://video.example"></iframe><svg><text>chart</text></svg>
        <p hidden>hidden</p><p aria-hidden="true">decoration</p><dialog>closed dialog</dialog>
        <p>Kept.</p>`),
    ).toEqual([para('Kept.')]);
  });

  it('always leaves out menus; sidebars and footers only in the fallback; never headers or forms (legacy bug 11)', () => {
    const html =
      '<header><h1>Story</h1></header><nav><a href="/a">Menu</a></nav><div role="search">Find</div>' +
      '<form><p>Inside a form.</p></form><aside>Side</aside><footer>Foot</footer>';
    expect(blocks(html, { skip: 'navigation' })).toEqual([
      { kind: 'heading', level: 1, content: ['Story'] },
      para('Inside a form.'),
      para('Side'),
      para('Foot'),
    ]);
    expect(blocks(html, { skip: 'landmarks' })).toEqual([
      { kind: 'heading', level: 1, content: ['Story'] },
      para('Inside a form.'),
    ]);
  });
});

describe('links', () => {
  it('resolves addresses and keeps safe links', () => {
    expect(blocks('<p><a href="/news">News</a>, <a href="mailto:help@example.com">mail</a>, <a href="other#top">other</a></p>')).toEqual([
      para(
        { kind: 'link', href: 'https://news.example.com/news', children: ['News'] },
        ', ',
        { kind: 'link', href: 'mailto:help@example.com', children: ['mail'] },
        ', ',
        { kind: 'link', href: 'https://news.example.com/2026/other#top', children: ['other'] },
      ),
    ]);
  });

  it('turns javascript: links and jumps within the page into plain text', () => {
    expect(blocks('<p><a href="javascript:void(0)">Close</a> and note<a href="#fn1">1</a> and <a href="">empty</a></p>')).toEqual([
      para('Close and note1 and empty'),
    ]);
  });

  it('names icon-only links only with the site’s own label, not one VisioFix added', () => {
    expect(
      blocks(
        '<p><a href="/share" aria-label="Share this story"><svg></svg></a> ' +
          '<a href="/vote" aria-label="news.example.com/vote" data-visiofix="aria-label"><span></span></a> text</p>',
      ),
    ).toEqual([para({ kind: 'link', href: 'https://news.example.com/share', children: ['Share this story'] }, ' text')]);
  });

  it('makes the first heading of a linked card the link, and leaves the summary as text', () => {
    expect(blocks('<a href="/story"><div><h3>Bridge reopens</h3><p>Both lanes are open.</p></div></a>')).toEqual([
      { kind: 'heading', level: 3, content: [{ kind: 'link', href: 'https://news.example.com/story', children: ['Bridge reopens'] }] },
      para('Both lanes are open.'),
    ]);
  });
});

describe('images', () => {
  it('shows figures with their caption and description', () => {
    expect(blocks('<figure><img src="/a.jpg" alt="A reading room"><figcaption>The new room.</figcaption></figure>')).toEqual([
      { kind: 'figure', src: 'https://news.example.com/a.jpg', alt: 'A reading room', caption: ['The new room.'] },
    ]);
  });

  it('shows a captioned image with no description, with alt="" (its caption describes it)', () => {
    expect(blocks('<figure><img src="/a.jpg"><figcaption>The new room.</figcaption></figure>')).toEqual([
      { kind: 'figure', src: 'https://news.example.com/a.jpg', alt: '', caption: ['The new room.'] },
    ]);
  });

  it('leaves out images with no description and decorative ones; never makes one up', () => {
    expect(blocks('<img src="/a.jpg"><p><img src="/divider.png" alt=""></p><figure><img src="/b.jpg"></figure>')).toEqual([]);
  });

  it('uses a name given with aria-labelledby (VisioFix’s caption repair uses it too)', () => {
    expect(blocks('<div><img src="/map.png" aria-labelledby="cap"><p id="cap">Map of the route</p></div>')).toEqual([
      { kind: 'figure', src: 'https://news.example.com/map.png', alt: 'Map of the route', caption: null },
      para('Map of the route'),
    ]);
  });

  it('turns images inside text into their description', () => {
    expect(blocks('<p><a href="/s.pdf">Schedule <img src="/pdf.png" alt="(PDF)"></a> here</p>')).toEqual([
      para({ kind: 'link', href: 'https://news.example.com/s.pdf', children: ['Schedule (PDF)'] }, ' here'),
    ]);
  });

  it('finds the real address of lazy-loaded images', () => {
    expect(
      blocks('<img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" data-src="/real.jpg" alt="Photo"><img srcset="/s.jpg 400w, /l.jpg 1200w" alt="Big">'),
    ).toEqual([
      { kind: 'figure', src: 'https://news.example.com/real.jpg', alt: 'Photo', caption: null },
      { kind: 'figure', src: 'https://news.example.com/l.jpg', alt: 'Big', caption: null },
    ]);
  });
});

describe('tables', () => {
  it('reads a data table as one list item per row, labelled by the header row', () => {
    const html = `<table><caption>Hours</caption>
      <tr><th>Day</th><th>Hours</th></tr>
      <tr><th>Monday</th><td>9–9</td></tr>
      <tr><th>Sunday</th><td>Closed</td></tr></table>
      <table><tr><th>Name</th><th>Age</th></tr><tr><td>Ana</td><td>34</td></tr></table>
      <table><tr><th>Born</th><td>1809<br>Coupvray</td></tr><tr><th>Languages</th><td><ul><li>French</li><li>English</li></ul></td></tr></table>`;
    expect(blocks(html)).toEqual([
      para({ kind: 'strong', children: ['Hours'] }),
      { kind: 'list', ordered: false, items: [[para('Monday: 9–9')], [para('Sunday: Closed')]] },
      { kind: 'list', ordered: false, items: [[para('Name: Ana · Age: 34')]] },
      { kind: 'list', ordered: false, items: [[para('Born: 1809\nCoupvray')], [para('Languages: French, English')]] },
    ]);
  });

  it('shows a row that is only a picture as the picture', () => {
    expect(blocks('<table><tr><th>Braille</th></tr><tr><td><a href="/f.jpg"><img src="/f.jpg" alt="Finger on raised dots"></a></td></tr><tr><th>Creator</th><td>Louis Braille</td></tr></table>')).toEqual([
      {
        kind: 'list',
        ordered: false,
        items: [
          [para('Braille')],
          [{ kind: 'figure', src: 'https://news.example.com/f.jpg', alt: 'Finger on raised dots', caption: null }],
          [para('Creator: Louis Braille')],
        ],
      },
    ]);
  });

  it('reads a layout table cell by cell', () => {
    expect(blocks('<table><tr><td><p>Left column.</p></td><td><table><tr><td>Inner</td></tr></table></td></tr></table>')).toEqual([
      para('Left column.'),
      para('Inner'),
    ]);
  });
});

describe('page layout marks (set by extract.ts on its copy)', () => {
  it('treats an inline element shown as a block as its own paragraph', () => {
    expect(blocks(`<div><span ${BLOCK_MARK}>12 hours ago</span><span ${BLOCK_MARK}>By Dana</span></div>`)).toEqual([
      para('12 hours ago'),
      para('By Dana'),
    ]);
  });

  it('turns a margin that stands in for a space into a space', () => {
    expect(blocks(`<p><span ${GAP_MARK}="after">in Kyiv</span><span ${GAP_MARK}="after">and</span><span>Jaroslav</span></p>`)).toEqual([
      para('in Kyiv and Jaroslav'),
    ]);
  });
});

describe('limits', () => {
  it('stops on very long pages and says so', () => {
    const result = build('<p>One</p><p>Two</p><p>Three</p><p>Four</p><p>Five</p>', { maxBlocks: 3 });
    expect(result.blocks).toEqual([para('One'), para('Two'), para('Three')]);
    expect(result.truncated).toBe(true);
  });

  it('drops paragraphs that are only separators', () => {
    expect(blocks('<p>|</p><p> • </p><p>Real</p>')).toEqual([para('Real')]);
  });
});

describe('tidy', () => {
  it('collapses whitespace across elements and trims the ends', () => {
    expect(tidy(['  Hello   ', { kind: 'em', children: [' big '] }, ' world  '])).toEqual(['Hello ', { kind: 'em', children: ['big '] }, 'world']);
  });

  it('keeps line breaks from <br>, one at a time, without spaces around them', () => {
    expect(blocks('<p>210 Water Street <br> <br>Riverside</p>')).toEqual([para('210 Water Street\nRiverside')]);
  });

  it('removes empty formatting', () => {
    expect(tidy(['Text', { kind: 'strong', children: [' '] }, { kind: 'em', children: [] }])).toEqual(['Text']);
  });
});
