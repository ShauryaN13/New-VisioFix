import { type FocusTheme, SPEEDS, TEXT_SIZES, THEMES } from '@/focus/model';
import { h, uid } from '@/ui/dom';
import { icon } from '@/ui/icons';
import { logoMark } from '@/ui/logo';

/**
 * The settings page, as a function of its state (no browser APIs).
 * Phase 6 connects it to chrome.storage and the speech engine.
 * Layout follows Chrome's own settings: section titles outside the cards,
 * one card per section, short helper text under every control.
 */

export interface VoiceOption {
  id: string;
  /** Name as the system reports it, e.g. "Microsoft Zira - English (United States)". */
  name: string;
  lang: string;
  /** false = online voice: the text is sent to the voice's provider. */
  local: boolean;
}

export interface OptionsModel {
  repairsOn: boolean;
  offSites: string[];
  theme: FocusTheme;
  textSize: number;
  voices: VoiceOption[];
  /** null = automatic: a voice on this computer that matches the page's language. */
  voiceId: string | null;
  allowOnlineVoices: boolean;
  speed: number;
  shortcuts: { action: string; shortcut: string | null }[];
}

export interface OptionsHandlers {
  onRepairsOn(on: boolean): void;
  onTurnSiteBackOn(host: string): void;
  onTheme(theme: FocusTheme): void;
  onTextSize(px: number): void;
  onVoice(id: string | null): void;
  onAllowOnlineVoices(on: boolean): void;
  onSpeed(speed: number): void;
  onPlaySample(): void;
  onChangeShortcuts(): void;
}

/** Colors for the theme previews (match src/focus/focus.css). */
const THEME_SWATCHES: Record<FocusTheme, { bg: string; heading: string; text: string; link: string }> = {
  contrast: { bg: '#000000', heading: '#FFFF00', text: '#FFFFFF', link: '#00FFFF' },
  dark: { bg: '#15171B', heading: '#FFFFFF', text: '#E9EBEF', link: '#9CC2FF' },
  light: { bg: '#FBF8F1', heading: '#121110', text: '#1D1C1A', link: '#0B4AA8' },
};

export function renderOptions(root: HTMLElement, model: OptionsModel, handlers: OptionsHandlers): void {
  // Keep keyboard focus on the same control after re-rendering.
  const focusKey = (document.activeElement as HTMLElement | null)?.dataset?.focusKey;

  root.replaceChildren(
    h(
      'div',
      { class: 'settings' },
      h('header', { class: 'settings-header' }, h('h1', { class: 'brand settings-title' }, logoMark(40), 'VisioFix settings')),
      h(
        'main',
        { class: 'settings-main' },
        repairsSection(model, handlers),
        focusSection(model, handlers),
        readAloudSection(model, handlers),
        shortcutsSection(model, handlers),
        aboutSection(),
      ),
    ),
  );
  if (focusKey) root.querySelector<HTMLElement>(`[data-focus-key="${focusKey}"]`)?.focus();
}

function section(title: string, ...rows: (Node | false | null)[]): HTMLElement {
  const id = uid('section');
  return h(
    'section',
    { class: 'settings-section', 'aria-labelledby': id },
    h('h2', { id, class: 'section-title' }, title),
    h('div', { class: 'card settings-card' }, ...rows),
  );
}

/** Label + helper text on the left, switch on the right. */
function switchRow(
  key: string,
  label: string,
  helper: string,
  on: boolean,
  onChange: (on: boolean) => void,
): HTMLElement {
  const labelId = uid('label');
  const helpId = uid('help');
  return h(
    'div',
    { class: 'row row-inline' },
    h(
      'div',
      { class: 'row-text' },
      h('span', { id: labelId, class: 'row-label' }, label),
      h('p', { id: helpId, class: 'row-help' }, helper),
    ),
    h(
      'button',
      {
        type: 'button',
        role: 'switch',
        class: 'switch',
        'aria-checked': on ? 'true' : 'false',
        'aria-labelledby': labelId,
        'aria-describedby': helpId,
        'data-focus-key': key,
        onclick: () => onChange(!on),
      },
      h('span', { class: 'switch-track', 'aria-hidden': 'true' }),
      h('span', { class: 'switch-state', 'aria-hidden': 'true' }, on ? 'On' : 'Off'),
    ),
  );
}

/** Label (+ optional live value) and helper text above a control. */
function stackedRow(
  label: HTMLElement,
  helper: string,
  helpId: string,
  value: HTMLElement | null,
  ...controls: (Node | false | null)[]
): HTMLElement {
  return h(
    'div',
    { class: 'row' },
    h('div', { class: 'row-head' }, label, value),
    h('p', { id: helpId, class: 'row-help' }, helper),
    ...controls,
  );
}

