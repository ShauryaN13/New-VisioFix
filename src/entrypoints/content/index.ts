import type { Browser } from 'wxt/browser';
import { RepairEngine } from '@/repair/engine';
import { SITE_MATCHES } from '@/shared/matches';
import { isVisioFixMessage, REPORT_PORT, type StatusReply } from '@/shared/messages';
import { offSitesItem, repairsActiveFor, repairsOnItem } from '@/shared/settings';

/**
 * Runs on every http(s) page, in the main document only (no iframes).
 *
 * Starts the repair engine when repairs are on for this site, and stops it
 * (undoing every change) when the user turns them off, either for this site
 * from the popup or everywhere from the settings page. If the extension is
 * reloaded, updated or removed, everything is undone too.
 *
 * Focus Mode joins this script in Phase 4.
 */
export default defineContentScript({
  matches: SITE_MATCHES,
  runAt: 'document_idle',
  allFrames: false,
  async main(ctx) {
    const host = location.hostname;
    const ports = new Set<Browser.runtime.Port>();

    const status = (): StatusReply => ({
      ok: true,
      host,
      repairsActive: engine.running,
      report: engine.running ? engine.report() : null,
      stats: engine.stats,
    });

    // Tell an open popup about new fixes, at most a few times a second.
    let pushTimer: ReturnType<typeof setTimeout> | null = null;
    const pushStatus = () => {
      if (ports.size === 0 || pushTimer) return;
      pushTimer = setTimeout(() => {
        pushTimer = null;
        const message = status();
        for (const port of ports) port.postMessage(message);
      }, 300);
    };

    const engine = new RepairEngine(document, { onChange: pushStatus });

    const applySettings = async () => {
      const [repairsOn, offSites] = await Promise.all([repairsOnItem.getValue(), offSitesItem.getValue()]);
      if (ctx.isInvalid) return;
      if (repairsActiveFor(host, repairsOn, offSites)) engine.start();
      else engine.stop();
      pushStatus();
    };

    const unwatchOn = repairsOnItem.watch(() => void applySettings());
    const unwatchSites = offSitesItem.watch(() => void applySettings());
    await applySettings();

    const onMessage = (message: unknown, _sender: unknown, sendResponse: (reply: StatusReply) => void) => {
      if (!isVisioFixMessage(message)) return;
      if (message.type === 'visiofix:status') {
        // Report what's done so far. No flush(): on a heavy page that could block
        // it for a moment; the open popup gets updates as the work finishes.
        sendResponse(status());
      }
    };
    browser.runtime.onMessage.addListener(onMessage);

    const onConnect = (port: Browser.runtime.Port) => {
      if (port.name !== REPORT_PORT) return;
      ports.add(port);
      port.onDisconnect.addListener(() => ports.delete(port));
      port.postMessage(status());
    };
    browser.runtime.onConnect.addListener(onConnect);

    // Extension reloaded, updated, disabled or removed: put the page back.
    ctx.onInvalidated(() => {
      engine.stop();
      unwatchOn();
      unwatchSites();
      browser.runtime.onMessage.removeListener(onMessage);
      browser.runtime.onConnect.removeListener(onConnect);
      if (pushTimer) clearTimeout(pushTimer);
    });
  },
});
