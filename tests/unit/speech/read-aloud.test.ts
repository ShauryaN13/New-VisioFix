import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_TEXT_SIZE, type FocusDoc } from '@/focus/model';
import { renderFocusView, renderLoading } from '@/focus/view';
import { formatShortcut } from '@/shared/commands';
import { MESSAGES, ReadAloud } from '@/speech/read-aloud';
import { markSentences } from '@/speech/sentences';
import { FakeSpeech, voice } from './fake-speech';

const PREFS = { voiceId: null, allowOnlineVoices: false, speed: 1 };

const article = (lang: string, blocks: FocusDoc['blocks']): FocusDoc => ({
  title: 'Evening hours',
  siteName: null,
  byline: null,
  lang,
  dir: 'ltr',
  isFallback: false,
  truncated: false,
  blocks,
});

const BLOCKS: FocusDoc['blocks'] = [
  { kind: 'paragraph', content: ['First paragraph. Its second sentence.'] },
  { kind: 'paragraph', content: ['Second paragraph.'] },
];

let cleanup: (() => void) | null = null;
afterEach(() => {
  cleanup?.();
  cleanup = null;
});

function setup(doc = article('en-US', BLOCKS), speech = new FakeSpeech()) {
  let readFrom: HTMLElement | null = null;
  const view = renderFocusView(doc, { theme: 'contrast', textSize: DEFAULT_TEXT_SIZE, speed: 1 }, false, {
    onClose: () => undefined,
    onPlayPause: () => undefined,
    onPrevious: () => undefined,
    onNext: () => undefined,
    onReadFrom: (p) => {
      readFrom = p;
    },
    onSettingsChange: () => undefined,
  });
  document.body.append(view.root);
  const reader = new ReadAloud(view, markSentences(view.article, doc.lang), doc.lang, PREFS, speech);
  cleanup = () => {
    reader.destroy();
    view.root.remove();
  };
  const status = () => view.root.querySelector('[role="status"]')?.textContent || null;
  const playLabel = () => view.root.querySelector('.vf-play')?.getAttribute('aria-label');
  const highlighted = () => [...view.article.querySelectorAll('.vf-sentence.is-current')].map((s) => s.textContent).join('');
  return { view, reader, speech, status, playLabel, highlighted, readFromClicked: () => readFrom };
}

/** Let the voice list promise settle. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('read-aloud in Focus Mode', () => {
  it('starts at the title with a local voice, shows Pause and highlights the sentence', async () => {
    const t = setup();
    t.reader.start();
    await settle();
    expect(t.speech.spoken[0]).toMatchObject({ text: 'Evening hours', voice: t.speech.voices[0] });
    expect(t.playLabel()).toBe('Pause');
    expect(t.highlighted()).toBe('Evening hours');
    expect(t.status()).toBeNull();
  });

  it('asks for Play when Chrome won’t speak yet (no key press or click on the page)', async () => {
    const t = setup();
    t.speech.activation = false;
    t.reader.start();
    await settle();
    expect(t.speech.spoken).toEqual([]);
    expect(t.status()).toBe(MESSAGES.needsActivation);
    expect(t.view.root.ownerDocument.activeElement).toBe(t.view.root.querySelector('.vf-play'));
  });

  it('says when there’s no voice for the page’s language, and reads nothing', async () => {
    const t = setup(article('fr', BLOCKS));
    t.reader.start();
    await settle();
    expect(t.speech.spoken).toEqual([]);
    expect(t.status()).toBe(MESSAGES.noVoiceFor('French', false));
  });

  it('suggests online voices when an online one exists for the language', async () => {
    const speech = new FakeSpeech();
    speech.voices = [voice('Microsoft David', 'en-US'), voice('Google français', 'fr-FR', false)];
    const t = setup(article('fr', BLOCKS), speech);
    t.reader.start();
    await settle();
    expect(t.status()).toBe(MESSAGES.noVoiceFor('French', true));
  });

  it('says when there’s nothing to read', async () => {
    const t = setup({ ...article('en', []), title: '' });
    t.reader.start();
    await settle();
    expect(t.status()).toBe(MESSAGES.nothingToRead);
  });

  it('pauses and resumes the same sentence', async () => {
    const t = setup();
    t.reader.toggle();
    await settle();
    t.speech.finish();
    t.reader.toggle(); // pause
    expect(t.playLabel()).toBe('Play');
    expect(t.highlighted()).toBe('First paragraph.');
    t.reader.toggle(); // resume
    await settle();
    expect(t.speech.texts).toEqual(['Evening hours', 'First paragraph.', 'First paragraph.']);
  });

  it('reads from the paragraph whose “Read from here” was clicked', async () => {
    const t = setup();
    const button = t.view.article.querySelectorAll<HTMLElement>('.vf-play-here')[1];
    button?.click();
    const paragraph = t.readFromClicked();
    expect(paragraph?.textContent).toBe('Second paragraph.');
    t.reader.readFrom(paragraph as HTMLElement);
    await settle();
    expect(t.speech.texts).toEqual(['Second paragraph.']);
  });

  it('stops speaking when Focus Mode closes', async () => {
    const t = setup();
    t.reader.start();
    await settle();
    t.reader.destroy();
    expect(t.speech.queue).toEqual([]);
    expect(t.highlighted()).toBe('');
  });
});

describe('Focus Mode view additions', () => {
  it('shows status messages in a live region that is always there', () => {
    const t = setup();
    const region = t.view.root.querySelector('[role="status"]');
    expect(region?.textContent).toBe('');
    t.view.setStatus('Hello');
    expect(region?.textContent).toBe('Hello');
    t.view.setStatus(null);
    expect(region?.textContent).toBe('');
  });

  it('gives every top-level paragraph a mouse-only “Read from here” button', () => {
    const t = setup();
    const buttons = [...t.view.article.querySelectorAll('.vf-play-here')];
    expect(buttons).toHaveLength(2);
    for (const b of buttons) {
      expect(b.getAttribute('aria-hidden')).toBe('true');
      expect(b.localName).toBe('span'); // not a Tab stop
    }
  });

  it('has a loading view in the chosen theme', () => {
    const loading = renderLoading('dark');
    expect(loading.dataset.theme).toBe('dark');
    expect(loading.querySelector('.vf-loading')?.textContent).toBe('Getting the page ready…');
  });
});

describe('formatShortcut', () => {
  it('shows punctuation keys as their symbols', () => {
    expect(formatShortcut('Alt+Shift+Period')).toBe('Alt+Shift+.');
    expect(formatShortcut('Alt+Shift+Comma')).toBe('Alt+Shift+,');
    expect(formatShortcut('Alt+Shift+K')).toBe('Alt+Shift+K');
  });
});
