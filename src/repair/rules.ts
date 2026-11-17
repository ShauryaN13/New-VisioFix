import type { NotFixedCounts } from '@/shared/report';
import {
  accessibleName,
  cleanText,
  hasName,
  isHiddenFromAT,
  isRendered,
  isTabbable,
  missingIdRefs,
  textOfIdRefs,
} from './a11y';
import type { FixKind } from './changes';
import { nameFromHref } from './link-names';
import { hasValidRole } from './roles';

/**
 * The repair rules. evaluate() looks at one element and returns what to
 * change (fixes) and what to report without changing (issues). It never
 * touches the DOM itself; the engine applies the fixes so every change goes
 * through the change log and can be undone.
 *
 * Do-no-harm: only add what's missing, only from a real source (the page's
 * own text, a caption, the link's destination), never a placeholder.
 */

export type IssueKind = keyof NotFixedCounts;

export interface Fix {
  el: Element;
  attr: string;
  value: string;
  kind: FixKind | null;
}

export interface Evaluation {
  fixes: Fix[];
  issues: IssueKind[];
  /** An image that hasn't loaded yet: check it again on its load event. */
  waitForLoad?: HTMLImageElement;
}

export interface RuleContext {
  doc: Document;
  /** Unique id for an element VisioFix needs to point aria-labelledby at. */
  newId(prefix: string): string;
  /** The value VisioFix itself set on an element, if any (so it isn't mistaken for the author's). */
  ourValue(el: Element, attr: string): string | null;
}

/** Buttons, links and fields that need a name. Submit/reset inputs get a default name from the browser. */
const CONTROL =
  'a[href], button, select, textarea, input:not([type="hidden"]):not([type="submit"]):not([type="reset"]), [role="button"], [role="link"]';

/** Largest image (in natural pixels) treated as a tracking pixel or spacer. */
const TINY = 2;

/** Longest alt text taken from a description or title. */
const MAX_ALT = 300;

export function evaluate(el: Element, ctx: RuleContext): Evaluation {
  const result: Evaluation = { fixes: [], issues: [] };

  // Hidden from screen readers: only the "focusable but silent" problem applies.
  if (isHiddenFromAT(el)) {
    hiddenFocusableRule(el, ctx, result);
    return result;
  }

  // ARIA (report only): invalid roles, references to ids that don't exist.
  const role = el.getAttribute('role');
  if (role !== null && !hasValidRole(role)) result.issues.push('invalidRoles');
  if (
    missingIdRefs(ctx.doc, el.getAttribute('aria-labelledby')).length > 0 ||
    missingIdRefs(ctx.doc, el.getAttribute('aria-describedby')).length > 0
  ) {
    result.issues.push('brokenReferences');
  }

  if (el instanceof HTMLImageElement) imageRule(el, ctx, result);
  else if (el.matches(CONTROL)) controlRule(el, ctx, result);
  return result;
}

/* ------------------------------------------------------------------ */
/* Unlabeled controls                                                  */
/* ------------------------------------------------------------------ */

function controlRule(el: Element, ctx: RuleContext, result: Evaluation): void {
  if ((el as HTMLButtonElement).disabled) return;
  if (hasName(el)) return;

  // aria-label="" (empty) is ignored by browsers, so it counts as missing.
  // An aria-labelledby the author wrote is left alone even if it's broken.
  const ariaLabel = el.getAttribute('aria-label');
  const canAddLabel = ariaLabel === null || cleanText(ariaLabel) === '';
  const hasLabelledBy = el.hasAttribute('aria-labelledby');

  if (el.matches('a[href]') && canAddLabel && !hasLabelledBy) {
    const name = nameFromHref(el.getAttribute('href'), ctx.doc.baseURI);
    if (name) {
      result.fixes.push({ el, attr: 'aria-label', value: name, kind: 'linkNames' });
      return;
    }
  }

  if (isField(el) && !hasLabelledBy && canAddLabel) {
    const label = adjacentOrphanLabel(el);
    if (label) {
      let id = label.id;
      if (!id) {
        id = ctx.newId('visiofix-label');
        result.fixes.push({ el: label, attr: 'id', value: id, kind: null });
      }
      result.fixes.push({ el, attr: 'aria-labelledby', value: id, kind: 'fieldLabels' });
      return;
    }
  }

  // Buttons with only an icon, fields with nothing nearby: no reliable source.
  if (isRendered(el)) result.issues.push('unnamedControls');
}

function isField(el: Element): boolean {
  return el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement;
}

/**
 * A visible <label> right before (or right after) the field that isn't
 * connected to any control: the author clearly meant it for this field but
 * forgot `for`, or `for` points at an id that doesn't exist.
 */
