import {
  type FixCounts,
  type HeadingIssue,
  type NotFixedCounts,
  type PageReport,
  totalFixes,
  totalToReview,
} from '@/shared/report';
import { h, uid } from '@/ui/dom';
import { icon } from '@/ui/icons';
import { logoMark } from '@/ui/logo';

/**
 * The popup, as a function of its state. No browser APIs here: the caller (the
 * real popup, or the design preview) supplies the state and the handlers.
 * Status is shown as text, never spoken by VisioFix.
 *
 * Two pages inside the popup: "main", and "issues" (what VisioFix found but
 * didn't change), reached from one line on the main page, with a Back button.
 */

export type PopupView =
  /** Normal page. repairsOn=false means the user paused repairs on this site. */
  | { kind: 'ready'; host: string; repairsOn: boolean; report: PageReport | null }
  /** Repairs are off in settings (global switch). Focus Mode still works. */
  | { kind: 'off-everywhere'; host: string }
  /** chrome:// pages, the Web Store, local files: Chrome blocks extensions there. */
  | { kind: 'unsupported' }
  /** Tab was open before VisioFix was installed or updated: no content script yet. */
  | { kind: 'needs-reload'; host: string };

export interface PopupModel {
  view: PopupView;
  /** Current shortcuts (users can change them), or null when none is set. */
  shortcuts: { focusMode: string | null; readAloud: string | null };
}

export interface PopupHandlers {
  onToggleSite(on: boolean): void;
  onTurnOnEverywhere(): void;
  onFocusMode(): void;
  onReadAloud(): void;
  onReload(): void;
  onOpenSettings(): void;
}

export type PopupPage = 'main' | 'issues';

/** Plain-language label first; the technical term underneath, smaller. */
const FIX_LABELS: Record<keyof FixCounts, string> = {
  linkNames: 'Links given a name',
  fieldLabels: 'Form fields connected to their label',
  imageDescriptions: 'Images given a description',
  decorativeImages: 'Invisible tracking images hidden',
  hiddenDuplicates: 'Duplicate links taken out of Tab order',
};

const NOT_FIXED_LABELS: Record<keyof NotFixedCounts, { plain: string; technical: string }> = {
  unnamedControls: { plain: 'Buttons or fields with no name', technical: 'No accessible name' },
  imagesNeedDescription: { plain: 'Images without a description', technical: 'Missing alt text' },
  invalidRoles: { plain: 'Roles the browser ignores', technical: 'Invalid ARIA role' },
  brokenReferences: {
    plain: 'Labels that point to nothing',
    technical: 'Broken aria-labelledby or aria-describedby',
  },
  hiddenFocusable: {
    plain: 'Items you can Tab to but can’t hear',
    technical: 'Focusable element inside aria-hidden',
  },
};

/** Long heading lists are cut to this many, plus an "and N more" line. */
const MAX_HEADING_ROWS = 4;

export function renderPopup(
  root: HTMLElement,
  model: PopupModel,
  handlers: PopupHandlers,
  page?: PopupPage,
): void {
  // Remember which page is open across re-renders (e.g. when the report updates).
  const current: PopupPage = page ?? (root.dataset.page as PopupPage | undefined) ?? 'main';
  const report = model.view.kind === 'ready' && model.view.repairsOn ? model.view.report : null;
  const showIssues = current === 'issues' && report !== null;
  root.dataset.page = showIssues ? 'issues' : 'main';

  // Keep keyboard focus on the same control after re-rendering.
  const focusKey = (document.activeElement as HTMLElement | null)?.dataset?.focusKey;
  const go = (next: PopupPage, focus: string) => {
    renderPopup(root, model, handlers, next);
    root.querySelector<HTMLElement>(`[data-focus-key="${focus}"]`)?.focus();
  };

  root.replaceChildren(
    h(
      'div',
      { class: 'popup' },
      showIssues && report
        ? issuesPage(report, () => go('main', 'open-issues'))
        : mainPage(model, handlers, () => go('issues', 'issues-title')),
    ),
  );
  if (focusKey) root.querySelector<HTMLElement>(`[data-focus-key="${focusKey}"]`)?.focus();
}

/* ---------------- Main page ---------------- */

