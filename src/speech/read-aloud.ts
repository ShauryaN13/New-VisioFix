import type { FocusView } from '@/focus/view';
import type { SpeechPrefs } from '@/shared/settings';
import { Highlighter } from './highlight';
import { Player, type PlayerProblem, type Synth } from './player';
import type { MarkedSentence } from './sentences';
import { chooseVoice, loadVoices, type SynthVoices } from './voices';

/**
 * Read-aloud inside Focus Mode: connects the toolbar, the player, the
 * highlight and the voice settings.
 *
 * Where reading starts: Play continues a paused sentence; otherwise it
 * starts at the first sentence on screen (the title when the article is
 * scrolled to the top). "Read from here" starts at that paragraph.
 *
 * Messages (no voice for the language, Chrome needing a key press first)
 * are shown in the status line, never spoken.
 */

export type SpeechEnvironment = Synth &
  SynthVoices & {
    createUtterance(text: string): SpeechSynthesisUtterance;
    /** Has the page had a click or key press? Chrome won't speak before that. */
    hasUserActivation(): boolean;
  };

export function browserSpeech(): SpeechEnvironment | null {
  if (typeof speechSynthesis === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined') return null;
  const synth = speechSynthesis;
  return {
    speak: (u) => synth.speak(u),
    cancel: () => synth.cancel(),
    get paused() {
      return synth.paused;
    },
    resume: () => synth.resume(),
    getVoices: () => synth.getVoices(),
    addEventListener: (type, listener) => synth.addEventListener(type, listener),
    removeEventListener: (type, listener) => synth.removeEventListener(type, listener),
    createUtterance: (text) => new SpeechSynthesisUtterance(text),
    hasUserActivation: () => navigator.userActivation?.hasBeenActive ?? true,
  };
}

export const MESSAGES = {
  needsActivation: 'Press Play to start reading. Chrome lets a page speak only after you’ve pressed a key or clicked on it.',
  nothingToRead: 'There’s nothing to read aloud on this page.',
  noSpeech: 'Read-aloud isn’t available in this browser.',
  noVoices: 'This computer has no voices for reading aloud. You can add one in your system’s speech settings.',
  noVoiceFor: (language: string, onlineWouldWork: boolean) =>
    `There’s no voice for ${language} on this computer. You can add one in your system’s speech settings${
      onlineWouldWork ? ', or allow online voices in VisioFix settings' : ''
    }.`,
  error: (error: string) => `Reading stopped: the voice reported a problem (${error}). Press Play to try again.`,
};

export class ReadAloud {
  private readonly player: Player | null;
  private readonly highlighter: Highlighter;
  private readonly voices: Promise<SpeechSynthesisVoice[]> | null;
  /** Increases on every Play request, so a late voice list can't start an old one. */
  private request = 0;

  constructor(
    private readonly view: FocusView,
    private readonly sentences: readonly MarkedSentence[],
    private readonly lang: string | null,
    private prefs: SpeechPrefs,
    private readonly speech: SpeechEnvironment | null = browserSpeech(),
  ) {
    this.highlighter = new Highlighter(view.scroller, sentences);
    this.player = speech
      ? new Player(
          sentences.map((s) => s.text),
          {
            synth: speech,
            createUtterance: (text) => speech.createUtterance(text),
            onSentence: (index) => this.highlighter.show(index),
            onState: (state) => view.setPlaying(state === 'playing'),
            onProblem: (problem) => this.problem(problem),
          },
        )
      : null;
    // Start loading voices now, so they're ready when Play is pressed.
    this.voices = speech ? loadVoices(speech) : null;
  }

  get playing(): boolean {
    return this.player?.state === 'playing';
  }

  /** Play/pause (the Play button, Alt+Shift+K). */
  toggle(): void {
    if (!this.player) return this.view.setStatus(MESSAGES.noSpeech);
    if (this.player.state === 'playing') {
      this.request += 1;
      this.player.pause();
    } else {
      void this.playAt(this.player.current ?? this.highlighter.firstVisible());
    }
  }

  /** Start reading unless already reading (the popup's Read aloud, Alt+Shift+K when Focus Mode was closed). */
  start(): void {
    if (!this.player) return this.view.setStatus(MESSAGES.noSpeech);
    if (this.player.state !== 'playing') void this.playAt(this.player.current ?? this.highlighter.firstVisible());
  }

  readFrom(element: Element): void {
    if (!this.player) return this.view.setStatus(MESSAGES.noSpeech);
    void this.playAt(this.highlighter.firstIn(element) ?? this.highlighter.firstVisible());
  }

  next(): void {
    this.player?.next();
  }

  previous(): void {
    this.player?.previous();
  }

  /** Voice settings changed (here or on the settings page): used from the next sentence. */
  setPrefs(prefs: SpeechPrefs): void {
    this.prefs = prefs;
    if (this.player?.state === 'playing') void this.applyVoice();
  }

  destroy(): void {
    this.request += 1;
    this.player?.stop();
    this.highlighter.destroy();
  }

  private async playAt(index: number): Promise<void> {
    const request = ++this.request;
    if (!this.player || !this.speech) return;
    if (this.sentences.length === 0) return this.view.setStatus(MESSAGES.nothingToRead);
    if (!this.speech.hasUserActivation()) return this.problem({ kind: 'needs-activation' });
    if (!(await this.applyVoice()) || request !== this.request) return;
    this.view.setStatus(null);
    this.player.play(index);
  }

  /** Picks the voice for the current settings. false (and a message) when there's none to use. */
  private async applyVoice(): Promise<boolean> {
    if (!this.player || !this.voices) return false;
    const choice = chooseVoice(await this.voices, this.prefs, this.lang);
    if (!choice.ok) {
      this.player.pause();
      this.view.setStatus(choice.language ? MESSAGES.noVoiceFor(choice.language, choice.onlineWouldWork) : MESSAGES.noVoices);
      return false;
    }
    this.player.setVoice({ voice: choice.voice, lang: choice.voice.lang, rate: this.prefs.speed });
    return true;
  }

  private problem(problem: PlayerProblem): void {
    if (problem.kind === 'needs-activation') {
      this.view.setStatus(MESSAGES.needsActivation);
      // One Enter (or Space) on Play counts as the key press Chrome wants.
      this.view.focusPlay();
    } else {
      this.view.setStatus(MESSAGES.error(problem.error));
    }
  }
}
