import { h, uid, type Child } from '@/ui/dom';
import { icon, logoMark } from '@/ui/icons';
import { type Block, type FocusDoc, type FocusSettings, type Inline, SPEEDS, THEMES } from './model';

/**
 * Focus Mode's reading view: toolbar + article, rendered from a FocusDoc.
 * Pure DOM building, no browser extension APIs. Phase 4 mounts this inside a
 * <dialog> in a shadow root on the page; the design preview mounts it in a
 * shadow root inside a frame.
 */

export interface FocusUiState {
  playing: boolean;
}

export interface FocusHandlers {
  onClose(): void;
  onPlayPause(): void;
  onPrevious(): void;
  onNext(): void;
  onSpeed(speed: number): void;
  onTextSize(direction: -1 | 1): void;
  onTheme(theme: FocusSettings['theme']): void;
}

export interface FocusViewRefs {
  root: HTMLElement;
  article: HTMLElement;
  scroller: HTMLElement;
  playButton: HTMLButtonElement;
}

export function renderFocusView(
  doc: FocusDoc,
  settings: FocusSettings,
  ui: FocusUiState,
  handlers: FocusHandlers,
): FocusViewRefs {
  const titleId = uid('vf-title');
  const playButton = h(
    'button',
    { type: 'button', class: 'vf-btn vf-btn-primary vf-play', onclick: () => handlers.onPlayPause() },
    icon(ui.playing ? 'pause' : 'play'),
    h('span', null, ui.playing ? 'Pause' : 'Play'),
  );

  const toolbar = h(
    'div',
    { class: 'vf-toolbar' },
    h('div', { class: 'vf-brand' }, logoMark('vf-logo'), h('span', { class: 'vf-hide-narrow' }, 'Focus Mode')),
    h(
      'div',
      { class: 'vf-group', role: 'group', 'aria-label': 'Read aloud' },
      iconButton('previous', 'Previous sentence', handlers.onPrevious),
      playButton,
      iconButton('next', 'Next sentence', handlers.onNext),
      selectControl(
        'Speed',
        SPEEDS.map((s) => ({ value: String(s), label: `${s}×` })),
        String(settings.speed),
        (value) => handlers.onSpeed(Number(value)),
      ),
    ),
    h(
      'div',
      { class: 'vf-group', role: 'group', 'aria-label': 'Display' },
      iconButton('textSmaller', 'Smaller text', () => handlers.onTextSize(-1)),
      iconButton('textLarger', 'Larger text', () => handlers.onTextSize(1)),
      selectControl(
        'Theme',
        THEMES.map((t) => ({ value: t.id, label: t.label })),
        settings.theme,
        (value) => handlers.onTheme(value as FocusSettings['theme']),
      ),
    ),
    h(
      'button',
      { type: 'button', class: 'vf-btn vf-close', onclick: () => handlers.onClose() },
      icon('close'),
      h('span', { class: 'vf-hide-narrow' }, 'Close'),
    ),
  );

  const meta = [doc.siteName, doc.byline].filter(Boolean).join(' · ');
  const article = h(
    'article',
    { class: 'vf-article', lang: doc.lang, dir: doc.dir, 'aria-labelledby': titleId },
    meta && h('p', { class: 'vf-meta' }, meta),
    h('h1', { id: titleId }, doc.title),
    doc.isFallback &&
      h(
        'p',
        { class: 'vf-notice' },
        icon('info'),
        h(
          'span',
          null,
          'This page doesn’t look like an article, so Focus Mode is showing all the main text it found. Some of it may be menus or links.',
        ),
      ),
    doc.blocks.map(renderBlock),
  );

  const scroller = h('div', { class: 'vf-scroll' }, article);
  const root = h(
    'div',
    {
      class: 'vf-focus',
      'data-theme': settings.theme,
      style: `--vf-text-size: ${settings.textSize}px`,
    },
    toolbar,
    scroller,
  );

  return { root, article, scroller, playButton };
}

function iconButton(name: Parameters<typeof icon>[0], label: string, onClick: () => void): HTMLButtonElement {
  // aria-label is the name; title shows the same words as a tooltip for mouse users.
  return h(
    'button',
    { type: 'button', class: 'vf-btn vf-icon-btn', 'aria-label': label, title: label, onclick: () => onClick() },
    icon(name),
  );
}

function selectControl(
  label: string,
  options: { value: string; label: string }[],
  selected: string,
  onChange: (value: string) => void,
): HTMLElement {
  const id = uid('vf-select');
  return h(
    'span',
    { class: 'vf-select' },
    h('label', { for: id, class: 'vf-hide-narrow' }, label),
    h(
      'select',
      { id, onchange: (event: Event) => onChange((event.target as HTMLSelectElement).value) },
      options.map((o) => h('option', { value: o.value, selected: o.value === selected }, o.label)),
    ),
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
