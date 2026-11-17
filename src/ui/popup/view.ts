import {
  type FixCounts,
  type HeadingIssue,
  type NotFixedCounts,
  type PageReport,
  totalFixes,
  totalToReview,
} from '@/shared/report';
import { h, uid } from '@/ui/dom';
import { icon, logoMark } from '@/ui/icons';

/**
 * The popup, as a pure function of its state. No browser APIs here: the caller
 * (the real popup, or the design preview) supplies the state and the handlers.
 * Status is shown as text, never spoken by VisioFix.
 */

export type PopupView =
  /** Normal page. repairsOn=false means the user turned repairs off for this site. */
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

const FIX_LABELS: Record<keyof FixCounts, string> = {
  linkNames: 'Links given a name',
  fieldLabels: 'Form fields connected to their label',
  imageDescriptions: 'Images given a description',
  decorativeImages: 'Tracking images hidden',
  hiddenDuplicates: 'Duplicate links out of Tab order',
};

const NOT_FIXED_LABELS: Record<keyof NotFixedCounts, string> = {
  unnamedControls: 'Buttons or fields with no name',
  imagesNeedDescription: 'Images that need a description',
  invalidRoles: 'Invalid ARIA roles',
  brokenReferences: 'Labels pointing to missing elements',
  hiddenFocusable: 'Focusable items hidden from screen readers',
};

export function renderPopup(root: HTMLElement, model: PopupModel, handlers: PopupHandlers): void {
  const { view } = model;
  const main = h('main', { class: 'popup-main' });

  if (view.kind === 'ready') {
    main.append(siteCard(view.host, view.repairsOn, handlers), actions(model, handlers));
    if (!view.repairsOn) {
      main.append(
        messageCard(
          'power',
          `Repairs are off for ${view.host}`,
          'The page is exactly as the site made it. Focus Mode still works.',
        ),
      );
    } else if (view.report) {
      main.append(fixesCard(view.report.fixes), pageCheck(view.report));
    }
  } else if (view.kind === 'off-everywhere') {
    main.append(
      messageCard(
        'power',
        'Repairs are off everywhere',
        'VisioFix isn’t changing any pages. Focus Mode still works.',
        h('button', { type: 'button', class: 'btn btn-primary', onclick: () => handlers.onTurnOnEverywhere() }, 'Turn repairs on'),
      ),
      actions(model, handlers),
    );
  } else if (view.kind === 'unsupported') {
    main.append(
      messageCard(
        'blocked',
        'VisioFix can’t run on this page',
        'Chrome doesn’t let extensions change its own pages, like settings, new tabs and the Chrome Web Store.',
      ),
    );
  } else {
    main.append(
      messageCard(
        'reload',
        `Reload to start VisioFix on ${view.host}`,
        'This tab was open before VisioFix was installed or updated.',
        h(
          'button',
          { type: 'button', class: 'btn btn-primary', onclick: () => handlers.onReload() },
          icon('reload'),
          'Reload this page',
        ),
      ),
    );
  }

  root.replaceChildren(
    h(
      'header',
      { class: 'popup-header' },
      h('h1', { class: 'logo' }, logoMark(), 'VisioFix'),
      h(
        'button',
        { type: 'button', class: 'btn-link', onclick: () => handlers.onOpenSettings() },
        icon('settings'),
        'Settings',
      ),
    ),
    main,
  );
}

function siteCard(host: string, on: boolean, handlers: PopupHandlers): HTMLElement {
  const labelId = uid('site-label');
  const hostId = uid('site-host');
  const toggle = h(
    'button',
    {
      type: 'button',
      role: 'switch',
      class: 'switch',
      'aria-checked': on ? 'true' : 'false',
      'aria-labelledby': `${labelId} ${hostId}`,
      onclick: () => handlers.onToggleSite(!on),
    },
    h('span', { class: 'switch-track', 'aria-hidden': 'true' }),
    // Visible On/Off so the state never depends on color or knob position alone.
    // aria-hidden because role="switch" already announces on/off.
    h('span', { class: 'switch-state', 'aria-hidden': 'true' }, on ? 'On' : 'Off'),
  );
  return h(
    'section',
    { class: 'card site-card', 'aria-label': 'This site' },
    h(
      'div',
      { class: 'site-text' },
      h('span', { id: labelId, class: 'card-title' }, 'Automatic repairs'),
      h('span', { id: hostId, class: 'site-host muted' }, host),
    ),
    toggle,
  );
}

