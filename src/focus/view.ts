import { h, uid, type Child } from '@/ui/dom';
import { icon } from '@/ui/icons';
import { logoMark } from '@/ui/logo';
import {
  type Block,
  type FocusDoc,
  type FocusSettings,
  type Inline,
  readingMinutes,
  SPEEDS,
  TEXT_SIZES,
  THEMES,
} from './model';

/**
 * Focus Mode's reading view: toolbar, progress bar and article, built from a
 * FocusDoc. No browser extension APIs. overlay.ts mounts it inside a <dialog>
 * in a shadow root on the page; the design preview mounts it in a shadow root
 * inside a frame.
 *
 * Toolbar: mark + site name | previous, Play, next | "Aa" panel, Close.
 * The "Aa" button is a disclosure for text size, theme and speed. Changes
 * apply to the view immediately and are reported through onSettingsChange.
 */

export interface FocusHandlers {
  onClose(): void;
  onPlayPause(): void;
  onPrevious(): void;
  onNext(): void;
  /** Called after the view has already applied the change. */
  onSettingsChange(settings: FocusSettings): void;
}

export interface FocusView {
  root: HTMLElement;
  article: HTMLElement;
  scroller: HTMLElement;
  setPlaying(playing: boolean): void;
  setSettings(settings: FocusSettings): void;
  /** Moves focus to the article title: screen readers start reading there, and arrow keys scroll the article. */
  focusTitle(): void;
  openPanel(): void;
  closePanel(returnFocus: boolean): void;
  destroy(): void;
}

