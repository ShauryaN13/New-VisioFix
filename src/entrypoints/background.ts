import type { FocusMessage } from '@/shared/messages';

/**
 * Background service worker: keyboard shortcuts.
 *
 * Chrome delivers extension shortcuts (the manifest's "commands") here, with
 * the active tab, so no "tabs" permission is needed. The work happens in the
 * tab's content script.
 *
 * Phase 4: Open or close Focus Mode. Phase 5 adds the read-aloud shortcuts.
 */
export default defineBackground(() => {
  browser.commands?.onCommand.addListener((command, tab) => {
    if (command !== 'toggle-focus-mode' || tab?.id === undefined) return;
    const message: FocusMessage = { type: 'visiofix:focus', action: 'toggle' };
    // Fails on pages VisioFix can't run on (chrome://, the Web Store) and on
    // tabs opened before VisioFix was installed: nothing to do there.
    browser.tabs.sendMessage(tab.id, message).catch(() => undefined);
  });
});
