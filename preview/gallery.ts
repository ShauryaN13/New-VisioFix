import '@/ui/fonts.css';
import '@/ui/tokens.css';
import '@/ui/base.css';
import './gallery.css';
import { h } from '@/ui/dom';

/** Builds the gallery of frames. Each frame reports its height so popups show at full length. */

interface FrameSpec {
  label: string;
  query: string;
  width: number | '100%';
  /** Fixed height for full-screen views (Focus Mode); others size to content. */
  height?: number;
}

let frameCount = 0;
function frame(spec: FrameSpec): HTMLElement {
  frameCount += 1;
  const id = `f${frameCount}`;
  const iframe = h('iframe', {
    src: `frame.html?${spec.query}&id=${id}`,
    title: spec.label,
    'data-frame-id': id,
    'data-fixed': spec.height ? 'true' : null,
    scrolling: spec.height ? null : 'no',
    style: `width:${spec.width === '100%' ? '100%' : `${spec.width}px`};height:${spec.height ?? 200}px`,
  });
  return h('figure', { class: 'shot' }, iframe, h('figcaption', null, spec.label));
}

function section(id: string, title: string, intro: string, ...content: HTMLElement[]): HTMLElement {
  return h(
    'section',
    { id, class: 'gallery-section', 'aria-labelledby': `${id}-title` },
    h('h2', { id: `${id}-title` }, title),
    h('p', { class: 'muted' }, intro),
    ...content,
  );
}

/** The icon on Chrome's light and dark toolbar colors, at every size it ships in. */
function iconStrip(bg: string, fg: string, label: string): HTMLElement {
  return h(
    'div',
    { class: 'icon-strip', style: `background:${bg};color:${fg}` },
    h('span', { class: 'icon-strip-label' }, label),
    ...[16, 32, 48, 128].map((size) =>
      h(
        'span',
        { class: 'icon-cell' },
        h('img', { src: `/icon/${size}.png`, width: size, height: size, alt: '' }),
        h('span', null, `${size}`),
      ),
    ),
    h(
      'span',
      { class: 'icon-cell' },
      h('img', { src: '/icon/16.png', width: 64, height: 64, class: 'pixelated', alt: '' }),
      h('span', null, '16 at 4×'),
    ),
  );
}

const gallery = document.getElementById('gallery') as HTMLElement;
gallery.append(
  section(
    'icon',
    'Icon',
    'The code eye: an eye whose corners are HTML angle brackets, with a yellow pupil, on the deep navy tile. 16 and 32px use a simplified drawing without eyelids, so it reads as “< • >”.',
    h('div', { class: 'icon-strips' }, iconStrip('#f1f3f4', '#3c4043', 'Light toolbar'), iconStrip('#35363a', '#e8eaed', 'Dark toolbar')),
  ),
  section(
    'popup',
    'Popup',
    'Light and dark follow the system setting. Status first, two actions, one number. “See what changed” starts collapsed (shown open in the third frame).',
    h(
      'div',
      { class: 'row' },
      frame({ label: 'Popup, light', query: 'screen=popup&theme=light&state=ready', width: 360 }),
      frame({ label: 'Popup, dark', query: 'screen=popup&theme=dark&state=ready', width: 360 }),
      frame({ label: '“See what changed” open', query: 'screen=popup&theme=light&state=ready&open=1', width: 360 }),
      frame({ label: 'Can’t-fix details, light', query: 'screen=popup&theme=light&state=ready&page=issues', width: 360 }),
      frame({ label: 'Can’t-fix details, dark', query: 'screen=popup&theme=dark&state=ready&page=issues', width: 360 }),
    ),
  ),
  section(
    'popup-states',
    'Popup states',
    'Nothing to fix, repairs paused, and pages VisioFix can’t reach. Every main view fits in Chrome’s 600px popup without scrolling.',
    h(
      'div',
      { class: 'row' },
      frame({ label: 'Nothing needed fixing', query: 'screen=popup&theme=light&state=clean', width: 360 }),
      frame({ label: 'Paused on this site', query: 'screen=popup&theme=dark&state=site-off', width: 360 }),
      frame({ label: 'Paused everywhere', query: 'screen=popup&theme=light&state=off-everywhere', width: 360 }),
      frame({ label: 'Can’t run on this page', query: 'screen=popup&theme=dark&state=unsupported', width: 360 }),
      frame({ label: 'Tab needs a reload', query: 'screen=popup&theme=light&state=needs-reload', width: 360 }),
    ),
  ),
  section(
    'focus',
    'Focus Mode',
    'Full-screen reading view over the page. High contrast is the default. The first frame shows read-aloud playing: the highlighted sentence, the reading-progress bar, and the “read from here” button that appears when you point at a paragraph. Try the Aa button: Escape closes its panel and returns to it.',
    frame({ label: 'High contrast, reading', query: 'screen=focus&theme=contrast&variant=reading', width: '100%', height: 720 }),
    frame({ label: 'Dark, Aa panel open', query: 'screen=focus&theme=dark&variant=panel', width: '100%', height: 720 }),
    frame({ label: 'Light', query: 'screen=focus&theme=light&variant=reading', width: '100%', height: 720 }),
    h(
      'div',
      { class: 'row' },
      frame({ label: 'Not an article: fallback notice (dark)', query: 'screen=focus&theme=dark&variant=fallback', width: 640, height: 560 }),
      frame({ label: 'Narrow window, Aa panel open (high contrast)', query: 'screen=focus&theme=contrast&variant=panel', width: 380, height: 640 }),
    ),
  ),
  section(
    'settings',
    'Settings',
    'Section titles outside the cards, helper text under every control.',
    frame({ label: 'Settings, light', query: 'screen=options&theme=light', width: '100%' }),
    frame({ label: 'Settings, dark', query: 'screen=options&theme=dark', width: '100%' }),
  ),
);

window.addEventListener('message', (event: MessageEvent) => {
  const data = event.data as { type?: string; id?: string; height?: number };
  if (data?.type !== 'vf-preview-size' || !data.id || !data.height) return;
  const iframe = document.querySelector<HTMLIFrameElement>(`iframe[data-frame-id="${data.id}"]`);
  if (iframe && !iframe.dataset.fixed) iframe.style.height = `${data.height}px`;
});