export function renderFocusView(
  doc: FocusDoc,
  initialSettings: FocusSettings,
  initialPlaying: boolean,
  handlers: FocusHandlers,
): FocusView {
  let settings = { ...initialSettings };
  const titleId = uid('vf-title');
  const panelId = uid('vf-panel');

  /* ---- Toolbar ---- */

  const playButton = h('button', {
    type: 'button',
    class: 'vf-play',
    onclick: () => handlers.onPlayPause(),
  });
  const setPlaying = (playing: boolean) => {
    const label = playing ? 'Pause' : 'Play';
    playButton.setAttribute('aria-label', label);
    playButton.title = label;
    playButton.replaceChildren(icon(playing ? 'pause' : 'play', { filled: true }));
    playButton.classList.toggle('is-playing', playing);
  };
  setPlaying(initialPlaying);

  const aaButton = h(
    'button',
    {
      type: 'button',
      class: 'vf-round vf-aa',
      'aria-expanded': 'false',
      'aria-controls': panelId,
      'aria-label': 'Reading settings',
      title: 'Reading settings: text size, theme and speed',
      onclick: () => (panel.hidden ? openPanel() : closePanel(false)),
    },
    h('span', { 'aria-hidden': 'true' }, 'Aa'),
  );

  /* ---- "Aa" panel ---- */

  const sizeId = uid('vf-size');
  const speedId = uid('vf-speed');
  const sizeOut = h('output', { for: sizeId, class: 'vf-value' });
  const speedOut = h('output', { for: speedId, class: 'vf-value' });
  const sizeInput = h('input', {
    id: sizeId,
    type: 'range',
    min: 0,
    max: TEXT_SIZES.length - 1,
    step: 1,
    oninput: () => {
      const px = TEXT_SIZES[Number(sizeInput.value)] ?? settings.textSize;
      update({ ...settings, textSize: px });
    },
  });
  const speedInput = h('input', {
    id: speedId,
    type: 'range',
    min: 0,
    max: SPEEDS.length - 1,
    step: 1,
    oninput: () => {
      const speed = SPEEDS[Number(speedInput.value)] ?? settings.speed;
      update({ ...settings, speed });
    },
  });
  const themeName = uid('vf-theme');
  const themeInputs = THEMES.map((theme) =>
    h('input', {
      type: 'radio',
      name: themeName,
      value: theme.id,
      onchange: () => update({ ...settings, theme: theme.id }),
    }),
  );

  const panel = h(
    'div',
    { id: panelId, class: 'vf-panel', role: 'group', 'aria-label': 'Reading settings', hidden: true },
    h(
      'div',
      { class: 'vf-field' },
      h('div', { class: 'vf-field-head' }, h('label', { for: sizeId }, 'Text size'), sizeOut),
      sizeInput,
    ),
    h(
      'fieldset',
      { class: 'vf-field' },
      h('legend', null, 'Theme'),
      h(
        'div',
        { class: 'vf-themes' },
        THEMES.map((theme, i) =>
          h(
            'label',
            { class: 'vf-theme' },
            themeInputs[i],
            h('span', { class: 'vf-swatch', 'data-swatch': theme.id, 'aria-hidden': 'true' }, 'Aa'),
            h('span', null, theme.label),
          ),
        ),
      ),
    ),
    h(
      'div',
      { class: 'vf-field' },
      h('div', { class: 'vf-field-head' }, h('label', { for: speedId }, 'Reading speed'), speedOut),
      speedInput,
    ),
  );

  const settingsWrap = h('div', { class: 'vf-settings' }, aaButton, panel);

  const siteName = doc.siteName ?? '';
  const toolbar = h(
    'div',
    { class: 'vf-toolbar' },
    h(
      'div',
      { class: 'vf-tb-start' },
      logoMark(28, 'vf-mark'),
      siteName && h('span', { class: 'vf-site vf-hide-narrow' }, siteName),
    ),
    h(
      'div',
      { class: 'vf-tb-center', role: 'group', 'aria-label': 'Read aloud' },
      roundButton('skipBack', 'Previous sentence', handlers.onPrevious),
      playButton,
      roundButton('skipForward', 'Next sentence', handlers.onNext),
    ),
    h(
      'div',
      { class: 'vf-tb-end' },
      settingsWrap,
      h(
        'button',
        { type: 'button', class: 'vf-close', title: 'Close Focus Mode (Escape)', onclick: () => handlers.onClose() },
        icon('x'),
        h('span', { class: 'vf-hide-narrow' }, 'Close'),
      ),
    ),
  );

  /* ---- Progress + article ---- */

  const progressFill = h('div', { class: 'vf-progress-fill' });
  const progress = h('div', { class: 'vf-progress', 'aria-hidden': 'true' }, progressFill);

  const minutes = readingMinutes(doc);
  const meta = [doc.siteName, doc.byline, `${minutes} min read`].filter(Boolean).join(' · ');
  // tabindex -1: not a Tab stop, but focus can be put here when Focus Mode opens.
  const title = h('h1', { id: titleId, tabindex: -1 }, doc.title);
  const empty = doc.blocks.length === 0;
  const article = h(
    'article',
    { class: 'vf-article', lang: doc.lang, dir: doc.dir, 'aria-labelledby': titleId },
    h('p', { class: 'vf-meta' }, meta),
    title,
    empty
      ? notice('Focus Mode didn’t find any text to show on this page.')
      : doc.isFallback &&
          notice(
            'This page doesn’t look like an article, so Focus Mode is showing all the main text it found. Some of it may be menus or links.',
          ),
    doc.blocks.map(renderBlock),
    doc.truncated && notice('Focus Mode stopped here because this page is very long.'),
  );
  const scroller = h('div', { class: 'vf-scroll' }, article);
  const root = h('div', { class: 'vf-focus' }, toolbar, progress, scroller);

  /* ---- Behavior ---- */

  function applySettings(next: FocusSettings): void {
    settings = { ...next };
    root.dataset.theme = settings.theme;
    root.style.setProperty('--vf-text-size', `${settings.textSize}px`);
    const sizeIndex = Math.max(0, TEXT_SIZES.indexOf(settings.textSize as (typeof TEXT_SIZES)[number]));
    sizeInput.value = String(sizeIndex);
    sizeInput.setAttribute('aria-valuetext', `${settings.textSize} pixels`);
    sizeOut.textContent = `${settings.textSize} px`;
    const speedIndex = Math.max(0, SPEEDS.indexOf(settings.speed as (typeof SPEEDS)[number]));
    speedInput.value = String(speedIndex);
    speedInput.setAttribute('aria-valuetext', `${settings.speed} times`);
    speedOut.textContent = `${settings.speed}×`;
    themeInputs.forEach((input) => {
      input.checked = input.value === settings.theme;
    });
  }

  function update(next: FocusSettings): void {
    applySettings(next);
    handlers.onSettingsChange({ ...settings });
  }

  function openPanel(): void {
    panel.hidden = false;
    aaButton.setAttribute('aria-expanded', 'true');
  }

  function closePanel(returnFocus: boolean): void {
    if (panel.hidden) return;
    panel.hidden = true;
    aaButton.setAttribute('aria-expanded', 'false');
    if (returnFocus) aaButton.focus();
  }

  // Escape inside the panel closes it and returns to "Aa", and must not also
  // close Focus Mode, so the event stops here.
  const onKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && !panel.hidden) {
      event.preventDefault();
      event.stopPropagation();
      closePanel(true);
    }
  };
  settingsWrap.addEventListener('keydown', onKeydown);

  // Clicking elsewhere, or tabbing out of the panel, closes it.
  const onPointerDown = (event: PointerEvent) => {
    if (!panel.hidden && !settingsWrap.contains(event.target as Node)) closePanel(false);
  };
  root.addEventListener('pointerdown', onPointerDown);
  const onFocusOut = (event: FocusEvent) => {
    const next = event.relatedTarget as Node | null;
    if (next && !settingsWrap.contains(next)) closePanel(false);
  };
  settingsWrap.addEventListener('focusout', onFocusOut);

  // Reading progress: how far through the article the reader has scrolled.
  let frame = 0;
  const onScroll = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const max = scroller.scrollHeight - scroller.clientHeight;
      const ratio = max > 0 ? Math.min(1, scroller.scrollTop / max) : 1;
      progressFill.style.transform = `scaleX(${ratio})`;
    });
  };
  scroller.addEventListener('scroll', onScroll, { passive: true });
  progressFill.style.transform = 'scaleX(0)';

  applySettings(settings);

  return {
    root,
    article,
    scroller,
    setPlaying,
    setSettings: applySettings,
    openPanel,
    closePanel,
    focusTitle: () => title.focus({ preventScroll: true }),
    destroy() {
      settingsWrap.removeEventListener('keydown', onKeydown);
      settingsWrap.removeEventListener('focusout', onFocusOut);
      root.removeEventListener('pointerdown', onPointerDown);
      scroller.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    },
  };
}

