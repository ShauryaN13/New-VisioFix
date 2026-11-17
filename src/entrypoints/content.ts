import { SITE_MATCHES } from '@/shared/matches';
import { isVisioFixMessage, type PingReply } from '@/shared/messages';

/**
 * Runs on every http(s) page, in the main document only (no iframes).
 *
 * Phase 1: answers the popup's ping so we can confirm the script loads.
 * The repair engine arrives in Phase 3, Focus Mode in Phase 4.
 */
export default defineContentScript({
  matches: SITE_MATCHES,
  runAt: 'document_idle',
  allFrames: false,
  main() {
    browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (!isVisioFixMessage(message)) return;
      if (message.type === 'visiofix:ping') {
        const reply: PingReply = { ok: true, host: location.hostname };
        sendResponse(reply);
      }
    });
  },
});
