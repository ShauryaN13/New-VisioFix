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
    style: `width:${spec.width === '100%' ? '100%' : `${spec.width}px`};height:${spec.height ?? 300}px`,
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

/** A strip of icons on a toolbar-colored background (Chrome's light and dark toolbars). */
function iconRow(bg: string, fg: string, label: string): HTMLElement {
  const cell = (src: string, size: number, caption: string, extra?: string) =>
    h(
      'span',
      { class: 'icon-cell', style: `color:${fg}` },
      h('img', { src, width: size, height: size, class: extra, alt: '' }),
      h('span', null, caption),
    );
  return h(
    'div',
    { class: 'icon-row', style: `background:${bg}` },
    h('span', { class: 'icon-row-label', style: `color:${fg}` }, label),
    ...[16, 32, 48, 128].map((size) => cell(`/icon/${size}.png`, size, `${size}px`)),
    cell('/icon/16.png', 64, '16px at 4×', 'pixelated'),
  );
}

const gallery = document.getElementById('gallery') as HTMLElement;
gallery.append(
  section(
    'icon',
    'Icon',
    'A yellow eye on a near-black tile, the original app’s high-contrast signature, with a check mark in the iris. 16px and 32px use a simplified drawing without the check, so it stays crisp in the toolbar.',
    iconRow('#f1f3f4', '#202124', 'Light toolbar'),
    iconRow('#202124', '#e8eaed', 'Dark toolbar'),
  ),
  section(
    'popup',
    'Popup',
    'Light and dark follow the system setting. Page check is shown expanded here; it starts collapsed.',
    h(
      'div',
      { class: 'row' },
      frame({ label: 'Popup, light', query: 'screen=popup&theme=light&state=ready&open=1', width: 360 }),
      frame({ label: 'Popup, dark', query: 'screen=popup&theme=dark&state=ready&open=1', width: 360 }),
      frame({ label: 'Popup, dark, page check collapsed', query: 'screen=popup&theme=dark&state=ready', width: 360 }),
    ),
  ),
  section(
    'popup-states',
    'Popup states',
    'What the popup shows when there’s nothing to fix, when repairs are off, and on pages VisioFix can’t reach.',
    h(
      'div',
      { class: 'row' },
      frame({ label: 'Nothing needed fixing', query: 'screen=popup&theme=light&state=clean&open=1', width: 360 }),
      frame({ label: 'Repairs off for this site', query: 'screen=popup&theme=light&state=site-off', width: 360 }),
      frame({ label: 'Repairs off everywhere', query: 'screen=popup&theme=dark&state=off-everywhere', width: 360 }),
      frame({ label: 'Can’t run on this page', query: 'screen=popup&theme=light&state=unsupported', width: 360 }),
      frame({ label: 'Tab needs a reload', query: 'screen=popup&theme=dark&state=needs-reload', width: 360 }),
    ),
  ),
  section(
    'focus',
    'Focus Mode',
    'Full-screen reading view over the page. High contrast is the default. The first frame shows read-aloud playing: the highlighted sentence, and the “read from here” button that appears when you point at a paragraph.',
    frame({ label: 'Focus Mode, high contrast, reading', query: 'screen=focus&theme=contrast&variant=reading', width: '100%', height: 760 }),
    frame({ label: 'Focus Mode, dark', query: 'screen=focus&theme=dark&variant=reading', width: '100%', height: 760 }),
    frame({ label: 'Focus Mode, light', query: 'screen=focus&theme=light&variant=reading', width: '100%', height: 760 }),
    h(
      'div',
      { class: 'row' },
      frame({ label: 'Not an article: fallback notice (dark)', query: 'screen=focus&theme=dark&variant=fallback', width: 640, height: 620 }),
      frame({ label: 'Narrow window (high contrast)', query: 'screen=focus&theme=contrast&variant=reading', width: 420, height: 620 }),
    ),
  ),
  section(
    'settings',
    'Settings',
    'The settings page, light and dark.',
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