function mainPage(model: PopupModel, handlers: PopupHandlers, openIssues: () => void): HTMLElement[] {
  const { view } = model;
  const header = h(
    'header',
    { class: 'popup-header' },
    h('h1', { class: 'brand popup-title' }, logoMark(28), 'VisioFix'),
    h(
      'button',
      {
        type: 'button',
        class: 'icon-btn',
        'aria-label': 'Settings',
        title: 'Settings',
        'data-focus-key': 'settings',
        onclick: () => handlers.onOpenSettings(),
      },
      icon('settings'),
    ),
  );

  const body = h('div', { class: 'popup-body' });

  if (view.kind === 'ready') {
    body.append(
      statusCard({
        host: view.host,
        on: view.repairsOn,
        status: view.repairsOn ? 'Repairing this page' : 'Paused on this site',
        note: view.repairsOn ? null : 'The page is exactly as the site made it.',
        control: siteSwitch(view.repairsOn, handlers),
      }),
      tiles(model, handlers),
    );
    if (view.repairsOn && view.report) body.append(pageCard(view.report, openIssues));
  } else if (view.kind === 'off-everywhere') {
    body.append(
      statusCard({
        host: view.host,
        on: false,
        status: 'Repairs are paused everywhere',
        note: null,
        control: h(
          'button',
          {
            type: 'button',
            class: 'btn btn-tonal btn-small',
            'data-focus-key': 'turn-on',
            onclick: () => handlers.onTurnOnEverywhere(),
          },
          'Turn on',
        ),
      }),
      tiles(model, handlers),
    );
  } else if (view.kind === 'unsupported') {
    body.append(
      h(
        'section',
        { class: 'card message' },
        icon('ban', { className: 'message-icon' }),
        h('h2', { class: 'message-title' }, 'VisioFix can’t run on this page'),
        h(
          'p',
          { class: 'message-body' },
          'Chrome doesn’t let extensions change its own pages, like settings, new tabs and the Chrome Web Store.',
        ),
      ),
    );
  } else {
    body.append(
      statusCard({
        host: view.host,
        on: false,
        status: 'Not running on this tab yet',
        note: 'This tab was open before VisioFix was installed or updated.',
        control: null,
        action: h(
          'button',
          {
            type: 'button',
            class: 'btn btn-primary btn-block',
            'data-focus-key': 'reload',
            onclick: () => handlers.onReload(),
          },
          icon('rotateCw'),
          'Reload this page',
        ),
      }),
    );
  }

  return [header, body];
}

interface StatusCardSpec {
  host: string;
  on: boolean;
  status: string;
  note: string | null;
  control: HTMLElement | null;
  action?: HTMLElement;
}

function statusCard(spec: StatusCardSpec): HTMLElement {
  const hostId = uid('host');
  const statusId = uid('status');
  if (spec.control?.getAttribute('role') === 'switch') {
    // The switch's name is "Automatic repairs on <host>"; its state (on/off) is announced by the role.
    spec.control.setAttribute('aria-describedby', statusId);
  }
  return h(
    'section',
    { class: 'card status-card', 'aria-labelledby': hostId },
    h(
      'div',
      { class: 'status-text' },
      h('h2', { id: hostId, class: 'status-host' }, spec.host),
      h(
        'p',
        { class: 'status-line' },
        h('span', { class: `status-dot${spec.on ? '' : ' is-off'}`, 'aria-hidden': 'true' }),
        h('span', { id: statusId }, spec.status),
      ),
      spec.note && h('p', { class: 'status-note' }, spec.note),
    ),
    spec.control,
    spec.action,
  );
}

function siteSwitch(on: boolean, handlers: PopupHandlers): HTMLElement {
  return h(
    'button',
    {
      type: 'button',
      role: 'switch',
      class: 'switch',
      'aria-checked': on ? 'true' : 'false',
      'aria-label': 'Automatic repairs on this site',
      'data-focus-key': 'site-switch',
      onclick: () => handlers.onToggleSite(!on),
    },
    h('span', { class: 'switch-track', 'aria-hidden': 'true' }),
    // Visible On/Off so the state never depends on color or knob position alone.
    h('span', { class: 'switch-state', 'aria-hidden': 'true' }, on ? 'On' : 'Off'),
  );
}

function tiles(model: PopupModel, handlers: PopupHandlers): HTMLElement {
  return h(
    'div',
    { class: 'tiles' },
    tile('bookOpen', 'Focus Mode', model.shortcuts.focusMode, 'focus-mode', handlers.onFocusMode),
    tile('volume', 'Read aloud', model.shortcuts.readAloud, 'read-aloud', handlers.onReadAloud),
  );
}

function tile(
  iconName: 'bookOpen' | 'volume',
  label: string,
  shortcut: string | null,
  key: string,
  onClick: () => void,
): HTMLElement {
  // The shortcut is the accessible description (read once, after the name)
  // and the mouse tooltip; it is not printed on the tile.
  const hintId = shortcut ? uid('shortcut') : null;
  return h(
    'button',
    {
      type: 'button',
      class: 'tile',
      title: shortcut ? `${label} (${shortcut})` : label,
      'aria-describedby': hintId,
      'aria-keyshortcuts': shortcut ? shortcut.replace(/\s/g, '') : null,
      'data-focus-key': key,
      onclick: () => onClick(),
    },
    icon(iconName, { className: 'tile-icon' }),
    h('span', { class: 'tile-label' }, label),
    hintId && h('span', { id: hintId, class: 'visually-hidden' }, `Shortcut: ${shortcut}`),
  );
}

