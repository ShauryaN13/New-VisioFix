import { type FocusTheme, SPEEDS, TEXT_SIZES, THEMES } from '@/focus/model';
import { h, uid } from '@/ui/dom';
import { icon, logoMark } from '@/ui/icons';

/**
 * The settings page, as a pure function of its state (no browser APIs).
 * Phase 6 connects it to chrome.storage and the speech engine.
 */

export interface VoiceOption {
  id: string;
  /** Name as the system reports it, e.g. "Microsoft Aria - English (United States)". */
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
  root.replaceChildren(
    h(
      'header',
      { class: 'options-header' },
      h('h1', { class: 'logo' }, logoMark(), h('span', null, 'VisioFix ', h('span', { class: 'muted' }, 'settings'))),
    ),
    h(
      'main',
      { class: 'options-main' },
      repairsSection(model, handlers),
      focusSection(model, handlers),
      readAloudSection(model, handlers),
      shortcutsSection(model, handlers),
      privacySection(),
    ),
  );
}

function section(title: string, ...children: (Node | false | null)[]): HTMLElement {
  const id = uid('section');
  return h('section', { class: 'card options-section', 'aria-labelledby': id }, h('h2', { id }, title), ...children);
}

/** A switch row: name on the left, switch on the right, description below the name. */
function switchRow(label: string, description: string, on: boolean, onChange: (on: boolean) => void): HTMLElement {
  const labelId = uid('label');
  const descId = uid('desc');
  return h(
    'div',
    { class: 'switch-row' },
    h(
      'div',
      { class: 'switch-row-text' },
      h('span', { id: labelId, class: 'field-label' }, label),
      h('p', { id: descId, class: 'muted' }, description),
    ),
    h(
      'button',
      {
        type: 'button',
        role: 'switch',
        class: 'switch',
        'aria-checked': on ? 'true' : 'false',
        'aria-labelledby': labelId,
        'aria-describedby': descId,
        onclick: () => onChange(!on),
      },
      h('span', { class: 'switch-track', 'aria-hidden': 'true' }),
      h('span', { class: 'switch-state', 'aria-hidden': 'true' }, on ? 'On' : 'Off'),
    ),
  );
}

function repairsSection(model: OptionsModel, handlers: OptionsHandlers): HTMLElement {
  const sitesId = uid('sites');
  return section(
    'Automatic repairs',
    switchRow(
      'Repair pages automatically',
      'Adds missing labels and image descriptions on the pages you visit. VisioFix never removes anything, and turning repairs off restores the original page.',
      model.repairsOn,
      handlers.onRepairsOn,
    ),
    h('h3', { id: sitesId, class: 'field-label' }, 'Sites where repairs are off'),
    model.offSites.length === 0
      ? h(
          'p',
          { class: 'muted' },
          'None. To turn repairs off for a site, use the switch in the VisioFix popup while you’re on it.',
        )
      : h(
          'ul',
          { class: 'site-list', role: 'list', 'aria-labelledby': sitesId },
          model.offSites.map((host) =>
            h(
              'li',
              null,
              h('span', { class: 'site-name' }, host),
              h(
                'button',
                { type: 'button', class: 'btn btn-quiet', onclick: () => handlers.onTurnSiteBackOn(host) },
                'Turn back on',
                h('span', { class: 'visually-hidden' }, ` for ${host}`),
              ),
            ),
          ),
        ),
  );
}

