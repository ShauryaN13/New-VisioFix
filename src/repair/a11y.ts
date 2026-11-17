import { computeAccessibleName } from 'dom-accessibility-api';

/**
 * Small accessibility helpers shared by the repair rules.
 * The full accessible-name computation (dom-accessibility-api, per the W3C
 * accname spec) is accurate but reads computed styles, so the rules call
 * the cheap checks first and only fall back to it when they're unsure.
 */

/** Inside aria-hidden="true", hidden or inert: screen readers never reach it. */
export function isHiddenFromAT(el: Element): boolean {
  return el.closest('[aria-hidden="true"], [hidden], [inert]') !== null;
}

/**
 * Is the element rendered (not display:none, not visibility:hidden)?
 * Uses Element.checkVisibility() (Chrome 105+). Where it doesn't exist
 * (the unit-test DOM), elements count as rendered.
 */
export function isRendered(el: Element): boolean {
  const check = (el as Element & { checkVisibility?: (opts?: object) => boolean }).checkVisibility;
  return typeof check === 'function' ? check.call(el, { visibilityProperty: true }) : true;
}

const FOCUSABLE =
  'a[href], area[href], button, input:not([type="hidden"]), select, textarea, iframe, [contenteditable=""], [contenteditable="true"], [tabindex]';

/** Can the user Tab to it? (Ignores rendering; callers check that separately.) */
export function isTabbable(el: Element): boolean {
  if (!el.matches(FOCUSABLE)) return false;
  if ((el as HTMLButtonElement).disabled) return false;
  const tabindex = el.getAttribute('tabindex');
  return tabindex === null || Number.parseInt(tabindex, 10) >= 0;
}

export function tabbableWithin(root: Element): Element[] {
  const found = root.matches(FOCUSABLE) ? [root] : [];
  return [...found, ...root.querySelectorAll(FOCUSABLE)].filter(isTabbable);
}

/** Trimmed text with runs of whitespace collapsed. */
export function cleanText(text: string | null | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

/** Text of the elements an IDREF list points to, or null if any id is missing. */
export function textOfIdRefs(doc: Document, ids: string | null): string | null {
  const list = cleanText(ids).split(' ').filter(Boolean);
  if (list.length === 0) return null;
  const parts: string[] = [];
  for (const id of list) {
    const target = doc.getElementById(id);
    if (!target) return null;
    parts.push(cleanText(target.textContent));
  }
  return cleanText(parts.join(' '));
}

/** IDs in an IDREF attribute that don't exist in the document. */
export function missingIdRefs(doc: Document, ids: string | null): string[] {
  return cleanText(ids)
    .split(' ')
    .filter((id) => id && !doc.getElementById(id));
}

/** The accessible name, as browsers compute it (CSS-generated content excluded). */
export function accessibleName(el: Element): string {
  try {
    return cleanText(computeAccessibleName(el));
  } catch {
    // A malformed page can make the computation throw; treat that as "don't know"
    // and report the element as named, so VisioFix never acts on a guess.
    return '?';
  }
}

export type NameGuess = 'named' | 'unnamed' | 'unsure';

/**
 * A fast answer to "does this control have a name?" that reads no styles, so
 * the full computation (which does) only runs when the answer is unclear.
 *
 *   'named'   - certain: it has a label, title, or text/alt/svg title inside.
 *   'unnamed' - certain: nothing inside could produce a name.
 *   'unsure'  - something only the full computation can resolve
 *               (aria-labelledby, embedded controls, roles with names).
 *
 * Text inside display:none counts as a name here. That can only make
 * VisioFix skip a repair, never make a wrong one.
 */
export function guessName(el: Element): NameGuess {
  if (cleanText(el.getAttribute('aria-label'))) return 'named';
  if (el.hasAttribute('aria-labelledby')) return 'unsure';
  if (cleanText(el.getAttribute('title'))) return 'named';
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
    if (el instanceof HTMLInputElement && el.type === 'image' && cleanText(el.alt)) return 'named';
    if (!(el instanceof HTMLSelectElement) && cleanText(el.getAttribute('placeholder'))) return 'named';
    if (el.labels && [...el.labels].some((label) => cleanText(label.textContent))) return 'named';
    return el.labels && el.labels.length > 0 ? 'unsure' : 'unnamed';
  }
  return guessContent(el);
}

/** Name from content: walk the children, skipping anything hidden from screen readers. */
function guessContent(root: Element): NameGuess {
  let result: NameGuess = 'unnamed';
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      if (node.nodeType === Node.TEXT_NODE) return NodeFilter.FILTER_ACCEPT;
      const el = node as Element;
      if (el.getAttribute('aria-hidden') === 'true' || el.hasAttribute('hidden')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (cleanText(node.textContent)) return 'named';
      continue;
    }
    const el = node as Element;
    if (cleanText(el.getAttribute('aria-label'))) return 'named';
    if (el instanceof HTMLImageElement && cleanText(el.getAttribute('alt'))) return 'named';
    if (el.tagName.toLowerCase() === 'title' && cleanText(el.textContent)) return 'named'; // <svg><title>
    if (
      el.hasAttribute('aria-labelledby') ||
      el instanceof HTMLInputElement ||
      el instanceof HTMLSelectElement ||
      el instanceof HTMLTextAreaElement ||
      el.tagName === 'OBJECT' ||
      el.tagName === 'MATH'
    ) {
      result = 'unsure';
    }
  }
  return result;
}

/** Does the element have a name? Fast guess first, full computation only when unclear. */
export function hasName(el: Element): boolean {
  const guess = guessName(el);
  if (guess !== 'unsure') return guess === 'named';
  return accessibleName(el) !== '';
}
