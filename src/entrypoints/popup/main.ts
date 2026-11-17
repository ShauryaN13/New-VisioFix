import './style.css';
import type { PingMessage, PingReply } from '@/shared/messages';
import { getSiteKey } from '@/shared/site';

/**
 * Phase 1 popup: confirms the content script is running on the current tab.
 * The real popup is designed in Phase 2 and wired up in Phases 3 and 6.
 */

const statusEl = document.getElementById('status') as HTMLParagraphElement;
const reloadButton = document.getElementById('reload') as HTMLButtonElement;

async function checkCurrentTab(): Promise<void> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  // tab.url is only visible for pages we have host access to (http/https),
  // so browser pages like chrome://extensions come back without a URL.
  const host = getSiteKey(tab?.url);
  const tabId = tab?.id;

  if (tabId === undefined || !host) {
    statusEl.textContent = "VisioFix can't run on this page.";
    return;
  }

  try {
    const ping: PingMessage = { type: 'visiofix:ping' };
    const reply = (await browser.tabs.sendMessage(tabId, ping)) as PingReply | undefined;
    if (reply?.ok) {
      statusEl.textContent = `Running on ${host}.`;
      return;
    }
  } catch {
    // No content script in this tab: it was opened before VisioFix was installed or reloaded.
  }

  statusEl.textContent = 'Reload this page to start VisioFix here.';
  reloadButton.hidden = false;
  reloadButton.addEventListener('click', async () => {
    await browser.tabs.reload(tabId);
    window.close();
  });
}

void checkCurrentTab();
