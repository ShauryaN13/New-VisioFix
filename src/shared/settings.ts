import { storage } from 'wxt/utils/storage';
import { DEFAULT_SPEED, DEFAULT_TEXT_SIZE, type FocusTheme } from '@/focus/model';

/**
 * Settings, stored in chrome.storage.local: on this computer only. Not
 * storage.sync, which would copy them to the browser account's servers.
 *
 * One storage item per group, so the popup and the settings page can each
 * change what they own without overwriting the other's changes.
 */

/** Global switch: repair pages automatically. */
export const repairsOnItem = storage.defineItem<boolean>('local:repairsOn', { fallback: true });

/** Hostnames where the user paused repairs. */
export const offSitesItem = storage.defineItem<string[]>('local:offSites', { fallback: [] });

export interface FocusPrefs {
  theme: FocusTheme;
  textSize: number;
}
export const focusPrefsItem = storage.defineItem<FocusPrefs>('local:focus', {
  fallback: { theme: 'contrast', textSize: DEFAULT_TEXT_SIZE },
});

export interface SpeechPrefs {
  /** null = automatic (a voice on this computer matching the page's language). */
  voiceId: string | null;
  allowOnlineVoices: boolean;
  speed: number;
}
export const speechPrefsItem = storage.defineItem<SpeechPrefs>('local:speech', {
  fallback: { voiceId: null, allowOnlineVoices: false, speed: DEFAULT_SPEED },
});

/** Are repairs active on this host? */
export function repairsActiveFor(host: string, repairsOn: boolean, offSites: string[]): boolean {
  return repairsOn && !offSites.includes(host);
}

/** Returns a new list with the host paused (on=false) or resumed (on=true). */
export function withSite(offSites: string[], host: string, on: boolean): string[] {
  const rest = offSites.filter((site) => site !== host);
  return on ? rest : [...rest, host].sort();
}
