# Final test checklist (Chrome and Edge)

Run this on the exact package you'll upload. Tick each box in Chrome, then again in Edge (Edge
installs from the Chrome Web Store, so it runs the same build).

## Already checked automatically (headless Chrome 158 and Edge 158, 1.0.0 build)

These passed on 2026-11-21 and don't need repeating unless the code changes:

- The build loads; the production manifest asks only for `storage` and http/https site access,
  `minimum_chrome_version` 123, version 1.0.0. The zip has the 27 built files and nothing else.
- All four shortcuts are assigned (Alt+Shift+F, K, ., ,) in both browsers.
- Demo page (`store/demo/article.html`): 9 fixes (3 link names, 2 field labels, 1 caption, 1 tracking
  image, 2 hidden duplicate links) and 4 reported problems, as designed. Pausing the site removes all
  12 VisioFix changes; resuming puts them back.
- Popup renders with the right site, status and count, in the bundled font.
- Focus Mode opens in a closed shadow root, loads only the font faces it needs, and the host element
  is removed on close.
- Read-aloud (muted) picks a voice on the computer (Microsoft David), not an online one, in both
  browsers. Edge offers 300+ "Online (Natural)" voices; the settings list only shows them when
  online voices are allowed.
- Settings page shows version 1.0.0; the credit links open the bundled license files; "Change
  shortcuts" opens `chrome://extensions/shortcuts` in Chrome and `edge://extensions/shortcuts` in Edge.
- 300 unit tests, typecheck.

## 1. Install the real package

- [ ] `npm run zip`, then unzip `.output/visiofix-1.0.0-chrome.zip` into a new folder.
- [ ] Remove any older VisioFix from `chrome://extensions` (a changed shortcut key isn't re-assigned
      for an existing install).
- [ ] Developer mode on → **Load unpacked** → the unzipped folder. No errors on the card.
- [ ] The card says version 1.0.0; **Details** shows only "Read and change all your data on all
      websites" under permissions.
- [ ] A tab that was open before installing: the popup says "Not running on this tab yet" and
      **Reload this page** works.
- [ ] `chrome://settings` and the Chrome Web Store: the popup says VisioFix can't run there.

## 2. Repairs

- [ ] `npm run fixtures` and open http://localhost:5181. On each fixture page the popup's counts match
      the page's "Expected" box.
- [ ] Turn the site switch off: the status says "Paused on this site", the counts disappear, and the
      page is unchanged (in DevTools, no `data-visiofix` attributes left). Turn it back on.
- [ ] Settings → **Repair pages automatically** off: every open tab is restored; the popup says
      "Repairs are paused everywhere" and **Turn on** works.
- [ ] Busy real sites feel as fast as without VisioFix: YouTube, Gmail (signed in), Reddit, a news
      site. (Gmail hasn't been measured yet.)

## 3. Focus Mode

- [ ] Popup tile and Alt+Shift+F open it; Alt+Shift+F and Escape close it; focus returns to where it
      was.
- [ ] Focus starts on the article title; Tab stays inside Focus Mode; arrow keys scroll.
- [ ] "Aa": text size, all three themes and speed apply immediately and are remembered next time.
- [ ] Real articles: a Wikipedia article, a BBC or Guardian article, an MDN page. A home page (BBC News
      front page) shows the "may not be an article" note.
- [ ] Browser zoom at 200%: toolbar fits on one row, nothing overlaps.

## 4. Read-aloud (with sound)

- [ ] Play starts at the title; the highlight moves with each sentence and stays in view.
- [ ] Pause and Play continue from the same sentence; previous/next work while reading and while paused.
- [ ] "Read from here" (mouse) starts at that paragraph.
- [ ] Popup **Read aloud** and Alt+Shift+K with Focus Mode closed open it; on a page you haven't
      clicked, it shows "Press Play to start reading…" and one Enter starts.
- [ ] Speed changes apply from the next sentence. Closing Focus Mode stops the voice.
- [ ] `localhost:5181/french.html`: a "no voice for French" message, nothing read (unless a French voice
      is installed).
- [ ] Settings → **Play a sample** speaks; with online voices off, no "Google …" or "… Online" voice is
      listed or used.

## 5. Keyboard and screen readers

Do these with the keyboard only (no mouse) and a screen reader running.

- [ ] Open the popup with the keyboard: pin VisioFix, press Alt+Shift+T (focus the toolbar), arrow
      to VisioFix and press Enter; or set a key for "Activate the extension" at
      `chrome://extensions/shortcuts`. Every control is reached by Tab, has a name, and shows a
      focus ring.
- [ ] Popup: the switch is announced as "Automatic repairs on this site, switch, on/off" with the
      status; tiles announce their shortcut; "See what changed" expands; the can't-fix page moves
      focus to its title and Back returns.
- [ ] Settings: every switch, slider, radio and the voice list are announced with their label and help
      text; the sliders announce "22 pixels" / "1 times"; "Play a sample" with no voice announces why.
- [ ] Focus Mode: the screen reader announces the dialog "Focus Mode", then the title; headings list
      works (NVDA: H / Insert+F7); the page behind isn't reachable; read-aloud status messages are
      announced, never spoken by VisioFix itself.
- [ ] **NVDA + Chrome** (Windows)
- [ ] **NVDA + Edge** (Windows)
- [ ] **Narrator + Edge** (Windows)
- [ ] **VoiceOver + Chrome** (Mac, if available; also try MacCtrl+Shift+F/K)
- [ ] **ChromeVox** (ChromeOS, if available)

## 6. Display settings

- [ ] Windows contrast theme on (Settings → Accessibility → Contrast themes): popup and settings
      controls have visible borders and text; Focus Mode takes the theme's colors, its buttons get
      borders, and the sentence being read shows in the theme's highlight color.
- [ ] Reduced motion on (Windows: Settings → Accessibility → Visual effects → Animation effects off):
      no switch/press animations; read-aloud scrolls jump instead of glide.
- [ ] System dark mode: popup and settings switch to dark.

## 7. Updating and removing

- [ ] With pages repaired, click **Reload** on VisioFix's card in `chrome://extensions`: open pages
      lose VisioFix's changes (nothing left behind) and work again after a page reload.
- [ ] Remove VisioFix: open pages are left as the site made them.

## 8. Before you submit

- [ ] Privacy policy is at a public address (see `store/permissions.md`), and the Support/Homepage
      links in `store/listing.md` open.
- [ ] Screenshots and promo tile match the current UI (otherwise `npm run build` and
      `npm run store-images`).
- [ ] Upload `.output/visiofix-1.0.0-chrome.zip`, fill the Store listing tab from `store/listing.md`
      and the Privacy practices tab from `store/permissions.md`, then **Submit for review**.