function adjacentOrphanLabel(field: Element): HTMLLabelElement | null {
  for (const sibling of [field.previousElementSibling, field.nextElementSibling]) {
    if (sibling instanceof HTMLLabelElement && sibling.control === null && cleanText(sibling.textContent)) {
      return sibling;
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Images                                                              */
/* ------------------------------------------------------------------ */

function imageRule(img: HTMLImageElement, ctx: RuleContext, result: Evaluation): void {
  // Any alt, including alt="" (decorative), is the author's decision. Never touch it.
  if (img.hasAttribute('alt')) return;
  // No source yet (script-driven lazy loading): nothing to describe. Checked again when src is set.
  if (!img.getAttribute('src') && !img.getAttribute('srcset')) return;
  const role = img.getAttribute('role');
  if (role && /\b(presentation|none)\b/i.test(role)) return;

  // Already named another way (aria-label, aria-labelledby, title).
  if (
    (img.hasAttribute('aria-label') || img.hasAttribute('aria-labelledby') || img.hasAttribute('title')) &&
    accessibleName(img) !== ''
  ) {
    return;
  }

  // Inside a link that has its own aria-label (from the author or from VisioFix):
  // the link's name is what screen readers read; the image inside is covered.
  const link = img.closest('a[href]');
  if (link && (cleanText(link.getAttribute('aria-label')) || ctx.ourValue(link, 'aria-label'))) return;

  // 1. In a <figure> with one image and a <figcaption>: point at the caption.
  const figure = img.closest('figure');
  const figcaption = figure?.querySelector(':scope > figcaption');
  if (figure && figcaption && figure.querySelectorAll('img').length === 1 && cleanText(figcaption.textContent)) {
    labelBy(img, figcaption, ctx, result);
    return;
  }

  // 2. The image already has a description: use it as the text alternative.
  const described = textOfIdRefs(ctx.doc, img.getAttribute('aria-describedby'));
  if (described) {
    result.fixes.push({ el: img, attr: 'alt', value: described.slice(0, MAX_ALT), kind: 'imageDescriptions' });
    return;
  }

  // 3. The link around it has a title.
  const linkTitle = cleanText(link?.getAttribute('title'));
  if (linkTitle) {
    result.fixes.push({ el: img, attr: 'alt', value: linkTitle.slice(0, MAX_ALT), kind: 'imageDescriptions' });
    return;
  }

  // 4. A WordPress caption (classic editor): <div class="wp-caption"><img><p class="wp-caption-text">.
  //    Class names are matched as whole words, never substrings.
  const wpCaption = img.closest('.wp-caption')?.querySelector('.wp-caption-text');
  if (wpCaption && cleanText(wpCaption.textContent) && img.closest('.wp-caption')?.querySelectorAll('img').length === 1) {
    labelBy(img, wpCaption, ctx, result);
    return;
  }

  // 5. Tracking pixels and spacers: only once the image has loaded, and only by
  //    its natural size. Rendered size is NOT used: lazy-loaded images that haven't
  //    loaded yet and hidden images (carousel slides, display:none) also measure 0×0.
  if (!img.complete) {
    result.waitForLoad = img;
    return;
  }
  if (img.naturalWidth > 0 && img.naturalWidth <= TINY && img.naturalHeight <= TINY) {
    result.fixes.push({ el: img, attr: 'alt', value: '', kind: 'decorativeImages' });
    return;
  }

  // Nothing reliable. A made-up description would be worse than none: screen
  // readers already announce an unlabeled image, so the user knows it's there.
  if (isRendered(img)) result.issues.push('imagesNeedDescription');
}

function labelBy(img: Element, source: Element, ctx: RuleContext, result: Evaluation): void {
  let id = source.id;
  if (!id) {
    id = ctx.newId('visiofix-caption');
    result.fixes.push({ el: source, attr: 'id', value: id, kind: null });
  }
  result.fixes.push({ el: img, attr: 'aria-labelledby', value: id, kind: 'imageDescriptions' });
}

/* ------------------------------------------------------------------ */
/* aria-hidden on focusable elements                                   */
/* ------------------------------------------------------------------ */

/** How many levels up from the aria-hidden element to look for the visible twin link. */
const TWIN_SEARCH_DEPTH = 3;

/**
 * A focusable element inside aria-hidden: keyboard users can Tab to it, but
 * screen readers say nothing. Only one case is clear-cut: a link that
 * duplicates a visible link to the same place nearby (the classic card with
 * an image link and a title link). Taking the hidden twin out of the Tab
 * order matches what the author meant. Everything else is reported only.
 */
function hiddenFocusableRule(el: Element, ctx: RuleContext, result: Evaluation): void {
  if (!isTabbable(el) || !isRendered(el)) return;
  // A tabindex VisioFix set itself doesn't count as the author's.
  if (el.getAttribute('tabindex') === '-1' && ctx.ourValue(el, 'tabindex') === '-1') return;

  if (el instanceof HTMLAnchorElement && !el.hasAttribute('tabindex') && hasVisibleTwin(el)) {
    result.fixes.push({ el, attr: 'tabindex', value: '-1', kind: 'hiddenDuplicates' });
    return;
  }
  result.issues.push('hiddenFocusable');
}

function hasVisibleTwin(link: HTMLAnchorElement): boolean {
  const hiddenRoot = link.closest('[aria-hidden="true"]');
  if (!hiddenRoot) return false;
  let scope: Element | null = hiddenRoot.parentElement;
  for (let depth = 0; scope && depth < TWIN_SEARCH_DEPTH; depth += 1) {
    for (const other of scope.querySelectorAll<HTMLAnchorElement>('a[href]')) {
      if (other === link || other.href !== link.href) continue;
      if (!isHiddenFromAT(other) && isRendered(other) && hasName(other)) return true;
    }
    scope = scope.parentElement;
  }
  return false;
}