function actions(model: PopupModel, handlers: PopupHandlers): HTMLElement {
  return h(
    'div',
    { class: 'popup-actions' },
    actionButton('btn-primary', 'book', 'Focus Mode', model.shortcuts.focusMode, handlers.onFocusMode),
    actionButton('btn-secondary', 'speaker', 'Read aloud', model.shortcuts.readAloud, handlers.onReadAloud),
  );
}

function actionButton(
  variant: string,
  iconName: 'book' | 'speaker',
  label: string,
  shortcut: string | null,
  onClick: () => void,
): HTMLElement {
  const hintId = shortcut ? uid('kbd') : null;
  return h(
    'button',
    {
      type: 'button',
      class: `btn btn-large ${variant}`,
      'aria-describedby': hintId,
      'aria-keyshortcuts': shortcut ? shortcut.replace(/\s/g, '') : null,
      onclick: () => onClick(),
    },
    icon(iconName),
    h('span', null, label),
    // aria-hidden keeps the hint out of the button's name ("Focus Mode"); it is
    // still read once, as the description, through aria-describedby.
    shortcut && h('span', { id: hintId, class: 'kbd', 'aria-hidden': 'true' }, shortcut),
  );
}

function fixesCard(fixes: FixCounts): HTMLElement {
  const total = totalFixes(fixes);
  const titleId = uid('fixes-title');
  const rows = (Object.keys(FIX_LABELS) as (keyof FixCounts)[]).filter((key) => fixes[key] > 0);

  return h(
    'section',
    { class: 'card fixes-card', 'aria-labelledby': titleId },
    h(
      'div',
      { class: 'card-head' },
      h('h2', { id: titleId, class: 'card-title' }, 'Fixed on this page'),
      total > 0 && h('span', { class: 'badge badge-accent' }, String(total)),
    ),
    total === 0
      ? h('p', { class: 'card-empty muted' }, 'Nothing needed fixing so far.')
      : h(
          'ul',
          { class: 'count-list', role: 'list' },
          rows.map((key) =>
            h('li', null, h('span', null, FIX_LABELS[key]), h('span', { class: 'count' }, String(fixes[key]))),
          ),
        ),
  );
}

function pageCheck(report: PageReport): HTMLElement {
  const toReview = totalToReview(report);
  const notFixedRows = (Object.keys(NOT_FIXED_LABELS) as (keyof NotFixedCounts)[]).filter(
    (key) => report.notFixed[key] > 0,
  );

  return h(
    'details',
    { class: 'card disclosure page-check' },
    h(
      'summary',
      null,
      h('span', { class: 'card-title' }, 'Page check'),
      h('span', { class: 'badge' }, toReview === 0 ? 'All clear' : `${toReview} to review`),
      icon('chevronDown', 'chevron'),
    ),
    h(
      'div',
      { class: 'page-check-body' },
      h('h3', { class: 'subhead' }, 'Headings'),
      report.headings.length === 0
        ? h('p', { class: 'all-clear' }, icon('check'), 'Headings look good.')
        : h('ul', { class: 'issue-list' }, report.headings.map((issue) => h('li', null, headingText(issue)))),
      h('h3', { class: 'subhead' }, 'Not fixed automatically'),
      notFixedRows.length === 0
        ? h('p', { class: 'all-clear' }, icon('check'), 'Nothing else found.')
        : [
            h(
              'p',
              { class: 'muted small' },
              'VisioFix only changes what it can fix safely. These need the site’s author.',
            ),
            h(
              'ul',
              { class: 'count-list', role: 'list' },
              notFixedRows.map((key) =>
                h(
                  'li',
                  null,
                  h('span', null, NOT_FIXED_LABELS[key]),
                  h('span', { class: 'count' }, String(report.notFixed[key])),
                ),
              ),
            ),
          ],
    ),
  );
}

function headingText(issue: HeadingIssue): string {
  switch (issue.kind) {
    case 'missing-h1':
      return 'No main heading (level 1)';
    case 'skipped-level':
      return `Jumps from level ${issue.from} to level ${issue.to}: “${issue.text}”`;
    case 'empty':
      return `Empty level ${issue.level} heading`;
  }
}

function messageCard(
  iconName: 'power' | 'blocked' | 'reload',
  title: string,
  body: string,
  action?: HTMLElement,
): HTMLElement {
  return h(
    'section',
    { class: 'card message' },
    icon(iconName),
    h('h2', { class: 'message-title' }, title),
    h('p', { class: 'message-body' }, body),
    action,
  );
}
