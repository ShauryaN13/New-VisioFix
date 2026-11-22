import type { SpeechEnvironment } from '@/speech/read-aloud';

/**
 * A stand-in for Chrome's speechSynthesis, close to how Chrome behaves:
 *   - speak() queues an utterance; finish() ends the current one (onend).
 *   - cancel() reports every queued utterance as "interrupted" (onerror).
 *   - fail(error) reports an error on the current one.
 */

export interface FakeUtterance {
  text: string;
  voice: SpeechSynthesisVoice | null;
  lang: string;
  rate: number;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
}

export function voice(name: string, lang: string, local = true, isDefault = false): SpeechSynthesisVoice {
  return { name, lang, voiceURI: name, localService: local, default: isDefault } as SpeechSynthesisVoice;
}

export class FakeSpeech implements SpeechEnvironment {
  queue: FakeUtterance[] = [];
  spoken: FakeUtterance[] = [];
  paused = false;
  resumed = 0;
  activation = true;
  voices: SpeechSynthesisVoice[] = [voice('Microsoft David', 'en-US'), voice('Google US English', 'en-US', false)];
  private listeners = new Set<() => void>();

  speak = (u: SpeechSynthesisUtterance) => {
    const utterance = u as unknown as FakeUtterance;
    this.queue.push(utterance);
    this.spoken.push(utterance);
  };

  cancel = () => {
    const cancelled = this.queue;
    this.queue = [];
    for (const u of cancelled) u.onerror?.({ error: 'interrupted' });
  };

  resume = () => {
    this.paused = false;
    this.resumed += 1;
  };

  getVoices = () => this.voices;
  addEventListener = (_type: 'voiceschanged', listener: () => void) => this.listeners.add(listener);
  removeEventListener = (_type: 'voiceschanged', listener: () => void) => this.listeners.delete(listener);
  createUtterance = (text: string) =>
    ({ text, voice: null, lang: '', rate: 1, onend: null, onerror: null }) as unknown as SpeechSynthesisUtterance;
  hasUserActivation = () => this.activation;

  /** The current utterance finishes normally. */
  finish(): void {
    this.queue.shift()?.onend?.();
  }

  fail(error: string): void {
    this.queue.shift()?.onerror?.({ error });
  }

  setVoices(voices: SpeechSynthesisVoice[]): void {
    this.voices = voices;
    for (const listener of this.listeners) listener();
  }

  get texts(): string[] {
    return this.spoken.map((u) => u.text);
  }
}
