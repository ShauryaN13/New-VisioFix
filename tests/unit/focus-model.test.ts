import { describe, expect, it } from 'vitest';
import { type FocusDoc, blockText, readingMinutes, wordCount } from '@/focus/model';

const doc = (blocks: FocusDoc['blocks'], title = 'A title'): FocusDoc => ({
  title,
  siteName: null,
  byline: null,
  lang: 'en',
  dir: 'ltr',
  isFallback: false,
  blocks,
});

const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ');

describe('blockText', () => {
  it('flattens links and emphasis inside paragraphs', () => {
    expect(
      blockText({
        kind: 'paragraph',
        content: ['See the ', { kind: 'link', href: '#', children: ['events ', { kind: 'em', children: ['page'] }] }, '.'],
      }),
    ).toBe('See the events page.');
  });

  it('includes nested list items and quotes', () => {
    expect(
      blockText({
        kind: 'list',
        ordered: false,
        items: [[{ kind: 'paragraph', content: ['one'] }], [{ kind: 'paragraph', content: ['two'] }]],
      }),
    ).toBe('one two');
    expect(blockText({ kind: 'quote', blocks: [{ kind: 'paragraph', content: ['quoted'] }] })).toBe('quoted');
  });

  it('uses the caption for figures, not the image', () => {
    expect(blockText({ kind: 'figure', src: 'x.png', alt: 'alt text', caption: ['A caption'] })).toBe('A caption');
    expect(blockText({ kind: 'figure', src: 'x.png', alt: 'alt text', caption: null })).toBe('');
  });
});

describe('reading time', () => {
  it('counts words in the title and every block, ignoring punctuation-only tokens', () => {
    expect(wordCount(doc([{ kind: 'paragraph', content: ['Three short words — really.'] }], 'Two words'))).toBe(6);
  });

  it('rounds to whole minutes at about 230 words per minute', () => {
    expect(readingMinutes(doc([{ kind: 'paragraph', content: [words(690)] }], ''))).toBe(3);
    expect(readingMinutes(doc([{ kind: 'paragraph', content: [words(1000)] }], ''))).toBe(4);
  });

  it('never says 0 minutes', () => {
    expect(readingMinutes(doc([], 'Hi'))).toBe(1);
  });
});
