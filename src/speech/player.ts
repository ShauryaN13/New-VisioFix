/**
 * Read-aloud: speaks a list of sentences one at a time with speechSynthesis.
 *
 *   - One utterance per sentence. When one ends, the next starts.
 *   - Pause = cancel and remember the sentence; Play replays it from its
 *     start. (Chrome's own pause/resume is unreliable.)
 *   - cancel() makes Chrome report the cancelled utterance as "interrupted";
 *     a token makes sure events from old utterances are ignored.
 *   - Chrome refuses to speak ("not-allowed") until the page has had a click
 *     or key press. The player reports that, so Focus Mode can ask for one.
 *
 * Never starts on its own: only play(), next() and previous() while playing
 * speak, and the caller only calls them for a user action.
 */

export type PlayerState = 'idle' | 'playing' | 'paused';

export type PlayerProblem =
  /** Chrome wants a click or key press on the page first. */
  | { kind: 'needs-activation' }
  /** The voice reported an error. */
  | { kind: 'error'; error: string };

/** The parts of speechSynthesis the player uses (tests pass a fake). */
export interface Synth {
  speak(utterance: SpeechSynthesisUtterance): void;
  cancel(): void;
  readonly paused: boolean;
  resume(): void;
}

export interface PlayerOptions {
  synth: Synth;
  createUtterance(text: string): SpeechSynthesisUtterance;
  /** The sentence being read (or ready to be read) changed; null = none. */
  onSentence(index: number | null): void;
  onState(state: PlayerState): void;
  onProblem(problem: PlayerProblem): void;
}

export interface VoiceSettings {
  voice: SpeechSynthesisVoice | null;
  lang: string | null;
  rate: number;
}

export class Player {
  private stateValue: PlayerState = 'idle';
  private currentIndex: number | null = null;
  private token = 0;
  /** Kept so Chrome doesn't garbage-collect it before its events fire (a long-standing Chrome bug). */
  private utterance: SpeechSynthesisUtterance | null = null;
  private voice: VoiceSettings = { voice: null, lang: null, rate: 1 };

  constructor(
    private readonly sentences: readonly string[],
    private readonly opts: PlayerOptions,
  ) {}

  get state(): PlayerState {
    return this.stateValue;
  }

  get current(): number | null {
    return this.currentIndex;
  }

  get length(): number {
    return this.sentences.length;
  }

  /** A sentence has been handed to the voice and hasn't ended yet. */
  get speaking(): boolean {
    return this.utterance !== null;
  }

  /** Used from the next sentence on. */
  setVoice(settings: VoiceSettings): void {
    this.voice = { ...settings };
  }

  /** Start (or resume) reading at this sentence. */
  play(from: number): void {
    if (this.sentences.length === 0) return;
    this.speakAt(clamp(from, this.sentences.length));
  }

  /** Stop speaking, but remember the sentence so Play continues there. */
  pause(): void {
    if (this.stateValue !== 'playing') return;
    this.silence();
    this.setState('paused');
  }

  next(): void {
    this.step(1);
  }

  previous(): void {
    this.step(-1);
  }

  /** Stop and forget the position (Focus Mode closing). */
  stop(): void {
    this.silence();
    this.currentIndex = null;
    this.opts.onSentence(null);
    this.setState('idle');
  }

  /** Moves one sentence. While reading, reading continues there; otherwise only the position (and highlight) moves. */
  private step(delta: number): void {
    if (this.sentences.length === 0) return;
    const target = clamp((this.currentIndex ?? (delta > 0 ? -1 : 0)) + delta, this.sentences.length);
    if (this.stateValue === 'playing') {
      this.speakAt(target);
    } else {
      this.currentIndex = target;
      this.opts.onSentence(target);
      if (this.stateValue === 'idle') this.setState('paused');
    }
  }

  private speakAt(index: number): void {
    this.silence();
    const token = this.token;
    const text = this.sentences[index] ?? '';
    const utterance = this.opts.createUtterance(text);
    if (this.voice.voice) utterance.voice = this.voice.voice;
    if (this.voice.lang) utterance.lang = this.voice.lang;
    utterance.rate = this.voice.rate;
    utterance.onend = () => {
      if (token !== this.token) return;
      if (index + 1 < this.sentences.length) this.speakAt(index + 1);
      else this.finish();
    };
    utterance.onerror = (event) => {
      if (token !== this.token) return;
      // Interruptions come from our own cancel(); anything else stops reading.
      if (event.error === 'interrupted' || event.error === 'canceled') return;
      this.token += 1;
      this.utterance = null;
      this.setState('paused');
      this.opts.onProblem(event.error === 'not-allowed' ? { kind: 'needs-activation' } : { kind: 'error', error: event.error });
    };
    this.utterance = utterance;
    this.currentIndex = index;
    this.opts.onSentence(index);
    this.setState('playing');
    // Chrome can be left paused (for example after the tab was in the background); speak() then waits forever.
    if (this.opts.synth.paused) this.opts.synth.resume();
    this.opts.synth.speak(utterance);
  }

  /** The last sentence ended: back to the start, nothing highlighted. */
  private finish(): void {
    this.utterance = null;
    this.currentIndex = null;
    this.opts.onSentence(null);
    this.setState('idle');
  }

  private silence(): void {
    this.token += 1;
    this.utterance = null;
    this.opts.synth.cancel();
  }

  private setState(state: PlayerState): void {
    if (state === this.stateValue) return;
    this.stateValue = state;
    this.opts.onState(state);
  }
}

function clamp(index: number, length: number): number {
  return Math.min(Math.max(index, 0), length - 1);
}
