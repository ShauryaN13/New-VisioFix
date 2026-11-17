import { defineConfig } from 'wxt';
import { SITE_MATCHES } from './src/shared/matches';

// Chrome only (Edge installs the same build from the Chrome Web Store).
// See https://wxt.dev/api/reference/wxt/interfaces/inlineconfig.html
export default defineConfig({
  srcDir: 'src',
  manifest: {
    name: 'VisioFix',
    description:
      'Repairs common accessibility problems on the pages you visit and adds a high-contrast Focus Mode with read-aloud.',
    // storage: saves your settings and per-site on/off choices on your computer.
    permissions: ['storage'],
    // Needed to repair pages automatically and open Focus Mode on any site you visit.
    host_permissions: SITE_MATCHES,
    action: {
      default_title: 'VisioFix',
      // The simplified 16/32px drawing for the toolbar (public/icon, from `npm run icons`).
      default_icon: { 16: 'icon/16.png', 32: 'icon/32.png' },
    },
  },
});
