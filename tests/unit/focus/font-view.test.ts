import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FONT_FILES, LATIN_EXT_RANGE, LATIN_RANGE } from '@/focus/font';
import { DEFAULT_TEXT_SIZE, type FocusDoc } from '@/focus/model';
import { renderFocusView } from '@/focus/view';

const ROOT = join(__dirname, '..', '..', '..');

describe('Focus Mode font', () => {
  it('uses the same unicode ranges as the popup’s fonts.css', () => {
    const css = readFileSync(join(ROOT, 'src/ui/fonts.css'), 'utf8');
    const ranges = new Set([...css.matchAll(/unicode-range:\s*([^;]+);/g)].map((m) => (m[1] ?? '').replace(/\s+/g, ' ').trim()));
    expect(ranges).toEqual(new Set([LATIN_RANGE, LATIN_EXT_RANGE]));
  });

  it('lists only files that exist (the manifest makes exactly these web-accessible)', () => {
    expect(FONT_FILES).toHaveLength(8);
    for (const file of FONT_FILES) expect(existsSync(join(ROOT, 'public', file)), file).toBe(true);
  });
});

const doc = (overrides: Partial<FocusDoc>): FocusDoc => ({
  title: 'Story',
  siteName: 'Example',
  byline: null,
  lang: 'en',
  dir: 'ltr',
  isFallback: false,
  truncated: false,
  blocks: [{ kind: 'paragraph', content: ['Text.'] }],
  ...overrides,
});

const render = (d: FocusDoc) =>
  renderFocusView(d, { theme: 'contrast', textSize: DEFAULT_TEXT_SIZE, speed: 1 }, false, {
    onClose: () => undefined,
    onPlayPause: () => undefined,
    onPrevious: () => undefined,
    onNext: () => undefined,
    onSettingsChange: () => undefined,
  });

describe('Focus Mode view', () => {
  it('builds only allowed elements, with only the attributes it sets', () => {
    const view = render(
      doc({
        blocks: [
          {
            kind: 'paragraph',
            content: [
              { kind: 'link', href: 'https://example.com/', children: ['link'] },
              { kind: 'del', children: ['old'] },
              { kind: 'sup', children: ['1'] },
            ],
          },
          { kind: 'figure', src: 'https://example.com/a.png', alt: 'A', caption: ['Cap'] },
        ],
      }),
    );
    const link = view.article.querySelector('a');
    expect(link?.getAttributeNames()).toEqual(['href']);
    expect(view.article.querySelector('del')?.textContent).toBe('old');
    expect(view.article.querySelector('sup')?.textContent).toBe('1');
    expect(view.article.querySelector('img')?.getAttributeNames().sort()).toEqual(['alt', 'decoding', 'loading', 'src']);
  });

  it('puts focus on the title, which is not a Tab stop', () => {
    const view = render(doc({}));
    document.body.append(view.root);
    view.focusTitle();
    const title = view.article.querySelector('h1');
    expect(document.activeElement).toBe(title);
    expect(title?.getAttribute('tabindex')).toBe('-1');
    view.root.remove();
  });

  it('says when the page isn’t an article, was cut short, or had no text', () => {
    const notices = (d: FocusDoc) => [...render(d).article.querySelectorAll('.vf-notice')].map((n) => n.textContent);
    expect(notices(doc({}))).toEqual([]);
    expect(notices(doc({ isFallback: true }))[0]).toContain('doesn’t look like an article');
    expect(notices(doc({ truncated: true }))[0]).toContain('very long');
    expect(notices(doc({ isFallback: true, blocks: [] }))).toEqual(['Focus Mode didn’t find any text to show on this page.']);
  });
});
