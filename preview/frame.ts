/**
 * Renders one screen with sample data, chosen by URL:
 *   frame.html?screen=popup&theme=light&state=ready&open=1
 *   frame.html?screen=focus&theme=contrast&variant=reading|fallback
 *   frame.html?screen=options&theme=dark
 * The controls work (switches, theme, text size, play) so you can try them,
 * but nothing is saved and nothing is read aloud.
 */
import '@/ui/fonts.css';
import '@/ui/tokens.css';
import '@/ui/base.css';
import focusCss from '@/focus/focus.css?inline';
import { DEFAULT_TEXT_SIZE, type FocusSettings, TEXT_SIZES } from '@/focus/model';
import { renderFocusView } from '@/focus/view';
import { h } from '@/ui/dom';
import { icon } from '@/ui/icons';
import { type OptionsModel, renderOptions } from '@/ui/options/view';
import { type PopupModel, renderPopup } from '@/ui/popup/view';
import { article, fallbackDoc, optionsModel, popupStates } from './sample-data';

const params = new URLSearchParams(location.search);
const screen = params.get('screen') ?? 'popup';
const theme = params.get('theme') ?? 'light';
const frameId = params.get('id') ?? '';

function reportSize(): void {
  // The body's own height, not the document's: the document is never shorter than
  // the frame, so it could only ever grow.
  const height = Math.ceil(document.body.getBoundingClientRect().height);
  parent.postMessage({ type: 'vf-preview-size', id: frameId, height }, '*');
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
    const draw = () => {
      renderPopup(root, model, {
        onToggleSite: (on) => {
          if (model.view.kind === 'ready') {
            model = { ...model, view: { ...model.view, repairsOn: on, report: on ? sampleReport : null } };
            draw();
            root.querySelector<HTMLElement>('[role="switch"]')?.focus();
          }
        },
        onTurnOnEverywhere: () => undefined,
        onFocusMode: () => undefined,
        onReadAloud: () => undefined,
        onReload: () => undefined,
        onOpenSettings: () => undefined,
      });
      if (params.get('open') === '1') root.querySelector('details')?.setAttribute('open', '');
      root.querySelector('details')?.addEventListener('toggle', reportSize);
      reportSize();
    };
    draw();
  } else if (screen === 'options') {
    document.documentElement.dataset.theme = theme;
    await import('@/ui/options/options.css');
    const root = h('div');
    document.body.append(root);
    let model: OptionsModel = structuredClone(optionsModel);
    const draw = (focusSelector?: string) => {
      renderOptions(root, model, {
        onRepairsOn: (on) => {
          model = { ...model, repairsOn: on };
          draw('.options-section:nth-of-type(1) [role="switch"]');
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
          draw('.options-section:nth-of-type(3) [role="switch"]');
        },
        onSpeed: (s) => {
          model = { ...model, speed: s };
        },
        onPlaySample: () => undefined,
        onChangeShortcuts: () => undefined,
      });
      if (focusSelector) root.querySelector<HTMLElement>(focusSelector)?.focus();
      reportSize();
    };
    draw();
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

  let settings: FocusSettings = {
    theme: (['contrast', 'dark', 'light'].includes(theme) ? theme : 'contrast') as FocusSettings['theme'],
    textSize: Number(params.get('size')) || DEFAULT_TEXT_SIZE,
    speed: 1,
  };
  let playing = variant === 'reading' && settings.theme === 'contrast';

  const draw = (refocus?: string) => {
    const view = renderFocusView(doc, settings, { playing }, {
      onClose: () => undefined,
      onPlayPause: () => {
        playing = !playing;
        draw('.vf-play');
      },
      onPrevious: () => undefined,
      onNext: () => undefined,
      onSpeed: (speed) => {
        settings = { ...settings, speed };
      },
      onTextSize: (direction) => {
        const i = TEXT_SIZES.indexOf(settings.textSize as (typeof TEXT_SIZES)[number]);
        const next = TEXT_SIZES[Math.min(TEXT_SIZES.length - 1, Math.max(0, i + direction))];
        settings = { ...settings, textSize: next ?? settings.textSize };
        draw(direction < 0 ? '[aria-label="Smaller text"]' : '[aria-label="Larger text"]');
      },
      onTheme: (t) => {
        settings = { ...settings, theme: t };
        draw('select');
      },
    });
    if (variant === 'reading') showReadingDemo(view.article);
    shadow.replaceChildren(h('style', null, focusCss), view.root);
    if (refocus) shadow.querySelector<HTMLElement>(refocus)?.focus();
  };
  draw();
}

/** Shows what read-aloud looks like: one highlighted sentence and the hover play button. */
function showReadingDemo(articleEl: HTMLElement): void {
  const paragraphs = articleEl.querySelectorAll(':scope > p:not(.vf-meta)');
  wrapSentence(paragraphs[1], '“People told us the building closed right when they finally had time to use it,” he said.');
  const hovered = paragraphs[2];
  if (hovered) {
    hovered.classList.add('is-hover');
    hovered.prepend(h('span', { class: 'vf-play-here', 'aria-hidden': 'true' }, icon('play')));
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
