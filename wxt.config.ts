import { defineConfig } from 'wxt';
import { FONT_FILES } from './src/focus/font';
import { SITE_MATCHES } from './src/shared/matches';

// Chrome only (Edge installs the same build from the Chrome Web Store).
// See https://wxt.dev/api/reference/wxt/interfaces/inlineconfig.html
export default defineConfig({
  srcDir: 'src',
  manifest: {
    name: 'VisioFix',
    description:
      'Repairs common accessibility problems on the pages you visit and adds a high-contrast Focus Mode with read-aloud.',
    // The popup and settings colors use CSS light-dark() (Chrome and Edge 123+). Older
    // browsers can't install VisioFix rather than getting unreadable colors.
    minimum_chrome_version: '123',
    // storage: saves your settings and per-site on/off choices on your computer.
    permissions: ['storage'],
    // Needed to repair pages automatically and open Focus Mode on any site you visit.
    host_permissions: SITE_MATCHES,
    action: {
      default_title: 'VisioFix',
      // The simplified 16/32px drawing for the toolbar (public/icon, from `npm run icons`).
      default_icon: { 16: 'icon/16.png', 32: 'icon/32.png' },
    },
    // Focus Mode's font, loaded into pages while Focus Mode is open. use_dynamic_url:
    // the address changes every session, so sites can't probe it to detect VisioFix.
    web_accessible_resources: [{ resources: FONT_FILES, matches: SITE_MATCHES, use_dynamic_url: true }],
    // Keyboard shortcuts (a manifest key, not a permission). Chrome allows at most 4 suggested
    // keys; users can change them at chrome://extensions/shortcuts. On a Mac, Option+Shift+letter
    // types characters (Option+Shift+F is "Ï"), so the Mac keys use Control instead.
    // Play/pause is K (as in YouTube and most web video players): Chrome 158 keeps Alt+Shift+P
    // (and R, X, Z) for itself, so a suggested Alt+Shift+P is never assigned. Not S: ChromeOS
    // opens quick settings with Alt+Shift+S.
    commands: {
      'toggle-focus-mode': {
        suggested_key: { default: 'Alt+Shift+F', mac: 'MacCtrl+Shift+F' },
        description: 'Open or close Focus Mode',
      },
      'play-pause': {
        suggested_key: { default: 'Alt+Shift+K', mac: 'MacCtrl+Shift+K' },
        description: 'Read aloud: play or pause',
      },
      'next-sentence': {
        suggested_key: { default: 'Alt+Shift+Period', mac: 'MacCtrl+Shift+Period' },
        description: 'Read aloud: next sentence',
      },
      'previous-sentence': {
        suggested_key: { default: 'Alt+Shift+Comma', mac: 'MacCtrl+Shift+Comma' },
        description: 'Read aloud: previous sentence',
      },
    },
  },
});