function pageCard(report: PageReport, openIssues: () => void): HTMLElement {
  const total = totalFixes(report.fixes);
  const toReview = totalToReview(report);
  const rows = (Object.keys(FIX_LABELS) as (keyof FixCounts)[]).filter((key) => report.fixes[key] > 0);

  const fixes =
    total === 0
      ? h('p', { class: 'fix-none' }, icon('circleCheck'), 'Nothing needed fixing on this page')
      : [
          h(
            'p',
            { class: 'fix-total' },
            h('span', { class: 'fix-number' }, String(total)),
            h('span', null, total === 1 ? ' fix on this page' : ' fixes on this page'),
          ),
          h(
            'details',
            { class: 'disclosure fix-details' },
            h('summary', { 'data-focus-key': 'what-changed' }, 'See what changed', icon('chevronDown')),
            h(
              'ul',
              { class: 'tint-list', role: 'list' },
              rows.map((key) =>
                h(
                  'li',
                  null,
                  h('span', null, FIX_LABELS[key]),
                  h('span', { class: 'count' }, String(report.fixes[key])),
                ),
              ),
            ),
          ),
        ];

  const issues =
    toReview === 0
      ? h('p', { class: 'issues-row is-clear' }, icon('circleCheck'), 'Nothing else to review')
      : h(
          'button',
          { type: 'button', class: 'issues-row', 'data-focus-key': 'open-issues', onclick: () => openIssues() },
          h(
            'span',
            null,
            h('strong', null, String(toReview)),
            ` ${toReview === 1 ? 'thing' : 'things'} VisioFix can’t fix safely`,
          ),
          icon('chevronRight', { className: 'issues-chevron' }),
        );

  return h('section', { class: 'card page-card', 'aria-label': 'This page' }, fixes, issues);
}

/* ---------------- Issues page ---------------- */

function issuesPage(report: PageReport, back: () => void): HTMLElement[] {
  const headingRows = report.headings.slice(0, MAX_HEADING_ROWS).map((issue) => {
    const label = headingLabel(issue);
    return issueRow(label.plain, label.technical, null);
  });
  const extraHeadings = report.headings.length - MAX_HEADING_ROWS;
  const otherRows = (Object.keys(NOT_FIXED_LABELS) as (keyof NotFixedCounts)[])
    .filter((key) => report.notFixed[key] > 0)
    .map((key) => issueRow(NOT_FIXED_LABELS[key].plain, NOT_FIXED_LABELS[key].technical, report.notFixed[key]));

  return [
    h(
      'header',
      { class: 'popup-header' },
      h(
        'button',
        { type: 'button', class: 'btn-back', 'data-focus-key': 'back', onclick: () => back() },
        icon('arrowLeft'),
        'Back',
      ),
    ),
    h(
      'div',
      { class: 'popup-body' },
      h(
        'h1',
        { class: 'popup-title issues-title', tabindex: '-1', 'data-focus-key': 'issues-title' },
        'What VisioFix can’t fix safely',
      ),
      h(
        'p',
        { class: 'issues-intro' },
        'VisioFix only changes what it can fix without guessing. These need the site’s author.',
      ),
      headingRows.length > 0 &&
        h(
          'section',
          { class: 'issue-group' },
          h('h2', { class: 'group-title' }, 'Headings'),
          h(
            'ul',
            { class: 'issue-list', role: 'list' },
            headingRows,
            extraHeadings > 0 && h('li', { class: 'issue-more' }, `and ${extraHeadings} more`),
          ),
        ),
      otherRows.length > 0 &&
        h(
          'section',
          { class: 'issue-group' },
          h('h2', { class: 'group-title' }, 'Labels and roles'),
          h('ul', { class: 'issue-list', role: 'list' }, otherRows),
        ),
    ),
  ];
}

function issueRow(plain: string, technical: string, count: number | null): HTMLElement {
  return h(
    'li',
    { class: 'issue' },
    h('span', { class: 'issue-text' }, h('span', { class: 'issue-plain' }, plain), h('span', { class: 'issue-tech' }, technical)),
    count !== null && h('span', { class: 'count' }, String(count)),
  );
}

function headingLabel(issue: HeadingIssue): { plain: string; technical: string } {
  switch (issue.kind) {
    case 'missing-h1':
      return { plain: 'No main heading', technical: 'Missing h1' };
    case 'skipped-level':
      return { plain: 'A heading level is skipped', technical: `h${issue.from} → h${issue.to}: “${issue.text}”` };
    case 'empty':
      return { plain: 'An empty heading', technical: `Empty h${issue.level}` };
  }
}
