# VisioFix

A Chrome extension for visually impaired users. It:

1. **Repairs** common accessibility problems on the pages you visit, so screen readers work better.
2. Opens **Focus Mode**: a clean, high-contrast reading view of the page's main content.
3. **Reads aloud** in Focus Mode, highlighting the sentence being read.

Edge installs it from the Chrome Web Store too.

> Status: in development (Phase 3 of 6 done). Not yet published.

## Not an "accessibility overlay"
Site-injected overlays (scripts a site owner adds for every visitor) have a bad reputation with
screen reader users because they often break pages. VisioFix is different: **you** install it,
and it follows strict do-no-harm rules:

- It never deletes page content.
- It only adds what's missing, and never overrides what the page's author wrote.
- Every change is tagged and reversible: turning VisioFix off for a site restores the original page.
- It never speaks on its own; read-aloud only starts when you press play.
- Nothing leaves your computer: no analytics, no data collection, no remote code.

## Development
Requires Node.js 22 or newer (developed on Node 26 LTS).

```bash
npm install
npm run build      # production build in .output/chrome-mv3/
npm test           # unit tests
npm run typecheck  # TypeScript check
npm run dev        # dev build with auto-reload (opens Chrome)
npm run design     # design preview with sample data at http://localhost:5180
npm run fixtures   # test pages with known accessibility bugs at http://localhost:5181
```

To load the build in your own Chrome: open `chrome://extensions`, turn on **Developer mode**,
click **Load unpacked**, and choose the `.output/chrome-mv3` folder.

The original Android app's code is kept for reference in `legacy/` and is not part of the build.
