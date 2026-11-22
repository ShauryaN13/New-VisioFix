import { describe, expect, it } from 'vitest';
import { DEFAULT_TEXT_SIZE, type FocusDoc } from '@/focus/model';
import { renderFocusView } from '@/focus/view';
import { MAX_SENTENCE_CHARS, markSentences, splitSentences } from '@/speech/sentences';

const texts = (text: string, lang: string | null = 'en') => splitSentences(text, lang).map((r) => text.slice(r.start, r.end));

describe('splitSentences', () => {
  it('splits into trimmed sentences', () => {
    expect(texts('  The library opens late.  It closes at nine! Does it? ')).toEqual([
      'The library opens late.',
      'It closes at nine!',
      'Does it?',
    ]);
  });

  it('doesn’t split after an abbreviation followed by lowercase', () => {
    expect(texts('It stays open until 9 p.m. on weekdays. Then it closes.')).toEqual([
      'It stays open until 9 p.m. on weekdays.',
      'Then it closes.',
    ]);
  });

  it('skips text with no letters or digits (a lone dash or ellipsis)', () => {
    expect(texts(' — ')).toEqual([]);
    expect(texts('…')).toEqual([]);
  });

  it('splits very long sentences at a comma, else at a space, never mid-word', () => {
    const clause = 'the reading room has adjustable lighting and large print books';
    const long = `${clause}, ${clause}, ${clause}, ${clause}.`;
    const parts = texts(long);
    expect(parts.length).toBeGreaterThan(1);
    for (const part of parts) expect(part.length).toBeLessThanOrEqual(MAX_SENTENCE_CHARS);
    expect(parts[0]?.endsWith(',')).toBe(true);
    expect(parts.join(' ')).toBe(long);

    const words = Array.from({ length: 60 }, (_, i) => `word${i}`).join(' ');
    for (const part of texts(words)) expect(part).toMatch(/^word\d+( word\d+)*$/);
  });

  it('copes with an invalid language tag', () => {
    expect(texts('One. Two.', 'not a language!')).toEqual(['One.', 'Two.']);
  });
});

const doc: FocusDoc = {
  title: 'Library adds evening hours',
  siteName: 'Courier',
  byline: 'By Dana',
  lang: 'en',
  dir: 'ltr',
  isFallback: true,
  truncated: false,
  blocks: [
    {
      kind: 'paragraph',
      content: [
        'Starting next month, the ',
        { kind: 'link', href: 'https://example.com/', children: ['Riverside Public Library'] },
        ' stays open late. It follows requests.',
        { kind: 'sup', children: ['1'] },
        { kind: 'sup', children: ['[note 2]'] },
      ],
    },
    {
      kind: 'list',
      ordered: false,
      items: [[{ kind: 'paragraph', content: ['Large print'] }, { kind: 'list', ordered: false, items: [[{ kind: 'paragraph', content: ['Audio too'] }]] }]],
    },
    { kind: 'code', text: 'library search --title "x". Not read.' },
    { kind: 'figure', src: 'https://example.com/a.png', alt: 'A room', caption: ['The new room.'] },
  ],
};

function marked() {
  const view = renderFocusView(doc, { theme: 'contrast', textSize: DEFAULT_TEXT_SIZE, speed: 1 }, false, {
    onClose: () => undefined,
    onPlayPause: () => undefined,
    onPrevious: () => undefined,
    onNext: () => undefined,
    onReadFrom: () => undefined,
    onSettingsChange: () => undefined,
  });
  const before = view.article.textContent;
  const sentences = markSentences(view.article, 'en');
  return { view, sentences, before };
}

describe('markSentences', () => {
  it('marks the title, paragraphs, list items and captions in reading order', () => {
    const { sentences } = marked();
    expect(sentences.map((s) => s.text)).toEqual([
      'Library adds evening hours',
      'Starting next month, the Riverside Public Library stays open late.',
      'It follows requests.',
      'Large print',
      'Audio too',
      'The new room.',
    ]);
  });

  it('doesn’t read the byline line, the notice, code or footnote markers', () => {
    const { view, sentences } = marked();
    const all = sentences.map((s) => s.text).join(' ');
    for (const unread of ['By Dana', 'doesn’t look like an article', 'library search', '1', '[note 2]']) {
      expect(all).not.toContain(unread);
    }
    expect(view.article.querySelector('.vf-meta .vf-sentence, .vf-notice .vf-sentence, pre .vf-sentence, sup .vf-sentence')).toBeNull();
  });

  it('splits a sentence that runs through a link into spans with the same number', () => {
    const { view, sentences } = marked();
    const spans = sentences[1]?.spans ?? [];
    expect(spans.map((s) => s.textContent)).toEqual(['Starting next month, the ', 'Riverside Public Library', ' stays open late.']);
    expect(new Set(spans.map((s) => s.dataset.sentence))).toEqual(new Set(['1']));
    expect(spans[1]?.parentElement?.localName).toBe('a');
    expect(view.article.querySelectorAll('[data-sentence="1"]')).toHaveLength(3);
  });

  it('changes no text: the article reads exactly the same', () => {
    const { view, before } = marked();
    expect(view.article.textContent).toBe(before);
  });
});
