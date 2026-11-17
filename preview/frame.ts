/**
 * Renders one screen with sample data, chosen by URL:
 *   frame.html?screen=popup&theme=light&state=ready&page=issues&open=1
 *   frame.html?screen=focus&theme=contrast&variant=reading|panel|fallback
 *   frame.html?screen=options&theme=dark
 * The controls work (switches, Aa panel, theme, text size, play) so you can
 * try them, but nothing is saved and nothing is read aloud.
 */
import '@/ui/fonts.css';
import '@/ui/tokens.css';
import '@/ui/base.css';
import focusCss from '@/focus/focus.css?inline';
import { DEFAULT_TEXT_SIZE, type FocusSettings } from '@/focus/model';
import { renderFocusView } from '@/focus/view';
import { h } from '@/ui/dom';
import { icon } from '@/ui/icons';
import { type OptionsModel, renderOptions } from '@/ui/options/view';
import { type PopupModel, type PopupPage, renderPopup } from '@/ui/popup/view';
import { article, fallbackDoc, optionsModel, popupStates } from './sample-data';

const params = new URLSearchParams(location.search);
const screen = params.get('screen') ?? 'popup';
const theme = params.get('theme') ?? 'light';
const frameId = params.get('id') ?? '';

/** Tells the gallery how tall this screen is, whenever that changes. */
function watchSize(): void {
  let last = 0;
  const report = () => {
    const height = Math.ceil(document.body.getBoundingClientRect().height);
    if (height === last) return;
    last = height;
    parent.postMessage({ type: 'vf-preview-size', id: frameId, height }, '*');
  };
  new ResizeObserver(report).observe(document.body);
  void document.fonts.ready.then(report);
}

async function main(): Promise<void> {
  if (screen === 'popup') {
    document.documentElement.dataset.theme = theme;
    await import('@/ui/popup/popup.css');
    const root = h('div');
    document.body.append(root);
    const fallback = popupStates.ready as PopupModel;
    let model: PopupModel = structuredClone(popupStates[params.get('state') ?? 'ready'] ?? fallback);
    // When the switch is turned back on, show the sample report again.
    const sampleReport = fallback.view.kind === 'ready' ? fallback.view.report : null;
    const draw = (page?: PopupPage) => {
      renderPopup(
        root,
        model,
        {
          onToggleSite: (on) => {
            if (model.view.kind === 'ready') {
              model = { ...model, view: { ...model.view, repairsOn: on, report: on ? sampleReport : null } };
              draw();
            }
          },
          onTurnOnEverywhere: () => undefined,
          onFocusMode: () => undefined,
          onReadAloud: () => undefined,
          onReload: () => undefined,
          onOpenSettings: () => undefined,
        },
        page,
      );
    };
    draw((params.get('page') as PopupPage | null) ?? 'main');
    if (params.get('open') === '1') root.querySelector('details')?.setAttribute('open', '');
    watchSize();
  } else if (screen === 'options') {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.overflow = 'hidden';
    await import('@/ui/options/options.css');
    const root = h('div');
    document.body.append(root);
    let model: OptionsModel = structuredClone(optionsModel);
    const draw = () =>
      renderOptions(root, model, {
        onRepairsOn: (on) => {
          model = { ...model, repairsOn: on };
          draw();
        },
        onTurnSiteBackOn: (host) => {
          model = { ...model, offSites: model.offSites.filter((s) => s !== host) };
          draw();
        },
        onTheme: (t) => {
          model = { ...model, theme: t };
        },
        onTextSize: (px) => {
          model = { ...model, textSize: px };
        },
        onVoice: (id) => {
          model = { ...model, voiceId: id };
        },
        onAllowOnlineVoices: (on) => {
          model = { ...model, allowOnlineVoices: on };
          draw();
        },
        onSpeed: (s) => {
          model = { ...model, speed: s };
        },
        onPlaySample: () => undefined,
        onChangeShortcuts: () => undefined,
      });
    draw();
    watchSize();
  } else {
    renderFocusPreview();
  }
}

function renderFocusPreview(): void {
  const variant = params.get('variant') ?? 'reading';
  const doc = variant === 'fallback' ? fallbackDoc : article;
  Object.assign(document.body.style, { margin: '0', height: '100vh', overflow: 'hidden' });

  // Same isolation as the real Focus Mode: a shadow root with its own styles.
  const host = h('div', { style: 'height: 100vh' });
  document.body.append(host);
  const shadow = host.attachShadow({ mode: 'open' });

  const settings: FocusSettings = {
    theme: (['contrast', 'dark', 'light'].includes(theme) ? theme : 'contrast') as FocusSettings['theme'],
    textSize: Number(params.get('size')) || DEFAULT_TEXT_SIZE,
    speed: 1,
  };
  let playing = variant === 'reading' && settings.theme === 'contrast';

  const view = renderFocusView(doc, settings, playing, {
    onClose: () => undefined,
    onPlayPause: () => {
      playing = !playing;
      view.setPlaying(playing);
    },
    onPrevious: () => undefined,
    onNext: () => undefined,
    onSettingsChange: () => undefined,
  });
  if (variant !== 'fallback') showReadingDemo(view.article);
  shadow.replaceChildren(h('style', null, focusCss), view.root);

  if (variant === 'panel') view.openPanel();
  // Scroll a little so the reading-progress bar shows.
  if (variant === 'reading') requestAnimationFrame(() => (view.scroller.scrollTop = 140));
}

/** Shows what read-aloud looks like: one highlighted sentence and the hover play button. */
function showReadingDemo(articleEl: HTMLElement): void {
  const paragraphs = articleEl.querySelectorAll(':scope > p:not(.vf-meta)');
  wrapSentence(paragraphs[1], '“People told us the building closed right when they finally had time to use it,” he said.');
  const hovered = paragraphs[2];
  if (hovered) {
    hovered.classList.add('is-hover');
    hovered.prepend(h('span', { class: 'vf-play-here', 'aria-hidden': 'true' }, icon('play', { filled: true })));
  }
}

function wrapSentence(container: Element | undefined, sentence: string): void {
  if (!container) return;
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent ?? '';
    const start = text.indexOf(sentence);
    if (start === -1) continue;
    const range = document.createRange();
    range.setStart(node, start);
    range.setEnd(node, start + sentence.length);
    range.surroundContents(h('span', { class: 'vf-sentence is-current' }));
    return;
  }
}

void main();