function repairsSection(model: OptionsModel, handlers: OptionsHandlers): HTMLElement {
  const listLabel = uid('sites');
  return section(
    'Automatic repairs',
    switchRow(
      'repairs',
      'Repair pages automatically',
      'Adds missing labels and image descriptions on the pages you visit. VisioFix never removes anything, and turning this off restores every page.',
      model.repairsOn,
      handlers.onRepairsOn,
    ),
    h(
      'div',
      { class: 'row' },
      h('h3', { id: listLabel, class: 'row-label' }, 'Sites where repairs are paused'),
      h(
        'p',
        { class: 'row-help' },
        model.offSites.length === 0
          ? 'None. To pause repairs on a site, use the switch in the VisioFix popup while you’re on it.'
          : 'Pages on these sites are left exactly as the site made them. Focus Mode still works there.',
      ),
      model.offSites.length > 0 &&
        h(
          'ul',
          { class: 'site-list', role: 'list', 'aria-labelledby': listLabel },
          model.offSites.map((host) =>
            h(
              'li',
              null,
              h('span', { class: 'site-name' }, host),
              h(
                'button',
                {
                  type: 'button',
                  class: 'btn btn-outline btn-small',
                  'data-focus-key': `site-${host}`,
                  onclick: () => handlers.onTurnSiteBackOn(host),
                },
                'Turn back on',
                h('span', { class: 'visually-hidden' }, ` for ${host}`),
              ),
            ),
          ),
        ),
    ),
  );
}

function focusSection(model: OptionsModel, handlers: OptionsHandlers): HTMLElement {
  const name = uid('theme');
  const themeHelp = uid('help');
  const sizeId = uid('size');
  const sizeHelp = uid('help');
  const sizeIndex = Math.max(0, TEXT_SIZES.indexOf(model.textSize as (typeof TEXT_SIZES)[number]));
  const sample = h('p', { class: 'size-sample', style: `font-size: ${model.textSize}px` }, 'Focus Mode text will look like this.');
  const output = h('output', { for: sizeId, class: 'row-value' }, `${model.textSize} px`);

  return section(
    'Focus Mode',
    h(
      'fieldset',
      { class: 'row theme-picker', 'aria-describedby': themeHelp },
      h('legend', { class: 'row-label' }, 'Theme'),
      h('p', { id: themeHelp, class: 'row-help' }, 'The colors Focus Mode opens with. You can switch while reading.'),
      h(
        'div',
        { class: 'theme-options' },
        THEMES.map((theme) => {
          const swatch = THEME_SWATCHES[theme.id];
          return h(
            'label',
            { class: 'theme-option' },
            h(
              'span',
              { class: 'theme-swatch', 'aria-hidden': 'true', style: `background:${swatch.bg}` },
              h('span', { style: `color:${swatch.heading}` }, 'Aa'),
              h('span', { class: 'swatch-line', style: `background:${swatch.text}` }),
              h('span', { class: 'swatch-line short', style: `background:${swatch.link}` }),
            ),
            h(
              'span',
              { class: 'theme-choice' },
              h('input', {
                type: 'radio',
                name,
                value: theme.id,
                checked: theme.id === model.theme,
                onchange: () => handlers.onTheme(theme.id),
              }),
              h('span', null, theme.label),
            ),
          );
        }),
      ),
    ),
    stackedRow(
      h('label', { for: sizeId, class: 'row-label' }, 'Text size'),
      'How large Focus Mode text starts out.',
      sizeHelp,
      output,
      h('input', {
        id: sizeId,
        type: 'range',
        min: 0,
        max: TEXT_SIZES.length - 1,
        step: 1,
        value: sizeIndex,
        'aria-valuetext': `${model.textSize} pixels`,
        'aria-describedby': sizeHelp,
        oninput: (event: Event) => {
          const input = event.target as HTMLInputElement;
          const px = TEXT_SIZES[Number(input.value)] ?? model.textSize;
          input.setAttribute('aria-valuetext', `${px} pixels`);
          output.textContent = `${px} px`;
          sample.style.fontSize = `${px}px`;
          handlers.onTextSize(px);
        },
      }),
      sample,
    ),
  );
}

