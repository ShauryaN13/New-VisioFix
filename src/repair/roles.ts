/**
 * Every non-abstract role a browser will honor: WAI-ARIA 1.2 (plus the newer
 * roles Chrome already maps), Digital Publishing (doc-*) and Graphics
 * (graphics-*). A role attribute with no token in this list is ignored by
 * browsers, which use the element's native role instead. VisioFix reports such
 * values but never changes them.
 */
export const VALID_ROLES = new Set([
  // WAI-ARIA 1.2 and 1.3
  'alert', 'alertdialog', 'application', 'article', 'banner', 'blockquote', 'button', 'caption', 'cell',
  'checkbox', 'code', 'columnheader', 'combobox', 'comment', 'complementary', 'contentinfo', 'definition',
  'deletion', 'dialog', 'directory', 'document', 'emphasis', 'feed', 'figure', 'form', 'generic', 'grid',
  'gridcell', 'group', 'heading', 'image', 'img', 'insertion', 'link', 'list', 'listbox', 'listitem', 'log',
  'main', 'mark', 'marquee', 'math', 'menu', 'menubar', 'menuitem', 'menuitemcheckbox', 'menuitemradio',
  'meter', 'navigation', 'none', 'note', 'option', 'paragraph', 'presentation', 'progressbar', 'radio',
  'radiogroup', 'region', 'row', 'rowgroup', 'rowheader', 'scrollbar', 'search', 'searchbox',
  'sectionfooter', 'sectionheader', 'separator', 'slider', 'spinbutton', 'status', 'strong', 'subscript',
  'suggestion', 'superscript', 'switch', 'tab', 'table', 'tablist', 'tabpanel', 'term', 'textbox', 'time',
  'timer', 'toolbar', 'tooltip', 'tree', 'treegrid', 'treeitem',
  // Digital Publishing ARIA
  'doc-abstract', 'doc-acknowledgments', 'doc-afterword', 'doc-appendix', 'doc-backlink', 'doc-biblioentry',
  'doc-bibliography', 'doc-biblioref', 'doc-chapter', 'doc-colophon', 'doc-conclusion', 'doc-cover',
  'doc-credit', 'doc-credits', 'doc-dedication', 'doc-endnote', 'doc-endnotes', 'doc-epigraph',
  'doc-epilogue', 'doc-errata', 'doc-example', 'doc-footnote', 'doc-foreword', 'doc-glossary',
  'doc-glossref', 'doc-index', 'doc-introduction', 'doc-noteref', 'doc-notice', 'doc-pagebreak',
  'doc-pagefooter', 'doc-pageheader', 'doc-pagelist', 'doc-part', 'doc-preface', 'doc-prologue',
  'doc-pullquote', 'doc-qna', 'doc-subtitle', 'doc-tip', 'doc-toc',
  // Graphics ARIA
  'graphics-document', 'graphics-object', 'graphics-symbol',
]);

/** True when at least one token of the role attribute is a role browsers honor. */
export function hasValidRole(roleAttr: string): boolean {
  const tokens = roleAttr.toLowerCase().split(/\s+/).filter(Boolean);
  // An empty role="" is ignored by browsers but isn't an invalid value worth reporting.
  return tokens.length === 0 || tokens.some((token) => VALID_ROLES.has(token));
}

/** The role a browser will actually use from a role attribute: its first valid token. */
export function firstValidRole(roleAttr: string | null): string | null {
  if (!roleAttr) return null;
  return roleAttr
    .toLowerCase()
    .split(/\s+/)
    .find((token) => VALID_ROLES.has(token)) ?? null;
}
