import { describe, expect, it } from 'vitest';
import { getSiteKey } from '@/shared/site';

describe('getSiteKey', () => {
  it('returns the hostname for normal web pages', () => {
    expect(getSiteKey('https://www.bbc.com/news')).toBe('www.bbc.com');
    expect(getSiteKey('http://localhost:5174/fixtures/images.html')).toBe('localhost');
  });

  it('treats www and non-www as different sites', () => {
    expect(getSiteKey('https://example.com/')).not.toBe(getSiteKey('https://www.example.com/'));
  });

  it('lowercases the hostname', () => {
    expect(getSiteKey('https://WWW.Example.COM/Path')).toBe('www.example.com');
  });

  it('returns null for pages extensions cannot run on', () => {
    expect(getSiteKey('chrome://extensions/')).toBeNull();
    expect(getSiteKey('about:addons')).toBeNull();
    expect(getSiteKey('file:///C:/page.html')).toBeNull();
    expect(getSiteKey('chrome-extension://abc/popup.html')).toBeNull();
    expect(getSiteKey('https://chromewebstore.google.com/detail/x')).toBeNull();
    expect(getSiteKey('https://chrome.google.com/webstore/detail/x')).toBeNull();
    expect(getSiteKey('https://microsoftedge.microsoft.com/addons/detail/x')).toBeNull();
    expect(getSiteKey('edge://extensions/')).toBeNull();
  });

  it('allows the rest of chrome.google.com', () => {
    expect(getSiteKey('https://chrome.google.com/intl/en/chrome/')).toBe('chrome.google.com');
  });

  it('returns null for missing or malformed URLs', () => {
    expect(getSiteKey(undefined)).toBeNull();
    expect(getSiteKey(null)).toBeNull();
    expect(getSiteKey('')).toBeNull();
    expect(getSiteKey('not a url')).toBeNull();
  });
});
