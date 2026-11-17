/**
 * What the repair engine reports to the popup for one page.
 * Phase 2 uses these with sample data; Phase 3 fills them from the real engine.
 */

/** Changes VisioFix made, by type. */
export interface FixCounts {
  /** Links with no name, named from their destination (or title). */
  linkNames: number;
  /** Form fields connected to a nearby label with aria-labelledby. */
  fieldLabels: number;
  /** Images named from a caption, description, or parent link title. */
  imageDescriptions: number;
  /** Loaded images of 2px or less (tracking pixels, spacers) given alt="". */
  decorativeImages: number;
  /** Duplicate links inside aria-hidden taken out of the Tab order. */
  hiddenDuplicates: number;
}

/** Problems found but deliberately not changed (report only). */
export interface NotFixedCounts {
  /** Buttons, links or fields with no name and no reliable source for one. */
  unnamedControls: number;
  /** Images with no alt and nothing reliable to describe them. */
  imagesNeedDescription: number;
  /** role values that aren't valid ARIA roles (browsers ignore them). */
  invalidRoles: number;
  /** aria-labelledby / aria-describedby pointing to ids that don't exist. */
  brokenReferences: number;
  /** Focusable elements inside aria-hidden that we couldn't safely fix. */
  hiddenFocusable: number;
}

export type HeadingIssue =
  | { kind: 'missing-h1' }
  | { kind: 'skipped-level'; from: number; to: number; text: string }
  | { kind: 'empty'; level: number };

export interface PageReport {
  fixes: FixCounts;
  notFixed: NotFixedCounts;
  headings: HeadingIssue[];
}

export function totalFixes(fixes: FixCounts): number {
  return Object.values(fixes).reduce((sum, n) => sum + n, 0);
}

export function totalToReview(report: PageReport): number {
  return report.headings.length + Object.values(report.notFixed).reduce((sum, n) => sum + n, 0);
}
