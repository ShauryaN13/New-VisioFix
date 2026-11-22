import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatShortcut, getShortcuts } from '@/shared/commands';

describe('formatShortcut', () => {
  it('shows Chrome’s key names as the symbols people know', () => {
    expect(formatShortcut('Alt+Shift+Period')).toBe('Alt+Shift+.');
    expect(formatShortcut('Alt+Shift+Comma')).toBe('Alt+Shift+,');
    expect(formatShortcut('Alt+Shift+,')).toBe('Alt+Shift+,'); // Edge
    expect(formatShortcut('Alt+Shift+K')).toBe('Alt+Shift+K');
  });
});

describe('getShortcuts', () => {
  const api = browser as unknown as { commands?: unknown };
  const original = api.commands;
  afterEach(() => {
    api.commands = original;
  });

  it('lists the commands in the order people meet them, not alphabetically', async () => {
    // What Chrome 158 returns (alphabetical by name, plus the toolbar action).
    api.commands = {
      getAll: vi.fn(async () => [
        { name: '_execute_action', description: '', shortcut: '' },
        { name: 'next-sentence', description: 'Read aloud: next sentence', shortcut: 'Alt+Shift+Period' },
        { name: 'play-pause', description: 'Read aloud: play or pause', shortcut: 'Alt+Shift+K' },
        { name: 'previous-sentence', description: 'Read aloud: previous sentence', shortcut: '' },
        { name: 'toggle-focus-mode', description: 'Open or close Focus Mode', shortcut: 'Alt+Shift+F' },
      ]),
    };
    expect(await getShortcuts()).toEqual([
      { name: 'toggle-focus-mode', description: 'Open or close Focus Mode', shortcut: 'Alt+Shift+F' },
      { name: 'play-pause', description: 'Read aloud: play or pause', shortcut: 'Alt+Shift+K' },
      { name: 'next-sentence', description: 'Read aloud: next sentence', shortcut: 'Alt+Shift+.' },
      // A shortcut the browser didn't assign shows as "not set".
      { name: 'previous-sentence', description: 'Read aloud: previous sentence', shortcut: null },
    ]);
  });

  it('returns nothing when the browser has no commands API', async () => {
    api.commands = undefined;
    expect(await getShortcuts()).toEqual([]);
  });
});
