import { describe, expect, it } from 'vitest';
import { guessName, hasName } from '@/repair/a11y';
import { $, load } from './helpers';

/**
 * guessName() must never say "unnamed" for something that has a name:
 * that would make VisioFix add a label over the author's.
 */
describe('guessName', () => {
  const guess = (html: string) => {
    load(html);
    return guessName($('#t'));
  };

  it('is sure about plain text, alt text, svg titles and labels', () => {
    expect(guess('<a id="t" href="/">Home</a>')).toBe('named');
    expect(guess('<a id="t" href="/"><img src="x" alt="Home"></a>')).toBe('named');
    expect(guess('<button id="t"><svg><title>Search</title></svg></button>')).toBe('named');
    expect(guess('<button id="t" aria-label="Close"></button>')).toBe('named');
    expect(guess('<button id="t" title="Menu"><svg></svg></button>')).toBe('named');
    expect(guess('<a id="t" href="/"><span role="img" aria-label="Cart"></span></a>')).toBe('named');
  });

  it('is sure there is no name when nothing inside could provide one', () => {
    expect(guess('<a id="t" href="/"><svg><path d="M0 0"/></svg></a>')).toBe('unnamed');
    expect(guess('<a id="t" href="/"><img src="x"></a>')).toBe('unnamed');
    expect(guess('<a id="t" href="/"><span aria-hidden="true">→</span></a>')).toBe('unnamed');
    expect(guess('<button id="t"><i class="fa fa-bars"></i></button>')).toBe('unnamed');
  });

  it('hands anything unclear to the full computation', () => {
    expect(guess('<a id="t" href="/" aria-labelledby="x"></a><span id="x">Docs</span>')).toBe('unsure');
    expect(guess('<a id="t" href="/"><svg aria-labelledby="x"></svg></a><span id="x">Docs</span>')).toBe('unsure');
  });

  it('agrees with the full computation in the unsure cases', () => {
    load('<a id="t" href="/"><svg aria-labelledby="x"></svg></a><span id="x">Docs</span>');
    expect(hasName($('#t'))).toBe(true);
    load('<a id="t" href="/" aria-labelledby="gone"></a>');
    expect(hasName($('#t'))).toBe(false);
  });
});
