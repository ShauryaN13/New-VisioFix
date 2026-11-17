/**
 * Which pages VisioFix can work on, and the key used for per-site settings.
 *
 * A "site" is a hostname (www.example.com and example.com are different sites).
 * That keeps the per-site switch predictable: it affects exactly the host shown
 * in the popup.
 */

/**
 * Hosts where Chrome and Edge block extensions from running content scripts,
 * even with full host access. The popup uses this to say "VisioFix can't run here"
 * instead of the misleading "reload this page".
 */
const BLOCKED_HOSTS = new Set([
  // Chrome Web Store
  'chromewebstore.google.com',
  // Edge Add-ons store (Edge runs the same build)
  'microsoftedge.microsoft.com',
]);

function parse(url: string | undefined | null): URL | null {
  if (!url) return null;
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

/**
 * Returns the per-site key (the hostname) for a page VisioFix can run on,
 * or null for pages it can't: browser pages (chrome://, about:), local files,
 * extension pages, and the browser's own add-on stores.
 */
export function getSiteKey(url: string | undefined | null): string | null {
  const parsed = parse(url);
  if (!parsed) return null;
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;

  const host = parsed.hostname.toLowerCase();
  if (!host) return null;
  if (BLOCKED_HOSTS.has(host)) return null;
  // The old Chrome Web Store address still redirects into the store.
  if (host === 'chrome.google.com' && parsed.pathname.startsWith('/webstore')) return null;
  return host;
}
