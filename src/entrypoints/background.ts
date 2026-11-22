import type { FocusMessage, SpeechMessage } from '@/shared/messages';

/**
 * Background service worker: keyboard shortcuts.
 *
 * Chrome delivers extension shortcuts (the manifest's "commands") here, with
 * the active tab, so no "tabs" permission is needed. The work happens in the
 * tab's content script.
 */

const MESSAGES: Record<string, FocusMessage | SpeechMessage> = {
  'toggle-focus-mode': { type: 'visiofix:focus', action: 'toggle' },
  // Opens Focus Mode and starts reading when Focus Mode is closed.
  'play-pause': { type: 'visiofix:speech', action: 'toggle' },
  'next-sentence': { type: 'visiofix:speech', action: 'next' },
  'previous-sentence': { type: 'visiofix:speech', action: 'previous' },
};

export default defineBackground(() => {
  browser.commands?.onCommand.addListener((command, tab) => {
    const message = MESSAGES[command];
    if (!message || tab?.id === undefined) return;
    // Fails on pages VisioFix can't run on (chrome://, the Web Store) and on
    // tabs opened before VisioFix was installed: nothing to do there.
    browser.tabs.sendMessage(tab.id, message).catch(() => undefined);
  });
});
