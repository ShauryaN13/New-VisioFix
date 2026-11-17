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
import { type OptionsModel, renderOptions } from '@/ui/options/view';

/**
 * The settings page. Every change is saved right away to chrome.storage.local;
 * content scripts and the popup watch storage and react.
 * Voices and "Play a sample" arrive with read-aloud in Phase 5.
 */

const root = document.getElementById('app') as HTMLElement;

let repairsOn = true;
let offSites: string[] = [];
let focus: FocusPrefs = focusPrefsItem.fallback;
let speech: SpeechPrefs = speechPrefsItem.fallback;
let shortcuts: OptionsModel['shortcuts'] = [];

function render(): void {
  renderOptions(
    root,
    {
      repairsOn,
      offSites,
      theme: focus.theme,
      textSize: focus.textSize,
      voices: [],
      voiceId: speech.voiceId,
      allowOnlineVoices: speech.allowOnlineVoices,
      speed: speech.speed,
      shortcuts,
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
      onVoice: (voiceId) => {
        speech = { ...speech, voiceId };
        void speechPrefsItem.setValue(speech);
      },
      onAllowOnlineVoices: (allowOnlineVoices) => {
        speech = { ...speech, allowOnlineVoices };
        render();
        void speechPrefsItem.setValue(speech);
      },
      onSpeed: (speed) => {
        speech = { ...speech, speed };
        void speechPrefsItem.setValue(speech);
      },
      onPlaySample: () => {
        // Phase 5.
      },
      onChangeShortcuts: () => {
        void browser.tabs.create({ url: 'chrome://extensions/shortcuts' });
      },
    },
  );
}

async function init(): Promise<void> {
  shortcuts = (await getShortcuts())
    .filter((c) => c.description)
    .map((c) => ({ action: c.description, shortcut: c.shortcut }));
  [repairsOn, offSites, focus, speech] = await Promise.all([
    repairsOnItem.getValue(),
    offSitesItem.getValue(),
    focusPrefsItem.getValue(),
    speechPrefsItem.getValue(),
  ]);
  render();

  // Keep in step with changes made elsewhere (the popup's site switch).
  repairsOnItem.watch((value) => {
    repairsOn = value;
    render();
  });
  offSitesItem.watch((value) => {
    offSites = value;
    render();
  });
}

void init();
