/**
 * Choosing a voice for read-aloud.
 *
 * Privacy: by default only voices on this computer are used (localService).
 * Online voices (Chrome's "Google …", Edge's "… Online (Natural)") send the
 * text to Google or Microsoft, so they're used only when "Allow online
 * voices" is on in settings. VisioFix never relies on the browser's default
 * voice, which can be an online one.
 *
 * Chrome reports voices in two steps: first its online voices, then (about a
 * second later) the computer's own. loadVoices() waits for the second step.
 */

/** The parts of SpeechSynthesisVoice that matter here (tests pass plain objects). */
export interface VoiceLike {
  name: string;
  lang: string;
  voiceURI: string;
  localService: boolean;
  default: boolean;
}

export interface VoicePrefs {
  /** null = automatic. */
  voiceId: string | null;
  allowOnlineVoices: boolean;
}

export type VoiceChoice<V extends VoiceLike> =
  | { ok: true; voice: V }
  | {
      ok: false;
      /** The language there's no voice for, in words ("French"), or null when there are no usable voices at all. */
      language: string | null;
      /** An online voice would work if the user allowed online voices. */
      onlineWouldWork: boolean;
    };

/** The id stored in settings. */
export function voiceId(voice: VoiceLike): string {
  return voice.voiceURI || voice.name;
}

/** Wait this long for the computer's own voices before going with what's there. */
const LOCAL_VOICES_WAIT_MS = 2500;

export interface SynthVoices {
  getVoices(): SpeechSynthesisVoice[];
  addEventListener(type: 'voiceschanged', listener: () => void): void;
  removeEventListener(type: 'voiceschanged', listener: () => void): void;
}

/** The voice list, once the computer's own voices have arrived (or after a short wait if there are none). */
export function loadVoices(synth: SynthVoices, waitMs = LOCAL_VOICES_WAIT_MS): Promise<SpeechSynthesisVoice[]> {
  const ready = () => synth.getVoices().some((v) => v.localService);
  if (ready()) return Promise.resolve(synth.getVoices());
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      synth.removeEventListener('voiceschanged', check);
      resolve(synth.getVoices());
    };
    const check = () => {
      if (ready()) done();
    };
    const timer = setTimeout(done, waitMs);
    synth.addEventListener('voiceschanged', check);
  });
}

/**
 * The voice to read with:
 *   1. The voice chosen in settings, if it's still installed (and allowed).
 *   2. Automatic: a voice for the page's language, on this computer first,
 *      the system default among equals; online only if allowed.
 */
export function chooseVoice<V extends VoiceLike>(voices: V[], prefs: VoicePrefs, pageLang: string | null): VoiceChoice<V> {
  const allowed = voices.filter((v) => v.localService || prefs.allowOnlineVoices);

  if (prefs.voiceId) {
    const chosen = allowed.find((v) => voiceId(v) === prefs.voiceId);
    if (chosen) return { ok: true, voice: chosen };
  }

  const lang = normalize(pageLang ?? (typeof navigator === 'undefined' ? 'en' : navigator.language));
  const primary = lang.split('-')[0] ?? lang;
  const rank = (v: V) => {
    const vl = normalize(v.lang);
    const language = vl === lang ? 0 : vl.split('-')[0] === primary ? 1 : 9;
    return language * 4 + (v.localService ? 0 : 2) + (v.default ? 0 : 1);
  };
  const best = allowed
    .filter((v) => rank(v) < 9 * 4)
    .sort((a, b) => rank(a) - rank(b))[0];
  if (best) return { ok: true, voice: best };

  const onlineWouldWork = voices.some((v) => !v.localService && normalize(v.lang).split('-')[0] === primary);
  return { ok: false, language: voices.length > 0 ? languageName(primary) : null, onlineWouldWork };
}

function normalize(tag: string): string {
  return tag.replace(/_/g, '-').toLowerCase();
}

function languageName(code: string): string {
  try {
    return new Intl.DisplayNames(['en'], { type: 'language' }).of(code) ?? code;
  } catch {
    return code;
  }
}
