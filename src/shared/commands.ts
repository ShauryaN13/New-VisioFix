/**
 * Keyboard shortcuts (commands API).
 *
 * Chrome only provides chrome.commands when the manifest declares at least
 * one command, so every caller must cope with it being missing.
 */

export interface ShortcutInfo {
  name: string;
  description: string;
  /** e.g. "Alt+Shift+F", or null when the user removed it. */
  shortcut: string | null;
}

export async function getShortcuts(): Promise<ShortcutInfo[]> {
  const api = (browser as { commands?: typeof browser.commands }).commands;
  if (!api?.getAll) return [];
  try {
    const commands = await api.getAll();
    return commands
      .filter((c) => c.name && !c.name.startsWith('_'))
      .map((c) => ({ name: c.name as string, description: c.description ?? '', shortcut: c.shortcut || null }));
  } catch {
    return [];
  }
}
