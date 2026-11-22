/**
 * Keyboard shortcuts (commands API).
 *
 * Chrome only provides chrome.commands when the manifest declares at least
 * one command, so every caller must cope with it being missing.
 */

export interface ShortcutInfo {
  name: string;
  description: string;
  /** e.g. "Alt+Shift+F" or "Alt+Shift+.", or null when it isn't set. */
  shortcut: string | null;
}

/** Chrome names some keys ("Alt+Shift+Period"); people know them by their symbol. Edge already writes ",". */
export function formatShortcut(shortcut: string): string {
  return shortcut.replace(/\bPeriod\b/g, '.').replace(/\bComma\b/g, ',');
}

/** The order people meet them in (Chrome lists commands alphabetically by name). */
const ORDER = ['toggle-focus-mode', 'play-pause', 'next-sentence', 'previous-sentence'];

function rank(name: string): number {
  const index = ORDER.indexOf(name);
  return index === -1 ? ORDER.length : index;
}

export async function getShortcuts(): Promise<ShortcutInfo[]> {
  const api = (browser as { commands?: typeof browser.commands }).commands;
  if (!api?.getAll) return [];
  try {
    const commands = await api.getAll();
    return commands
      .filter((c) => c.name && !c.name.startsWith('_'))
      .map((c) => ({
        name: c.name as string,
        description: c.description ?? '',
        shortcut: c.shortcut ? formatShortcut(c.shortcut) : null,
      }))
      .sort((a, b) => rank(a.name) - rank(b.name));
  } catch {
    return [];
  }
}