function readAloudSection(model: OptionsModel, handlers: OptionsHandlers): HTMLElement {
  const voiceId = uid('voice');
  const voiceHelp = uid('help');
  const speedId = uid('speed');
  const speedHelp = uid('help');
  const local = model.voices.filter((v) => v.local);
  const online = model.voices.filter((v) => !v.local);
  const speedIndex = Math.max(0, SPEEDS.indexOf(model.speed as (typeof SPEEDS)[number]));
  const speedOut = h('output', { for: speedId, class: 'row-value' }, `${model.speed}×`);

  return section(
    'Read aloud',
    stackedRow(
      h('label', { for: voiceId, class: 'row-label' }, 'Voice'),
      'Automatic picks a voice on this computer that matches the page’s language.',
      voiceHelp,
      null,
      h(
        'select',
        {
          id: voiceId,
          class: 'select',
          'aria-describedby': voiceHelp,
          onchange: (event: Event) => {
            const value = (event.target as HTMLSelectElement).value;
            handlers.onVoice(value === '' ? null : value);
          },
        },
        h('option', { value: '', selected: model.voiceId === null }, 'Automatic'),
        h(
          'optgroup',
          { label: 'On this computer' },
          local.map((v) => h('option', { value: v.id, selected: v.id === model.voiceId }, v.name)),
        ),
        model.allowOnlineVoices &&
          online.length > 0 &&
          h(
            'optgroup',
            { label: 'Online (text is sent to the provider)' },
            online.map((v) => h('option', { value: v.id, selected: v.id === model.voiceId }, v.name)),
          ),
      ),
    ),
    switchRow(
      'online-voices',
      'Allow online voices',
      'Online voices can sound more natural, but the text being read is sent over the internet to the company that runs the voice, such as Google or Microsoft.',
      model.allowOnlineVoices,
      handlers.onAllowOnlineVoices,
    ),
    stackedRow(
      h('label', { for: speedId, class: 'row-label' }, 'Speed'),
      'How fast read-aloud speaks. 1× is the voice’s normal pace.',
      speedHelp,
      speedOut,
      h('input', {
        id: speedId,
        type: 'range',
        min: 0,
        max: SPEEDS.length - 1,
        step: 1,
        value: speedIndex,
        'aria-valuetext': `${model.speed} times`,
        'aria-describedby': speedHelp,
        oninput: (event: Event) => {
          const input = event.target as HTMLInputElement;
          const speed = SPEEDS[Number(input.value)] ?? model.speed;
          input.setAttribute('aria-valuetext', `${speed} times`);
          speedOut.textContent = `${speed}×`;
          handlers.onSpeed(speed);
        },
      }),
      h(
        'button',
        { type: 'button', class: 'btn btn-tonal row-action', onclick: () => handlers.onPlaySample() },
        icon('play'),
        'Play a sample',
      ),
    ),
  );
}

function shortcutsSection(model: OptionsModel, handlers: OptionsHandlers): HTMLElement {
  const helpId = uid('help');
  return section(
    'Keyboard shortcuts',
    h(
      'div',
      { class: 'row' },
      h(
        'table',
        { class: 'shortcut-table', 'aria-describedby': helpId },
        h(
          'thead',
          { class: 'visually-hidden' },
          h('tr', null, h('th', { scope: 'col' }, 'Action'), h('th', { scope: 'col' }, 'Shortcut')),
        ),
        h(
          'tbody',
          null,
          model.shortcuts.map((row) =>
            h(
              'tr',
              null,
              h('td', null, row.action),
              h('td', null, row.shortcut ? h('kbd', { class: 'kbd' }, row.shortcut) : h('span', { class: 'muted' }, 'Not set')),
            ),
          ),
          h('tr', null, h('td', null, 'Close Focus Mode'), h('td', null, h('kbd', { class: 'kbd' }, 'Escape'))),
        ),
      ),
      h('p', { id: helpId, class: 'row-help' }, 'Chrome lets you change these on its keyboard shortcuts page.'),
      h(
        'button',
        { type: 'button', class: 'btn btn-outline row-action', onclick: () => handlers.onChangeShortcuts() },
        'Change shortcuts',
        icon('externalLink'),
      ),
    ),
  );
}

function aboutSection(): HTMLElement {
  return section(
    'Privacy',
    h(
      'div',
      { class: 'row' },
      h(
        'p',
        { class: 'about-text' },
        'VisioFix works entirely on your computer. It doesn’t collect, store or send anything about you or the pages you visit. Your settings are saved only in this browser.',
      ),
      h(
        'p',
        { class: 'row-help' },
        'Font: Atkinson Hyperlegible Next by the Braille Institute (SIL Open Font License). Icons: Lucide (ISC License).',
      ),
    ),
  );
}
