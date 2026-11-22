import { afterEach, describe, expect, it, vi } from 'vitest';
import { Player, type PlayerProblem, type PlayerState } from '@/speech/player';
import { chooseVoice, loadVoices } from '@/speech/voices';
import { FakeSpeech, voice } from './fake-speech';

const AUTO = { voiceId: null, allowOnlineVoices: false };

describe('chooseVoice', () => {
  const david = voice('Microsoft David', 'en-US');
  const hazel = voice('Microsoft Hazel', 'en-GB');
  const googleUs = voice('Google US English', 'en-US', false, true);
  const googleFr = voice('Google français', 'fr-FR', false);
  const all = [googleUs, googleFr, david, hazel];

  it('picks a voice on this computer for the page’s language, even when an online one is the default', () => {
    expect(chooseVoice(all, AUTO, 'en-US')).toEqual({ ok: true, voice: david });
    expect(chooseVoice(all, AUTO, 'en-GB')).toEqual({ ok: true, voice: hazel });
  });

  it('falls back to the same language in another region', () => {
    expect(chooseVoice([david], AUTO, 'en-AU')).toEqual({ ok: true, voice: david });
  });

  it('never uses an online voice unless online voices are allowed', () => {
    expect(chooseVoice(all, AUTO, 'fr')).toEqual({ ok: false, language: 'French', onlineWouldWork: true });
    expect(chooseVoice(all, { voiceId: null, allowOnlineVoices: true }, 'fr')).toEqual({ ok: true, voice: googleFr });
  });

  it('uses the voice chosen in settings, but not an online one that is no longer allowed', () => {
    expect(chooseVoice(all, { voiceId: 'Microsoft Hazel', allowOnlineVoices: false }, 'en-US')).toEqual({ ok: true, voice: hazel });
    expect(chooseVoice(all, { voiceId: 'Google US English', allowOnlineVoices: false }, 'en-US')).toEqual({ ok: true, voice: david });
    expect(chooseVoice(all, { voiceId: 'Uninstalled voice', allowOnlineVoices: false }, 'en-US')).toEqual({ ok: true, voice: david });
  });

  it('says when there are no voices at all', () => {
    expect(chooseVoice([], AUTO, 'en')).toEqual({ ok: false, language: null, onlineWouldWork: false });
  });
});

describe('loadVoices', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('waits for Chrome’s second list, which adds the computer’s own voices', async () => {
    const speech = new FakeSpeech();
    speech.voices = [voice('Google US English', 'en-US', false)];
    const loading = loadVoices(speech);
    speech.setVoices([...speech.voices, voice('Microsoft David', 'en-US')]);
    expect((await loading).map((v) => v.name)).toEqual(['Google US English', 'Microsoft David']);
  });

  it('gives up waiting after a while when the computer has no voices', async () => {
    vi.useFakeTimers();
    const speech = new FakeSpeech();
    speech.voices = [voice('Google US English', 'en-US', false)];
    const loading = loadVoices(speech, 2500);
    vi.advanceTimersByTime(2500);
    expect((await loading).map((v) => v.name)).toEqual(['Google US English']);
  });
});

function setup(sentences = ['One.', 'Two.', 'Three.']) {
  const speech = new FakeSpeech();
  const highlights: (number | null)[] = [];
  const states: PlayerState[] = [];
  const problems: PlayerProblem[] = [];
  const player = new Player(sentences, {
    synth: speech,
    createUtterance: speech.createUtterance,
    onSentence: (i) => highlights.push(i),
    onState: (s) => states.push(s),
    onProblem: (p) => problems.push(p),
  });
  return { speech, player, highlights, states, problems };
}

describe('Player', () => {
  it('reads sentence after sentence, highlighting each, then stops with nothing highlighted', () => {
    const { speech, player, highlights, states } = setup();
    player.play(0);
    speech.finish();
    speech.finish();
    speech.finish();
    expect(speech.texts).toEqual(['One.', 'Two.', 'Three.']);
    expect(highlights).toEqual([0, 1, 2, null]);
    expect(states).toEqual(['playing', 'idle']);
    expect(player.current).toBeNull();
  });

  it('applies the voice, language and speed to every sentence', () => {
    const { speech, player } = setup();
    const david = voice('Microsoft David', 'en-US');
    player.setVoice({ voice: david, lang: 'en-US', rate: 1.5 });
    player.play(0);
    expect(speech.spoken[0]).toMatchObject({ voice: david, lang: 'en-US', rate: 1.5 });
  });

  it('pauses by cancelling, ignores the "interrupted" that follows, and replays the sentence on Play', () => {
    const { speech, player, states, problems } = setup();
    player.play(0);
    speech.finish();
    player.pause(); // cancel() reports "interrupted"
    expect(player.state).toBe('paused');
    expect(player.current).toBe(1);
    expect(problems).toEqual([]);
    player.play(player.current ?? 0);
    expect(speech.texts).toEqual(['One.', 'Two.', 'Two.']);
    expect(states).toEqual(['playing', 'paused', 'playing']);
  });

  it('jumps while reading; moves only the highlight while paused or stopped (nothing spoken)', () => {
    const { speech, player, highlights } = setup();
    player.next();
    expect(player.state).toBe('paused');
    expect(highlights).toEqual([0]);
    player.next();
    player.previous();
    expect(speech.spoken).toEqual([]);
    player.play(player.current ?? 0);
    player.next();
    expect(speech.texts).toEqual(['One.', 'Two.']);
    player.next();
    player.next(); // stays on the last sentence
    expect(speech.texts).toEqual(['One.', 'Two.', 'Three.', 'Three.']);
  });

  it('reports Chrome’s "not-allowed" as needing a key press or click', () => {
    const { speech, player, problems } = setup();
    player.play(0);
    speech.fail('not-allowed');
    expect(player.state).toBe('paused');
    expect(problems).toEqual([{ kind: 'needs-activation' }]);
  });

  it('stops on any other voice error and says which', () => {
    const { speech, player, problems } = setup();
    player.play(0);
    speech.fail('synthesis-failed');
    expect(player.state).toBe('paused');
    expect(problems).toEqual([{ kind: 'error', error: 'synthesis-failed' }]);
  });

  it('wakes Chrome up if its speech was left paused', () => {
    const { speech, player } = setup();
    speech.paused = true;
    player.play(0);
    expect(speech.resumed).toBe(1);
  });

  it('stop() silences and forgets the position', () => {
    const { speech, player, highlights } = setup();
    player.play(1);
    player.stop();
    expect(speech.queue).toEqual([]);
    expect(player.state).toBe('idle');
    expect(highlights.at(-1)).toBeNull();
  });
});