function notice(text: string): HTMLElement {
  return h('p', { class: 'vf-notice' }, icon('info'), h('span', null, text));
}

function roundButton(name: 'skipBack' | 'skipForward', label: string, onClick: () => void): HTMLButtonElement {
  return h(
    'button',
    { type: 'button', class: 'vf-round', 'aria-label': label, title: label, onclick: () => onClick() },
    icon(name),
  );
}

function renderBlock(block: Block): HTMLElement {
  switch (block.kind) {
    case 'heading':
      return h(`h${block.level}`, null, renderInlines(block.content));
    case 'paragraph':
      return h('p', null, renderInlines(block.content));
    case 'list':
      return h(
        block.ordered ? 'ol' : 'ul',
        null,
        block.items.map((item) => {
          // A single paragraph renders inline in the <li>, without an extra <p>.
          const only = item.length === 1 ? item[0] : undefined;
          return h('li', null, only?.kind === 'paragraph' ? renderInlines(only.content) : item.map(renderBlock));
        }),
      );
    case 'quote':
      return h('blockquote', null, block.blocks.map(renderBlock));
    case 'code':
      return h('pre', null, h('code', null, block.text));
    case 'figure':
      return h(
        'figure',
        null,
        h('img', { src: block.src, alt: block.alt, loading: 'lazy', decoding: 'async' }),
        block.caption && h('figcaption', null, renderInlines(block.caption)),
      );
  }
}

function renderInlines(inlines: Inline[]): Child[] {
  return inlines.map((inline) => {
    if (typeof inline === 'string') return inline;
    if (inline.kind === 'link') return h('a', { href: inline.href }, renderInlines(inline.children));
    return h(inline.kind, null, renderInlines(inline.children));
  });
}
