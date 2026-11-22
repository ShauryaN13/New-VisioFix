import { describe, expect, it } from 'vitest';
import { type OptionsHandlers, type OptionsModel, renderOptions } from '@/ui/options/view';

const model: OptionsModel = {
  repairsOn: true,
  offSites: [],
  theme: 'contrast',
  textSize: 22,
  voices: [{ id: 'david', name: 'Microsoft David', lang: 'en-US', local: true }],
  voiceId: null,
  allowOnlineVoices: false,
  speed: 1,
  sampleNote: null,
  shortcuts: [{ action: 'Open or close Focus Mode', shortcut: 'Alt+Shift+F' }],
  version: '1.0.0',
};

const noop = () => undefined;
const handlers: OptionsHandlers = {
  onRepairsOn: noop,
  onTurnSiteBackOn: noop,
  onTheme: noop,
  onTextSize: noop,
  onVoice: noop,
  onAllowOnlineVoices: noop,
  onSpeed: noop,
  onPlaySample: noop,
  onChangeShortcuts: noop,
};

function render(overrides: Partial<OptionsModel> = {}): HTMLElement {
  const root = document.createElement('div');
  renderOptions(root, { ...model, ...overrides }, handlers);
  return root;
}

describe('settings page', () => {
  it('shows the version', () => {
    expect(render().textContent).toContain('VisioFix version 1.0.0');
  });

  it('links every credit to the license bundled with VisioFix, in a new tab that says so', () => {
    const links = [...render().querySelectorAll<HTMLAnchorElement>('.credits a')];
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/licenses/atkinson-hyperlegible-next-OFL.txt',
      '/licenses/lucide.txt',
      '/licenses/readability.txt',
      '/licenses/dom-accessibility-api.txt',
    ]);
    for (const a of links) {
      expect(a.target).toBe('_blank');
      expect(a.rel).toBe('noopener');
      expect(a.textContent).toMatch(/License( 2\.0)?, opens in a new tab$/);
    }
  });

  it('shows the sample note as text; the page announces it from a region that stays put', () => {
    const root = render({ sampleNote: 'This computer has no voices for reading aloud.' });
    const note = root.querySelector('.sample-note');
    expect(note?.textContent).toBe('This computer has no voices for reading aloud.');
    // Not a status region itself: it's re-created on every render, which screen readers can miss.
    expect(root.querySelector('[role="status"]')).toBeNull();
  });
});
