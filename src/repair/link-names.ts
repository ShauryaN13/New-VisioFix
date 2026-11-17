/**
 * A readable name for a link from where it goes, for links that have no name
 * at all (typically an icon or an image without alt text).
 *
 * Without a name, screen readers fall back to reading the raw URL, including
 * tracking codes like "?utm_source=…". VisioFix gives the same information,
 * shortened and without tracking codes: "twitter.com/visiofix",
 * "example.org/search?q=shoes", "Email help@example.com".
 *
 * Returns null when the destination says nothing useful: same-page "#" links,
 * javascript: links, or anything unparsable. Those are reported, not fixed.
 */

const MAX_LENGTH = 60;

/**
 * Query parameters that only track clicks. They're dropped from the name;
 * every other parameter is kept, because it can change where the link goes
 * (?action=edit, ?page=2, ?q=shoes).
 */
const TRACKING_PARAM = /^(utm_\w+|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid|igshid|ref|ref_src|ref_url|si|spm|_ga|_gl)$/i;

function meaningfulQuery(url: URL): string {
  const params = [...url.searchParams].filter(([key]) => !TRACKING_PARAM.test(key));
  if (params.length === 0) return '';
  return `?${params.map(([key, value]) => (value ? `${key}=${value}` : key)).join('&')}`;
}

function safeDecode(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

export function nameFromHref(href: string | null, baseUrl: string): string | null {
  const raw = href?.trim();
  if (!raw || raw.startsWith('#')) return null;

  let url: URL;
  try {
    url = new URL(raw, baseUrl);
  } catch {
    return null;
  }

  switch (url.protocol) {
    case 'mailto:': {
      const address = safeDecode(url.pathname).trim();
      return address ? `Email ${address}` : null;
    }
    case 'tel:': {
      const number = safeDecode(url.pathname).trim();
      return number ? `Call ${number}` : null;
    }
    case 'http:':
    case 'https:': {
      // A link to another spot on this same page ("/page#comments") isn't a destination.
      try {
        const base = new URL(baseUrl);
        if (url.hash && url.origin === base.origin && url.pathname === base.pathname && url.search === base.search) {
          return null;
        }
      } catch {
        // No usable base URL: fall through and name it.
      }
      const host = url.hostname.replace(/^www\./, '');
      const path = safeDecode(url.pathname).replace(/\/+$/, '');
      const name = `${host}${path}${meaningfulQuery(url)}`;
      return name.length > MAX_LENGTH ? `${name.slice(0, MAX_LENGTH - 1)}…` : name;
    }
    default:
      return null;
  }
}
