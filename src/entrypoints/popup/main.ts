import '@/ui/fonts.css';
import '@/ui/tokens.css';
import '@/ui/base.css';
import '@/ui/popup/popup.css';
import type { Browser } from 'wxt/browser';
import { getShortcuts } from '@/shared/commands';
import { type FocusMessage, REPORT_PORT, type StatusMessage, type StatusReply } from '@/shared/messages';
import type { PageReport } from '@/shared/report';
import { offSitesItem, repairsOnItem, withSite } from '@/shared/settings';
import { getSiteKey } from '@/shared/site';
import { type PopupModel, renderPopup } from '@/ui/popup/view';

/**
 * The toolbar popup. Reads the settings, asks the page's content script for
 * its report, and keeps both up to date while the popup is open.
 * Read aloud is wired up in Phase 5.
 */

const root = document.getElementById('app') as HTMLElement;

interface State {
  tabId: number | null;
  host: string | null;
  /** false = no content script answered (tab opened before install/update). */
  connected: boolean;
  repairsOn: boolean;
  offSites: string[];
  report: PageReport | null;
  shortcuts: PopupModel['shortcuts'];
}

const state: State = {
  tabId: null,
  host: null,
  connected: false,
  repairsOn: true,
  offSites: [],
  report: null,
  shortcuts: { focusMode: null, readAloud: null },
};

function model(): PopupModel {
  const { host } = state;
  if (!host || state.tabId === null) return { view: { kind: 'unsupported' }, shortcuts: state.shortcuts };
  if (!state.connected) return { view: { kind: 'needs-reload', host }, shortcuts: state.shortcuts };
  if (!state.repairsOn) return { view: { kind: 'off-everywhere', host }, shortcuts: state.shortcuts };
  const repairsOn = !state.offSites.includes(host);
  return {
    view: { kind: 'ready', host, repairsOn, report: repairsOn ? state.report : null },
    shortcuts: state.shortcuts,
  };
}

function render(): void {
  renderPopup(root, model(), {
    onToggleSite: (on) => {
      if (!state.host) return;
      state.offSites = withSite(state.offSites, state.host, on);
      if (!on) state.report = null;
      render();
      void offSitesItem.setValue(state.offSites);
    },
    onTurnOnEverywhere: () => {
      state.repairsOn = true;
      render();
      void repairsOnItem.setValue(true);
    },
    onFocusMode: () => {
      if (state.tabId === null) return;
      const message: FocusMessage = { type: 'visiofix:focus', action: 'open' };
      // The message is on its way once sent; closing the popup hands the
      // keyboard back to the page, where Focus Mode takes it.
      void browser.tabs.sendMessage(state.tabId, message).catch(() => undefined);
      window.close();
    },
    onReadAloud: () => {
      // Phase 5.
    },
    onReload: () => {
      if (state.tabId !== null) void browser.tabs.reload(state.tabId);
      window.close();
    },
    onOpenSettings: () => {
      void browser.runtime.openOptionsPage();
      window.close();
    },
  });
}

async function loadShortcuts(): Promise<PopupModel['shortcuts']> {
  const commands = await getShortcuts();
  const find = (name: string) => commands.find((c) => c.name === name)?.shortcut ?? null;
  return { focusMode: find('toggle-focus-mode'), readAloud: find('play-pause') };
}

async function init(): Promise<void> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  // tab.url is only visible for pages VisioFix has access to (http/https).
  state.host = getSiteKey(tab?.url);
  state.tabId = tab?.id ?? null;
  [state.repairsOn, state.offSites, state.shortcuts] = await Promise.all([
    repairsOnItem.getValue(),
    offSitesItem.getValue(),
    loadShortcuts(),
  ]);

  if (state.host && state.tabId !== null) {
    try {
      const message: StatusMessage = { type: 'visiofix:status' };
      const reply = (await browser.tabs.sendMessage(state.tabId, message)) as StatusReply | undefined;
      if (reply?.ok) {
        state.connected = true;
        state.report = reply.report;
      }
    } catch {
      // No content script in this tab.
    }
  }
  render();

  if (state.connected && state.tabId !== null) {
    const port: Browser.runtime.Port = browser.tabs.connect(state.tabId, { name: REPORT_PORT });
    port.onMessage.addListener((message: StatusReply) => {
      state.report = message.report;
      render();
    });
  }

  repairsOnItem.watch((value) => {
    state.repairsOn = value;
    render();
  });
  offSitesItem.watch((value) => {
    state.offSites = value;
    render();
  });
}

// If anything unexpected fails, still show a popup (never a blank box).
init().catch((error: unknown) => {
  console.error('VisioFix popup:', error);
  render();
});
