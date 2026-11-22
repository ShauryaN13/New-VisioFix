import '@/ui/fonts.css';
import '@/ui/tokens.css';
import '@/ui/base.css';
import '@/ui/options/options.css';
import { getShortcuts } from '@/shared/commands';
import {
  type FocusPrefs,
  focusPrefsItem,
  offSitesItem,
  repairsOnItem,
  type SpeechPrefs,
  speechPrefsItem,
  withSite,
} from '@/shared/settings';
import { chooseVoice, loadVoices, voiceId } from '@/speech/voices';
import { type OptionsModel, renderOptions } from '@/ui/options/view';

/**
 * The settings page. Every change is saved right away to chrome.storage.local;
 * content scripts and the popup watch storage and react.
 *
 * Voices are the browser's (speechSynthesis): the ones on this computer, and
 * the online ones, listed only when online voices are allowed.
 */

const SAMPLE = 'This is how VisioFix will read to you in Focus Mode.';

const root = document.getElementById('app') as HTMLElement;
/** A status region that stays on the page across re-renders (see index.html). */
const announcer = document.getElementById('announcer') as HTMLElement;
const version = browser.runtime.getManifest().version;

let repairsOn = true;
let offSites: string[] = [];
let focus: FocusPrefs = focusPrefsItem.fallback;
let speech: SpeechPrefs = speechPrefsItem.fallback;
let shortcuts: OptionsModel['shortcuts'] = [];
let voices: SpeechSynthesisVoice[] = [];
let sampleNote: string | null = null;
/** Kept so Chrome doesn't garbage-collect it while it speaks. */
let sample: SpeechSynthesisUtterance | null = null;

function render(): void {
  renderOptions(
    root,
    {
      repairsOn,
      offSites,
      theme: focus.theme,
      textSize: focus.textSize,
      voices: voices
        .map((v) => ({ id: voiceId(v), name: v.name, lang: v.lang, local: v.localService }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      voiceId: speech.voiceId,
      allowOnlineVoices: speech.allowOnlineVoices,
      speed: speech.speed,
      sampleNote,
      shortcuts,
      version,
    },
    {
      onRepairsOn: (on) => {
        repairsOn = on;
        render();
        void repairsOnItem.setValue(on);
      },
      onTurnSiteBackOn: (host) => {
        offSites = withSite(offSites, host, true);
        render();
        void offSitesItem.setValue(offSites);
      },
      onTheme: (theme) => {
        focus = { ...focus, theme };
        void focusPrefsItem.setValue(focus);
      },
      onTextSize: (textSize) => {
        focus = { ...focus, textSize };
        void focusPrefsItem.setValue(focus);
      },
      onVoice: (id) => {
        speech = { ...speech, voiceId: id };
        void speechPrefsItem.setValue(speech);
      },
      onAllowOnlineVoices: (allowOnlineVoices) => {
        // Turning online voices off also drops a chosen online voice.
        const chosen = voices.find((v) => voiceId(v) === speech.voiceId);
        const keep = allowOnlineVoices || !chosen || chosen.localService;
        speech = { ...speech, allowOnlineVoices, voiceId: keep ? speech.voiceId : null };
        render();
        void speechPrefsItem.setValue(speech);
      },
      onSpeed: (speed) => {
        speech = { ...speech, speed };
        void speechPrefsItem.setValue(speech);
      },
      onPlaySample: () => playSample(),
      onChangeShortcuts: () => {
        void browser.tabs.create({ url: 'chrome://extensions/shortcuts' });
      },
    },
  );
}

/** Reads a sample sentence with the chosen voice (or the automatic choice for the browser's language) and speed. */
function playSample(): void {
  const choice = chooseVoice(voices, speech, navigator.language);
  if (!choice.ok) {
    sampleNote = choice.language
      ? `There’s no voice for ${choice.language} on this computer. Choose one above, or add one in your system’s speech settings.`
      : 'This computer has no voices for reading aloud.';
    // Cleared first, so pressing the button again announces the note again.
    announcer.textContent = '';
    setTimeout(() => (announcer.textContent = sampleNote), 50);
    render();
    return;
  }
  if (sampleNote) {
    sampleNote = null;
    announcer.textContent = '';
    render();
  }
  speechSynthesis.cancel();
  sample = new SpeechSynthesisUtterance(SAMPLE);
  sample.voice = choice.voice;
  sample.lang = choice.voice.lang;
  sample.rate = speech.speed;
  speechSynthesis.speak(sample);
}

async function loadShortcuts(): Promise<OptionsModel['shortcuts']> {
  return (await getShortcuts())
    .filter((c) => c.description)
    .map((c) => ({ action: c.description, shortcut: c.shortcut }));
}

async function init(): Promise<void> {
  shortcuts = await loadShortcuts();
  [repairsOn, offSites, focus, speech] = await Promise.all([
    repairsOnItem.getValue(),
    offSitesItem.getValue(),
    focusPrefsItem.getValue(),
    speechPrefsItem.getValue(),
  ]);
  render();

  if (typeof speechSynthesis !== 'undefined') {
    voices = await loadVoices(speechSynthesis);
    render();
    speechSynthesis.addEventListener('voiceschanged', () => {
      voices = speechSynthesis.getVoices();
      render();
    });
  }

  // Keep in step with changes made elsewhere (the popup's site switch).
  repairsOnItem.watch((value) => {
    repairsOn = value;
    render();
  });
  offSitesItem.watch((value) => {
    offSites = value;
    render();
  });

  // Chrome has no event for shortcut changes: re-read them when the reader
  // comes back from chrome://extensions/shortcuts (or any other tab).
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    void loadShortcuts().then((next) => {
      if (JSON.stringify(next) === JSON.stringify(shortcuts)) return;
      shortcuts = next;
      render();
    });
  });
}

void init();
