import { describe, expect, it } from 'vitest';
import { nameFromHref } from '@/repair/link-names';

const BASE = 'https://www.example.com/news/story';

describe('nameFromHref', () => {
  it('uses host and path, without www, tracking codes, hash or trailing slash', () => {
    expect(nameFromHref('https://twitter.com/visiofix', BASE)).toBe('twitter.com/visiofix');
    expect(nameFromHref('https://www.example.org/about-us/?utm_source=x&fbclid=y#team', BASE)).toBe('example.org/about-us');
    expect(nameFromHref('https://example.org/', BASE)).toBe('example.org');
  });

  it('keeps query parameters that change where the link goes', () => {
    // Found on Wikipedia: an "edit" link that would otherwise be named after the article itself.
    expect(nameFromHref('https://en.wikipedia.org/wiki/Web_accessibility?action=edit', BASE)).toBe(
      'en.wikipedia.org/wiki/Web_accessibility?action=edit',
    );
    expect(nameFromHref('https://example.org/search?q=shoes&utm_medium=email&page=2', BASE)).toBe(
      'example.org/search?q=shoes&page=2',
    );
  });

  it('resolves relative links against the page', () => {
    expect(nameFromHref('/contact', BASE)).toBe('example.com/contact');
    expect(nameFromHref('../sports', BASE)).toBe('example.com/sports');
  });

  it('decodes percent-encoded paths', () => {
    expect(nameFromHref('https://example.org/caf%C3%A9-menu', BASE)).toBe('example.org/café-menu');
  });

  it('names email and phone links', () => {
    expect(nameFromHref('mailto:help@example.com?subject=Hi', BASE)).toBe('Email help@example.com');
    expect(nameFromHref('tel:+1-555-0100', BASE)).toBe('Call +1-555-0100');
  });

  it('returns null when the destination says nothing useful', () => {
    expect(nameFromHref('#', BASE)).toBeNull();
    expect(nameFromHref('#comments', BASE)).toBeNull();
    expect(nameFromHref('javascript:void(0)', BASE)).toBeNull();
    expect(nameFromHref('', BASE)).toBeNull();
    expect(nameFromHref(null, BASE)).toBeNull();
    expect(nameFromHref('mailto:', BASE)).toBeNull();
  });

  it('returns null for a jump to another spot on the same page', () => {
    expect(nameFromHref('https://www.example.com/news/story#comments', BASE)).toBeNull();
    expect(nameFromHref('/news/story#top', BASE)).toBeNull();
  });

  it('shortens long destinations to 60 characters', () => {
    const name = nameFromHref(`https://example.org/${'very-long-path-segment/'.repeat(6)}`, BASE);
    expect(name?.length).toBe(60);
    expect(name?.endsWith('…')).toBe(true);
  });
});