function focusSection(model: OptionsModel, handlers: OptionsHandlers): HTMLElement {
  const name = uid('theme');
  const sizeId = uid('size');
  const sizeOutId = uid('size-out');
  const sizeIndex = Math.max(0, TEXT_SIZES.indexOf(model.textSize as (typeof TEXT_SIZES)[number]));

  const sample = h(
    'p',
    { class: 'size-sample', style: `font-size: ${model.textSize}px` },
    'Focus Mode text will look like this.',
  );
  const output = h('output', { id: sizeOutId, for: sizeId, class: 'range-value' }, `${model.textSize} px`);

  return section(
    'Focus Mode',
    h(
      'fieldset',
      { class: 'theme-picker' },
      h('legend', { class: 'field-label' }, 'Default theme'),
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
    h(
      'div',
      { class: 'field' },
      h('div', { class: 'field-head' }, h('label', { for: sizeId, class: 'field-label' }, 'Text size'), output),
      h('input', {
        id: sizeId,
        type: 'range',
        min: 0,
        max: TEXT_SIZES.length - 1,
        step: 1,
        value: sizeIndex,
        'aria-valuetext': `${model.textSize} pixels`,
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
  const speedId = uid('speed');
  const speedOutId = uid('speed-out');
  const local = model.voices.filter((v) => v.local);
  const online = model.voices.filter((v) => !v.local);
  const speedIndex = Math.max(0, SPEEDS.indexOf(model.speed as (typeof SPEEDS)[number]));
  const speedOut = h('output', { id: speedOutId, for: speedId, class: 'range-value' }, `${model.speed}×`);

  return section(
    'Read aloud',
    h(
      'div',
      { class: 'field' },
      h('label', { for: voiceId, class: 'field-label' }, 'Voice'),
      h(
        'select',
        {
          id: voiceId,
          class: 'select',
          onchange: (event: Event) => {
            const value = (event.target as HTMLSelectElement).value;
            handlers.onVoice(value === '' ? null : value);
          },
        },
        h('option', { value: '', selected: model.voiceId === null }, 'Automatic (matches the page’s language)'),
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
      'Allow online voices',
      'Online voices can sound more natural, but the text being read is sent over the internet to the company that runs the voice (such as Google or Microsoft). Off unless you turn it on.',
      model.allowOnlineVoices,
      handlers.onAllowOnlineVoices,
    ),
    h(
      'div',
      { class: 'field' },
      h('div', { class: 'field-head' }, h('label', { for: speedId, class: 'field-label' }, 'Speed'), speedOut),
      h('input', {
        id: speedId,
        type: 'range',
        min: 0,
        max: SPEEDS.length - 1,
        step: 1,
        value: speedIndex,
        'aria-valuetext': `${model.speed} times`,
        oninput: (event: Event) => {
          const input = event.target as HTMLInputElement;
          const speed = SPEEDS[Number(input.value)] ?? model.speed;
          input.setAttribute('aria-valuetext', `${speed} times`);
          speedOut.textContent = `${speed}×`;
          handlers.onSpeed(speed);
        },
      }),
    ),
    h(
      'button',
      { type: 'button', class: 'btn btn-secondary', onclick: () => handlers.onPlaySample() },
      icon('play'),
      'Play a sample',
    ),
  );
}

function shortcutsSection(model: OptionsModel, handlers: OptionsHandlers): HTMLElement {
  return section(
    'Keyboard shortcuts',
    h(
      'table',
      { class: 'shortcut-table' },
      h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Action'), h('th', { scope: 'col' }, 'Shortcut'))),
      h(
        'tbody',
        null,
        model.shortcuts.map((row) =>
          h(
            'tr',
            null,
            h('td', null, row.action),
            h('td', null, row.shortcut ? h('span', { class: 'kbd' }, row.shortcut) : h('span', { class: 'muted' }, 'Not set')),
          ),
        ),
        h('tr', null, h('td', null, 'Close Focus Mode'), h('td', null, h('span', { class: 'kbd' }, 'Escape'))),
      ),
    ),
    h(
      'button',
      { type: 'button', class: 'btn btn-quiet', onclick: () => handlers.onChangeShortcuts() },
      'Change shortcuts',
      icon('arrowRight'),
    ),
  );
}

function privacySection(): HTMLElement {
  return section(
    'Privacy',
    h(
      'p',
      null,
      'VisioFix works entirely on your computer. It doesn’t collect, store or send anything about you or the pages you visit. Your settings are saved only in this browser.',
    ),
  );
}
