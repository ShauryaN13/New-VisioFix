import type { HeadingIssue } from '@/shared/report';
import { accessibleName, cleanText, isHiddenFromAT, isRendered } from './a11y';
import { firstValidRole } from './roles';

/**
 * Heading check (report only, nothing is changed): missing main heading,
 * skipped levels, empty headings. Runs when the popup asks, not continuously.
 * More than one h1 is valid HTML and isn't flagged.
 */

const MAX_TEXT = 60;

interface Heading {
  level: number;
  text: string;
}

export function findHeadings(doc: Document): Heading[] {
  const headings: Heading[] = [];
  for (const el of doc.querySelectorAll('h1, h2, h3, h4, h5, h6, [role]')) {
    const level = headingLevel(el);
    if (level === null || isHiddenFromAT(el) || !isRendered(el)) continue;
    const text = cleanText(el.textContent) || accessibleName(el);
    headings.push({ level, text });
  }
  return headings;
}

/** The level screen readers announce, or null if the element isn't a heading. */
function headingLevel(el: Element): number | null {
  const role = firstValidRole(el.getAttribute('role'));
  const native = /^H([1-6])$/.exec(el.tagName);
  const isHeading = role === 'heading' || (native !== null && role === null);
  if (!isHeading) return null;
  const ariaLevel = Number.parseInt(el.getAttribute('aria-level') ?? '', 10);
  if (ariaLevel >= 1) return ariaLevel;
  if (native) return Number(native[1]);
  return 2; // role="heading" without aria-level defaults to level 2
}

export function checkHeadings(doc: Document): HeadingIssue[] {
  const headings = findHeadings(doc);
  const issues: HeadingIssue[] = [];
  if (!headings.some((h) => h.level === 1)) issues.push({ kind: 'missing-h1' });

  let previous = 0;
  for (const heading of headings) {
    if (!heading.text) issues.push({ kind: 'empty', level: heading.level });
    // A jump of more than one level down. Going back up (h4 → h2) is fine.
    if (previous > 0 && heading.level > previous + 1) {
      const text = heading.text.length > MAX_TEXT ? `${heading.text.slice(0, MAX_TEXT - 1)}…` : heading.text;
      issues.push({ kind: 'skipped-level', from: previous, to: heading.level, text });
    }
    previous = heading.level;
  }
  return issues;
}
