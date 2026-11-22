# VisioFix: notes for Claude

VisioFix is a Chrome extension for visually impaired users, rebuilt solo from an Android app
(NJ TSA Software Development, Top 9 in state). Goal: a small, reliable, polished extension
published on the Chrome Web Store. Favor reliable and simple over feature count.

The legacy Android code calls the app "CleanView" in places. The name is **VisioFix**.

## Scope
- **Chrome only.** Edge installs from the Chrome Web Store, so it runs the same build.
  **No Firefox** (decided 2026-11-16): no Firefox build/dev/zip scripts, no gecko id,
  no data_collection_permissions, no Firefox-specific code or testing.
- Three features: (1) automatic repairs on the live page, (2) Focus Mode reading view,
  (3) read-aloud inside Focus Mode with sentence highlighting.
- User-installed, not a site-injected overlay (accessiBe, UserWay). Those have a bad reputation
  with screen reader users because they break pages. VisioFix follows the do-no-harm rules below;
  the README and store listing must say so.
- Not porting: voice search, shake, haptics, clipboard detection, v2's home screen. Keyboard
  shortcuts replace gestures.

## Hard rules
**Do no harm (repairs)**
- Never delete page content. Only add what's missing; never override valid author semantics.
- Tag every change (`data-visiofix-*`) and make it reversible. Turning VisioFix off for a site
  restores the original page. On revert, remove an attribute only if it still holds the value
  we set (if the site changed it since, leave the site's value).
- Idempotent: processing a node twice changes nothing (WeakSet of processed nodes).
- Debounce mutation handling; ignore VisioFix's own changes.
- Global on/off plus per-site on/off (site = hostname).
- No noticeable lag on heavy sites (YouTube, Gmail, Reddit, news sites).
- Main document only. Out of scope for v1: iframes, shadow DOM, clickable divs/spans.

**Privacy**
- No remote code, no analytics, no data collection. Nothing leaves the user's machine.
- Fonts and libraries bundled locally. Settings in `storage.local` (not `storage.sync`).
- Read-aloud uses local voices by default. "Allow online voices" is off by default and explains
  that online voices (`localService === false`, e.g. Chrome's "Google …", Edge's "… Online
  (Natural)") send the text to Google/Microsoft.

**Dependencies and permissions**
- Minimal dependencies; each needs a stated reason (see Stack). Pin exact versions.
- Request only needed permissions, each with a one-line justification for store review.

**Speech and status**
- Never speak automatically. Read-aloud only starts on an explicit user action.
- Status is shown, never spoken.

**The UI itself must be accessible**
- Keyboard-operable, labeled, visible focus, WCAG AA contrast (AAA in Focus Mode), respects
  reduced motion, works with NVDA, VoiceOver, ChromeVox.

**Working agreement**
- One phase at a time. After each phase: what was built, how to load and test it in Chrome,
  what's still weak, and a short screen-reader checklist. Then wait for the user.
- Commit to `main` at the end of each phase with a clear message, then **push to GitHub**
  (`origin`, github.com/ShauryaN13/New-VisioFix). Update Progress below.
- Be honest about limits; never fake something that can't be done reliably.
- Explain decisions in plain terms: the user needs to understand and defend this code.

## Stack and commands
- Manifest V3 + TypeScript (strict), built with **WXT 0.21.5** (pinned; pre-1.0, so minors can break).
  Chosen because it is actively maintained, generates the manifest, handles the service worker,
  has a shadow-root UI helper with keyboard-event isolation (`createShadowRootUi`), and has
  dev auto-reload.
- No UI framework: plain TypeScript + a small DOM helper, plain CSS with design tokens.
  No Tailwind (its CSS can clash with host pages inside shadow roots).
- Node 26 LTS, npm.

| Command | What it does |
|---|---|
| `npm run dev` | Dev build with auto-reload; WXT opens Chrome via web-ext |
| `npm run build` | Production build in `.output/chrome-mv3/` |
| `npm run zip` | Store zip |
| `npm test` | Vitest unit tests (jsdom) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run design` | Design preview (dev only) at http://localhost:5180: every screen with sample data |
| `npm run icons` | Renders the icon from `src/assets/brand.ts` to `public/icon/{16,32,48,128}.png` |
| `npm run fonts` | Copies the used woff2 files to `public/fonts/` and the OFL to `public/licenses/` |
| `npm run fixtures` | Serves `tests/fixtures/` at http://localhost:5181 (tiny Node script, no dependency). `?csp=strict` adds a locked-down Content Security Policy |
| `npm run store-images` | After `npm run build`: store screenshots (`store/screenshots/`, 1280×800) and promo tile (`store/promo/`, 440×280) from the real build in headless Chrome, on the demo page `store/demo/` (no dependency) |

**Dependencies** (✓ = installed)
| Package | Ships? | Reason |
|---|---|---|
| ✓ `wxt` 0.21.5 | no | Build tool, manifest, dev reload |
| ✓ `typescript` 5.9.3 | no | Type checking (5.9 matches WXT's template; not TS 7) |
| ✓ `vite` 8.3.8 | no | WXT's bundler (peer dependency) |
| ✓ `vitest` 5.1.0, `jsdom` 31.0.1 | no | Unit tests with a DOM |
| ✓ `web-ext` 10.8.0 | no | Lets `npm run dev` open Chrome with VisioFix loaded (kept by user decision) |
| ✓ `@fontsource/atkinson-hyperlegible-next` 5.3.0 | font files only | Source of the font (Braille Institute, 2025, OFL). Dev dependency: `npm run fonts` copies 8 woff2 files (Latin + Latin Ext, 400/700, normal/italic) into `public/fonts/`, which are committed and ship |
| ✓ `@resvg/resvg-js` 2.6.2 | no | Renders the SVG icon to PNGs (`npm run icons`) |
| ✓ `dom-accessibility-api` 0.7.1 | yes | Accessible-name computation per spec (repairs). MIT, license in `public/licenses/` |
| ✓ `@mozilla/readability` 0.6.0 | yes | Focus Mode extraction (Firefox Reader View's engine). Apache 2.0, license + full Apache text in `public/licenses/readability.txt` |

No DOMPurify (Focus Mode builds its own DOM from an allow-list), no ESLint/Prettier unless asked.

## Permissions (with store justifications)
- `storage`: saves your settings and per-site on/off choices on your computer.
- Host access `http://*/*`, `https://*/*` (also the content-script matches, shared via
  `src/shared/matches.ts`): needed to repair pages automatically and open Focus Mode on any site
  you visit. Nothing is collected or sent. Expect the "Read and change all your data on all
  websites" warning and a slower first review.
- `web_accessible_resources`: only the 8 font files (`FONT_FILES` in `src/focus/font.ts`), with
  `use_dynamic_url` (the address changes every session, so sites can't probe it to detect
  VisioFix): lets Focus Mode show its bundled font on the page.
- `commands` (4, Chrome's maximum of suggested keys): Alt+Shift+F Focus Mode, Alt+Shift+K
  play/pause, Alt+Shift+. / Alt+Shift+, next/previous sentence; MacCtrl+Shift+… on a Mac.
- Not requested: `tabs`, `scripting`, `activeTab`, `tts`. Commands is a manifest key, not a permission.
  `commands.onCommand` passes the active tab, so the shortcut needs no `tabs` permission.
  Tabs opened before install get a "Reload this page" button in the popup instead of `scripting`.
- Check the production manifest after builds: WXT adds `tabs`/`scripting` only in dev mode.
- `minimum_chrome_version: 123` (not a permission): the popup and settings colors use CSS
  `light-dark()`; older browsers can't install VisioFix instead of getting unreadable colors.
- Full Privacy-tab answers (single purpose, justifications, remote code, data usage) are in
  `store/permissions.md`; the policy is `PRIVACY.md`.

## Approved design

### 1. Repairs (live page, main document) — built in Phase 3
**Engine** (`src/repair/engine.ts`)
- Content script (`src/entrypoints/content/index.ts`) at `document_idle`, `all_frames: false`.
  Starts the engine when repairs are on for the host, `stop()` (undo everything) when paused,
  globally off, or when the extension is reloaded/updated/removed (`ctx.onInvalidated`).
- Work runs in ~8ms slices via requestIdleCallback; the clock is checked every 8 elements.
  Fixes decided during a slice are written all at once at its end, so style reads and DOM writes
  never interleave (this cut the stress page from 4.3s to 0.3s of main-thread time).
- MutationObserver (childList + a short attribute list incl. `src`, `aria-hidden`, `hidden`) feeds
  a queue, debounced 250ms with 1s max wait. Each element is checked once (WeakSet); it's
  rechecked when its attributes change or content changes inside a link/button/label/figure.
  Changes to aria-hidden/hidden/inert force a recheck of the whole subtree.
- VisioFix's own writes go through `write()`: queued page records are taken first, then whatever
  the observer records is dropped. If the site sets an attribute VisioFix set, the site wins
  (`forget`), and undo leaves it.
- `ChangeLog` (`src/repair/changes.ts`): every change has a target, an owner (the element whose
  check produced it; e.g. a field owns the id added to its label), the previous value, and a count
  kind. Undo only removes a value that's still ours. Elements are tagged
  `data-visiofix="attr attr"`. A label id another VisioFix-labelled field still uses is handed over,
  not removed.
- Names: `guessName()` answers named/unnamed/unsure without reading styles; the full
  dom-accessibility-api computation runs only for "unsure" (aria-labelledby, embedded controls).
- `flush()` is for tests only (it can block on heavy pages); the status message never flushes.

**a. Unlabeled controls** (buttons, links, form fields with no accessible name). Only real sources:
- Form fields: a `<label>` that is the field's previous or next sibling and isn't connected to any
  control (`label.control === null`: no `for`, or `for` pointing nowhere) → `aria-labelledby`.
- Links: destination as host + path + meaningful query (tracking params like `utm_*`, `fbclid`
  stripped), e.g. `twitter.com/visiofix`, `en.wikipedia.org/wiki/X?action=edit`,
  `Email help@example.com`, `Call …`. 60-char cap. Skip `#`, same-page jumps and `javascript:`.
- `aria-label=""` counts as missing (previous "" restored on undo); an author's aria-labelledby is
  never overridden, even if broken.
- `title`/`placeholder` already count as names. Never "Button"/"Link" fallbacks. Icon-only buttons
  with no source are reported (only if rendered).

**b. Images**: only `<img>` with no `alt` attribute, a source, and no other name. Never touch `alt=""`.
- In a `<figure>` with one image and a `<figcaption>` → `aria-labelledby` to the caption.
- Else `aria-describedby` text → alt, a parent link's `title` → alt, or WordPress
  `.wp-caption` / `.wp-caption-text` (whole class tokens) → `aria-labelledby`.
- Image-only links: the link is named; the image inside a link with an aria-label is covered.
- Nothing reliable: left alone, counted as "needs a description" if rendered. No placeholder.
- `alt=""` for tracking pixels/spacers **only after load** (`complete && naturalWidth > 0`) and
  only when natural size ≤ 2×2. **Never rendered size** (lazy/hidden images measure 0×0).
  Unloaded images wait for `load`; images with no `src` yet are skipped until `src` is set.

**c. ARIA**
- Invalid role values and `aria-labelledby`/`aria-describedby` pointing to missing IDs:
  **report only**. Browsers already ignore both per the ARIA spec, so changing them changes
  nothing for screen readers, and removing a reference the page fills in later would break it.
- `aria-hidden` on focusable elements: fix only one case. A link inside `aria-hidden` that
  duplicates a visible, non-hidden link to the same URL in the same container gets
  `tabindex="-1"`. Everything else is reported only.

**d. Heading check** (report only, computed when the popup opens): skipped levels, missing h1,
empty headings, including `role="heading"`/`aria-level`. Multiple h1s are not flagged.

### 2. Focus Mode — built in Phase 4
**Overlay** (`src/focus/overlay.ts`, `FocusMode` class; the content script owns one)
- Native `<dialog>` + `showModal()` inside a closed shadow root (WXT `createShadowRootUi`,
  `isolateEvents`, CSS from `focus.css?inline`). Host `<visiofix-ui>` is appended to `<html>`
  (outside `<body>`, so frameworks that own the body's children don't trip over it); the repair
  engine skips it (`OWN_UI_TAG`). The page behind is inert for Tab and screen readers; Escape
  closes (native dialog `close` event → teardown); it sits in the top layer. Focus goes to the
  article title (`h1 tabindex=-1`, no focus ring: it isn't a control), so screen readers start
  there and arrow keys scroll the article. On close, focus returns to where it was.
  `all: initial` blocks page CSS. The host is the only change to the page and is removed on close.
- Opened by the popup tile (`visiofix:focus` `open`, then the popup closes) or Alt+Shift+F
  (background `commands.onCommand` → `toggle`). Works whether repairs are on or off.
- Opening is two steps (Phase 5, at the user's request): the dialog opens at once with
  `renderLoading()` ("Getting the page ready…" + spinner, `aria-busy`), waits for one paint
  (rAF + task, 100ms cap), then extracts and swaps in the article. The loading content is
  `opacity: 0` with a 300ms-delayed CSS reveal, so quick opens never show it; Chrome runs
  opacity/transform animations on the compositor, so it appears and spins while extraction
  blocks the main thread (verified with a CDP screencast on the stress page). Under reduced
  motion the reveal stays, the spinner is hidden. Escape/shortcut during loading closes cleanly.
- Settings: theme/text size in `focusPrefsItem`, speed in `speechPrefsItem`; "Aa" changes are
  saved, and changes made elsewhere while open apply live.
- Font: `@font-face` inside a shadow root doesn't apply in Chrome, so the FontFace API registers
  "VisioFix Atkinson" on the page's `document.fonts` on open and removes it on close
  (`src/focus/font.ts`; unicode ranges match `fonts.css`, checked by a test). Verified: it loads
  even under `font-src 'none'` (content-script fonts aren't subject to the page's CSP); only the
  faces the text needs download.
- A status line under the progress bar (`setStatus`, inside an always-present `role="status"`
  region) shows read-aloud messages; screen readers announce it, VisioFix never speaks it.

**Extraction** (`src/focus/extract.ts`, only when opened, never changes the page)
1. Copy the document. Walking the live page and the copy in parallel (same element order),
   remove what has computed `display: none` (Readability only sees inline styles), mark inline
   elements shown as blocks (`data-vf-block`) and inline elements whose ≥3px margin stands in for
   a space (`data-vf-gap`), so "in Kyiv" + "and" doesn't become "in Kyivand". Marks are on the
   copy only.
2. Listing check: not `og:type` article, and ≥6 headings (and ≥ half) link to other pages
   → list of stories (BBC News front page: 45 of 51) → fallback.
3. Otherwise, if `isProbablyReaderable()` (Firefox's Reader View check), lift headings out of
   wrapper divs with ≤20 extra characters (Wikipedia's "[edit]" wrappers made Readability drop
   every section heading), then Readability on a second copy with `serializer: el => el` (no HTML
   string is ever parsed). Readability is skipped when the checks fail (it took 1.5s on the
   stress page for a result that was thrown away).
4. Keep the article if ≥500 characters, ≤50% link text and not mostly linked headlines.
5. Fallback: `main`/`[role=main]` (≥200 chars), else a single `article`, else `body`; skipping
   nav/aside/footer and navigation/complementary/contentinfo/search/menu/dialog roles (never
   class substrings), with a visible notice.
- Title: Readability's, but the page's only `<h1>` when the title is that `<h1>` + separator + the
  site's name (og:site_name or in the hostname): "Braille - Wikipedia" → "Braille". The first
  heading is dropped if it repeats the title.

**Allow-list builder** (`src/focus/build.ts`): output is plain data (`FocusDoc`), the view creates
fresh elements, so no scripts, styles, classes or handlers can come along.
- Kept: h1–h6 and `role=heading` (levels kept), p, ul/ol (nested), blockquote, pre (spacing
  kept), figure + figcaption, images with a description (alt, aria-label, aria-labelledby), and
  inline: links, strong/b, em/i, code/kbd, del/s, sup/sub, `<br>` (as a line break, CSS
  `pre-line`). Everything else becomes text. Text outside `<p>` becomes a paragraph.
- Left out: scripts, styles, form controls and their labels, embeds, svg/math, `[hidden]`,
  `[aria-hidden=true]`, dialogs, always nav/search/menus; images with no description (never made
  up) or decorative (`alt=""`) unless captioned; separators with no letters ("|", "•").
- Links: only http(s)/mailto/tel; `javascript:` and same-page jumps (#footnotes) become text.
  A link wrapping a card makes its first heading the link. Icon-only links use only the site's
  own aria-label, not one VisioFix's repairs added (clutter in a reading view).
- Tables: data tables (Readability's rules: th/caption/colgroup → data; nested tables → layout)
  become a list, one item per row, labelled by the header row ("Monday: 9–9",
  "Name: Ana · Age: 34"); rows that are only a picture show the picture; layout tables are read
  cell by cell.
- Stops at 4,000 blocks with a notice; an empty result shows "didn't find any text".
- Images get a white backdrop (dark drawings on transparent backgrounds vanish on dark themes).
- Toolbar: text size, theme, play/pause, speed, close.
- Themes: **High Contrast** (default): bg #000000, H1 #FFFF00, H2 #FFD700, body #FFFFFF,
  links #00FFFF underlined. **Dark**. **Light** (soft off-white, not pure white).

### 3. Read-aloud (Focus Mode only) — built in Phase 5
- speechSynthesis in the content script (`src/speech/`). One utterance per sentence (avoids
  Chrome's ~15s cutoff); the highlight moves when each sentence is handed to the voice.
- Sentences (`sentences.ts`): `Intl.Segmenter` in the page's `lang`; over 200 characters split at
  `, ; : — –` in the second half, else a space. `markSentences()` runs once on the detached
  article before it's shown: each sentence becomes `<span class="vf-sentence" data-sentence=N>`,
  one span per text node (a sentence through a link = several spans). Read: h1–h6, p, li,
  figcaption (each unit separately; nested list items are their own units). Not read: the
  byline line, notices, `pre`, "Read from here" buttons, footnote superscripts ("1", "(2)",
  "[note 1]", "[citation needed]"). During reading only classes change.
- Player (`player.ts`): pause = cancel + remember; Play replays that sentence (Chrome's
  pause/resume is unreliable). A token drops events from cancelled utterances (Chrome reports
  them as "interrupted"); the current utterance is kept referenced (GC bug). `synth.resume()` if
  Chrome was left paused. Next/previous while reading jump and keep reading; otherwise they only
  move the highlight. Speed changes apply from the next sentence.
- Voices (`voices.ts`): automatic = a local voice for the page's language (exact tag, then the
  same language), system default among equals; never the browser default voice, which can be
  online. Online voices only when allowed. A voice chosen in settings wins if it's still installed
  and allowed. `loadVoices()` waits (≤2.5s) for Chrome's second voice list (see gotchas). No voice
  for the language → a status message, nothing is read (never an English voice for French).
- Starting: Play continues the paused sentence, else starts at the first sentence on screen
  (the title at the top). "Read from here" (a mouse-only `aria-hidden` span in each top-level
  paragraph's margin) starts at that paragraph. The popup's Read aloud and Alt+Shift+K with Focus
  Mode closed open it and start at the top.
- Chrome refuses `speak()` ("not-allowed") until the page has had a click or key press
  (`navigator.userActivation.hasBeenActive`); the shortcuts and the popup don't count. Then Focus
  Mode shows "Press Play to start reading…" and moves focus to Play: one Enter starts reading,
  and every shortcut works on that page from then on. (`chrome.tts` would avoid this but needs
  the `tts` permission, which the plan rules out.)
- Highlight (`highlight.ts`): `is-current` on the spans (band + underline); keeps the sentence
  between 10% and 80% of the visible height, landing at 30%; smooth, instant under reduced
  motion; doesn't follow for 5s after the reader scrolls (wheel, touch, scroll keys).
- Shortcuts: Alt+Shift+F, Alt+Shift+K (play/pause), Alt+Shift+. and Alt+Shift+, (next/previous).
  Chrome 158 keeps Alt+Shift+P, R, X and Z for itself (a suggested Alt+Shift+P was never
  assigned), so play/pause is K, as in YouTube and most web video players. Not S: ChromeOS opens
  quick settings with Alt+Shift+S. Mac: MacCtrl+Shift+… (Option+Shift+letter types characters).
  Settings and popup show "." and "," instead of Chrome's "Period"/"Comma" (`formatShortcut`).
- Settings page: lists the browser's voices (computer's own, online ones only when allowed;
  turning online voices off drops a chosen online voice) and "Play a sample" reads a sentence
  with the chosen or automatic voice for the browser's language, or says why it can't.

### 4. Popup and settings
- Popup and settings follow system light/dark. Font: Atkinson Hyperlegible Next.
- Settings (Phase 6): shortcuts listed in a fixed order (Focus Mode, play/pause, next, previous;
  `getShortcuts()` sorts, Chrome returns them alphabetically) and re-read when the tab becomes
  visible again (Chrome has no event for shortcut changes). "Play a sample" messages also go to a
  `role=status` region outside `#app` (`#announcer`), because the view re-creates everything on
  render and a region inserted with its text often isn't announced. Credits link to the bundled
  license files (new tab, said in the link name); the version comes from the manifest.

### Design system (Phase 2, revision 2, per user feedback)
**Brand and color**
- Deep navy #0B1F4D is the brand: icon tile and logo mark. Blue is the one interactive accent:
  #1A56DB light (white text 6.2:1), #8AB4FF dark (with #0B1530 text). Yellow #FFD400 appears
  only in the icon and Focus Mode's High contrast theme.
- Focus Mode's light theme uses #1546B5 for Play and the focus ring (AAA needs 7:1).

**Type and shape**
- Popup base 15px, settings base 16px, nothing under 13px. Scale 13/14/15/16/18/20/24/30.
  One obvious title per screen.
- At most one level of cards. Groups inside a card use spacing and the `--tint` background,
  not 1px borders. Light mode cards get a soft shadow; dark cards stand apart by surface color.
  Radius: 12px cards, 10px buttons and controls. Forced-colors mode adds real borders back.
- Motion: 140ms on hover, press (scale ~0.98) and toggles; all off under prefers-reduced-motion.

**Icons**
- Lucide v1.73.0 (ISC), only the SVGs we use, copied into `src/ui/icons.ts` (no package).
  Same 2px stroke everywhere. License ships in `public/licenses/lucide.txt`.
- The VisioFix icon is the **code eye** (chosen by the user 2026-11-16): an eye whose corners
  are HTML angle brackets, with a yellow pupil, on the navy tile. It is data in
  `src/assets/brand.ts` (`ICON`): a 16px "small" drawing (no eyelids, reads as `< • >`) and a
  128px "detailed" drawing (96px tile, 16px padding). `npm run icons` renders
  `public/icon/*.png`; `logoMark()` in `src/ui/logo.ts` draws it inline.

**Code structure**
- Tokens in `src/ui/tokens.css` (`light-dark(LIGHT, DARK)` per color; `data-theme` on `<html>`
  forces one side). Shared components in `src/ui/base.css`.
- Views are functions of state with handlers passed in, no browser APIs: `renderPopup`
  (`src/ui/popup/view.ts`), `renderOptions` (`src/ui/options/view.ts`), `renderFocusView`
  (`src/focus/view.ts`, from the `FocusDoc` model). Re-renders keep focus via `data-focus-key`.
- DOM is built with `h()` (`src/ui/dom.ts`) and `createElementNS`: never innerHTML, so it
  works on sites that enforce Trusted Types.
- `tests/unit/contrast.test.ts` reads colors from the CSS and checks every pair (AA popup and
  settings, AAA Focus Mode, 3:1 non-text). Add new color pairs there.

**Popup** (360px wide; Chrome caps height at 600px; only `.popup-body` scrolls)
- Header: mark, "VisioFix" (h1), gear icon button "Settings".
- Status card: host (h2), status dot + "Repairing this page" / "Paused on this site", switch
  (name "Automatic repairs on this site", described by the status line). Focus Mode works even
  when repairs are paused.
- Two equal tiles, icon above label: Focus Mode, Read aloud. Shortcut is the accessible
  description and the tooltip, not printed.
- "12 fixes on this page" + "See what changed" disclosure (collapsed by default).
- One line "11 things VisioFix can't fix safely" opens an in-popup details page with a Back
  button: plain-language label, technical term underneath, counts; heading list capped at 4
  + "and N more". Focus moves to the page title; Back returns focus to the line.
- Every main-view state fits without scrolling (tallest: "See what changed" open, 586px).
  Nothing overflows 360px (checked in every preview frame).

**Focus Mode**
- Toolbar: mark + site name | previous, Play (56px circle, primary), next | "Aa", Close.
  "Aa" is a disclosure (aria-expanded/controls) for a panel with text size (slider),
  theme (radios with swatches) and reading speed (slider). Escape in the panel closes it,
  returns focus to "Aa" and stops propagation so Focus Mode stays open; clicking outside or
  tabbing out also closes it. Changes apply immediately and are reported via `onSettingsChange`.
- 4px reading-progress bar (scroll position) under the toolbar; reading time in the byline line
  (`readingMinutes()`, 230 words per minute).
- Each theme sets `color-scheme` so native sliders, radios and scrollbars match.
- Below 640px: site name and "Close" become visually hidden; toolbar stays one row down to ~360px.
- Article column, themes and highlight styles unchanged from revision 1.

**Settings**: max 720px, section titles outside the cards (like Chrome's settings), one card
per section, label + helper text for every control, theme picker cards kept (tinted, accent
ring when selected), credits for the font, icons, Readability and dom-accessibility-api under Privacy.

**Design preview**: `preview/` (Vite, dev only). `frame.html?screen=…` renders one screen per
frame and reports its height with a ResizeObserver; Focus Mode renders in a shadow root.

## Legacy code (`legacy/android-v1`, `legacy/android-v2`)
Code is in `app/src/main/java/com/example/cleanview/` (MainActivity.java, FocusAdapter.java).
- v1 (March 2026): WebView browser; JS scrubber deletes ads by tag and class/id substrings
  (including every iframe), adds aria-label fallbacks, sets `alt="[Image: Needs Description]"`;
  Jsoup Focus Mode (h1, h2, p 40+ chars, links) yellow on black; TTS narrates status.
- v2 (April 2026): removed the scrubber and phone extras; home screen with voice search;
  Focus Mode adds h3, cyan headings, highlight + tap-to-read, auto-reads title and first paragraph.
- Keep from v2: highlight what's being read; start from any item.

Problems not to port:
1. Substring selectors delete real content (`ad-` matches read-more, lead-story, head-, thread-,
   upload-; `-ad` matches btn-add-to-cart; Jsoup `[class*=ad]` matches header, headline, shadow).
   Deleting all iframes/modals/overlays removes videos and real dialogs.
2. `alt=""` overwritten. 3. Image-only links get aria-label="Link". 4. Runs once per load.
5. Speaks automatically. 6. Focus Mode only h1/h2/p/a, skips text outside `<p>`, links twice.
7. v2 cuts paragraphs to two sentences. 8. v2 flattens heading levels and uppercases.
9. v2 highlight #1A1A1A on black is nearly invisible.
Also found in review:
10. v1 deletes every `<ins>` (also the HTML tag for inserted text).
11. Both remove every `<header>`, dropping article titles; v1 removes `<form>`, emptying ASP.NET pages.
12. v1 treats 1-character names ("×", "+") as missing; labels `<a>` without href.
13. v2 drops headings/paragraphs under 20 characters.
14. v2 reads one tapped item and stops; highlight only moves on tap.
15. Both force a US English voice regardless of page language.

## File structure
```
src/
  entrypoints/  background.ts · content/index.ts · popup/ · options/ (open_in_tab)
  repair/       engine.ts · rules.ts · changes.ts · a11y.ts · link-names.ts · roles.ts · headings.ts
  focus/        model.ts · view.ts · focus.css · overlay.ts · extract.ts · build.ts · font.ts
  speech/       sentences.ts · voices.ts · player.ts · highlight.ts · read-aloud.ts
  shared/       site.ts · matches.ts · messages.ts · report.ts · settings.ts · commands.ts
  ui/           tokens.css · base.css · fonts.css · dom.ts · icons.ts (Lucide) · logo.ts · popup/ · options/
  assets/       brand.ts (the icon as data)
preview/        design preview (dev only): index.html · frame.html · sample-data.ts
scripts/        build-icons.mjs · copy-fonts.mjs · serve-fixtures.mjs · store-images.mjs
public/fonts/   Atkinson Hyperlegible Next woff2 files
public/licenses/ OFL (font), ISC (Lucide), Apache 2.0 (Readability), MIT (dom-accessibility-api)
public/icon/    16, 32, 48, 128 PNGs (from src/assets/brand.ts)
tests/unit/     *.test.ts; repair/ engine and rules, focus/ extraction and view, speech/ read-aloud,
                commands (order, key names), options-view (credits, version)
                (fake-speech.ts imitates Chrome's speechSynthesis)
tests/fixtures/ index, legacy-bugs, controls, images (lazy, hidden, script-set src), aria, headings,
                dynamic, stress, article (+ article.css, also with ?csp=strict), not-article, french
store/          listing.md (Store listing tab) · permissions.md (Privacy tab) · test-checklist.md
                screenshots/ · promo/ · demo/ (made-up news page for the screenshots)
PRIVACY.md      privacy policy; its GitHub page is the store's policy URL (repo is public)
legacy/         reference only, excluded from the build
```

## Phases
1. Setup: legacy code in `legacy/`, WXT + TypeScript scaffold, Vitest, Chrome build, placeholder
   popup that loads in Chrome, CLAUDE.md.
2. Design: tokens, icon, popup (light + dark), Focus Mode (3 themes), settings, all with sample
   data, plus a dev-only preview page. **Wait for approval of the look.**
3. Repair engine: observer, change tracking, revert, toggles; controls, images, ARIA, heading
   check; unit tests (incl. idempotence and reversibility) and fixtures. Also wire the popup's
   site switch and fix counts so revert can be tested by hand.
4. Focus Mode with real extraction.
5. Read-aloud with sentence highlighting and shortcuts.
6. Wire up the rest of the popup and settings; store readiness: privacy policy, screenshots,
   listing text, permission justifications, final test checklist (Chrome + Edge). The user submits.

## Known limits (be upfront about these)
- Icon-only buttons and images with no caption usually can't be named without guessing; they are
  reported, not fixed. On-device AI descriptions could be a later opt-in, not v1.
- Shadow DOM is out of scope, and Reddit's current site is largely web components.
- Readability works poorly on home pages, feeds and web apps; the fallback is rough (Hacker
  News reads as table rows; blog.google's front page passes as a short "article" with a byline
  taken from a card). Bylines are Readability's guess (GitHub READMEs get "dependabot[bot]").
- Focus Mode opening time (headless Chrome 158, production build, after the first open):
  articles 20–250ms (BBC, Guardian, MDN, GitHub), Wikipedia "Braille" (9k words) 0.4–0.9s, the
  stress page 0.6–0.7s; a page busy with its own scripts (the Guardian's ads) can add up to a
  second. About half is extraction, half laying out the article in `showModal()`. No progress
  indicator while it works.
- Words the page separates only with CSS other than margins (padding, `::before` content, grid
  gaps) can still run together, as they do for screen readers on the page itself.
- Pages that listen for keys in the capture phase can still see key presses made in Focus Mode
  (`isolateEvents` stops them bubbling out of the shadow root, which covers most sites).
- Images inside table cells show as their description, except rows that are only a picture.
- Voice quality depends on the OS; some systems have few local voices (this Windows machine:
  David, Mark, Zira, all English). Pages in other languages need a voice for that language.
- Read-aloud from the popup or a shortcut on a page you haven't clicked or typed in needs one
  more Enter on Play (Chrome's rule, see §3).
- The first Play in a tab can wait about a second for Chrome's list of local voices.
- Sentence-level highlight only (no word-by-word). Speed changes apply from the next sentence.
  Image descriptions and code blocks aren't read; captions are.
- The Mac (MacCtrl+Shift+…) and ChromeOS shortcuts weren't tried on real hardware.
- Gmail mutates constantly: the main performance risk. Not measured (needs a signed-in account);
  the stress fixture (21k elements + constant changes) costs ~0.3s of main thread over 6s, with
  no slice over ~10ms. Wikipedia, BBC News, YouTube: under 41ms total, slices under 9ms
  (headless, signed out; Reddit served a near-empty page to headless Chrome).
- Hidden content (menus, dialogs) that becomes visible through a class change isn't re-checked
  (class isn't observed, for speed). Links in it are still named if they were in the page at scan
  time; reports may undercount until the next change.

## Chrome gotchas found while building
- `chrome.commands` is undefined when the manifest declares no commands: guard it
  (`src/shared/commands.ts`). It made the popup blank in Phase 3 until fixed.
- Chrome adds a stylesheet to extension pages that sets `body` to "Segoe UI" 75%: `base.css` sets
  `body { font: inherit }`. The design preview (a normal page) can't show this; check real pages.
- `action.openPopup()` from the service worker works in headless Chrome, which allows
  screenshotting the real popup over a test page.
- Chrome 158 ignores `--load-extension` (even with `--disable-features=DisableLoadExtensionCommandLineSwitch`).
  Headless testing: start Chrome with `--remote-debugging-pipe --enable-unsafe-extension-debugging`
  and call CDP `Extensions.loadUnpacked`. `DOM.getDocument({ pierce: true })` reads Focus Mode's
  closed shadow root; `Accessibility.getFullAXTree` shows what screen readers get.
- `web_accessible_resources` with `use_dynamic_url`: `runtime.getURL()` in the content script
  returns the per-session address, and FontFace loads it fine.
- Page CSP doesn't affect Focus Mode (verified with `?csp=strict`: no inline styles, no fonts,
  Trusted Types): WXT's `<style>` in the shadow root, the FontFace load and Readability's
  innerHTML use (on the copy) all run in the content script's world.
- speechSynthesis voices arrive in two `voiceschanged` steps: first only Chrome's online "Google …"
  voices, about a second later the computer's own (Microsoft David/Mark/Zira here). Choosing at
  the first event finds no local voice. Headless Chrome has the local voices too, after the wait.
- `speechSynthesis.speak()` fails with "not-allowed" until the page has user activation, also
  from a content script; extension commands and popup clicks don't give the page activation.
- `cancel()` then `speak()` right away works; the cancelled utterance reports "interrupted".
- Chrome 158 doesn't assign a suggested Alt+Shift+P, R, X or Z (it uses them itself); a missing
  shortcut shows as an empty `shortcut` in `commands.getAll()`. Probe with throwaway extensions
  (Extensions.loadUnpacked) before choosing keys. Changing a suggested key doesn't re-assign it
  for an existing install: remove and re-add the extension, or set it at
  chrome://extensions/shortcuts.
- Headless testing of speech: patch `speechSynthesis.speak` in the content script's isolated
  world (CDP `Runtime.evaluate` with its context id) to set `volume = 0` and log the voice.
- Right after `Extensions.loadUnpacked`, the service worker target can be attached before
  `chrome.*` exists ("chrome is not defined"): wait until `typeof chrome` is defined.
- The popup target refuses `Emulation.setDeviceMetricsOverride`, and in headless Chrome the popup
  window doesn't grow when content opens ("See what changed"): capture with
  `captureBeyondViewport: true` and clip to `.popup`.
- Edge 158 headless doesn't answer on `--remote-debugging-pipe`, but still honors
  `--load-extension` (Chrome dropped it): use `--remote-debugging-port` + a WebSocket and find the
  worker by `chrome.runtime.getManifest().name`. In headless Edge `action.openPopup()` opens the
  popup but its promise never resolves.
- Edge's `commands.getAll()` writes "Alt+Shift+," but "Alt+Shift+Period"; `formatShortcut` handles
  both. Edge opens `chrome://extensions/shortcuts` as `edge://extensions/shortcuts`.
- Killing a test script with `timeout` leaves its headless browser running (and holding the
  debugging port): stop leftover processes by their `--user-data-dir`.
- Chrome Web Store (checked 2026-11-21): a privacy policy URL is required even when data never
  leaves the device, and reading page content locally counts as handling "Website content".
  Screenshots 1280×800 (1–5); the 440×280 small promo tile is optional; icon 128×128.

## Progress
- **Phase 1: done (2026-11-16).** Legacy v1 extracted to `legacy/android-v1/` (zip deleted),
  v2 copied to `legacy/android-v2/` (no `.git`). No earlier extension code existed. Node 26 LTS
  installed. WXT scaffold with `srcDir: 'src'`; manifest has only `storage` + http/https host
  access. Placeholder popup pings the content script and shows "running" / "can't run here" /
  "reload this page". `getSiteKey()` in `src/shared/site.ts` with 6 unit tests. Verified the
  production build in headless Chrome 157: service worker starts, content script answers the
  popup, popup renders, no console errors. Not yet tried: `npm run dev` (opens a Chrome window).
  Pushed to GitHub.
- **Phase 2: built (2026-11-16), revised after review (below).** Design system,
  icon (16/32/48/128 PNGs), popup/Focus Mode/settings views with sample data, design preview
  (`npm run design`), contrast tests (104 tests pass). The toolbar popup in the extension is still
  the Phase 1 placeholder; the real popup switches to the new view when it's wired in Phase 3.
  The contrast test caught Focus Mode light's Play button at 6.2:1 and it was darkened to #1546B5.
  Pushed.
- **Phase 2 revision 2: done (2026-11-16).**
  User feedback applied: larger type, one card level, navy brand, Lucide icons, motion,
  popup restructure (status, tiles, one number, can't-fix details page), Focus Mode toolbar
  with "Aa" panel + progress + reading time, Chrome-style settings, three icon concepts.
  **Approved 2026-11-16; code eye icon chosen, other concepts removed.**
  Fixed the horizontal-scrollbar bug (fixed-width body + frame scrollbars; now fluid content,
  inner scroll area, ResizeObserver-sized frames) and native controls using the wrong color
  scheme in Focus Mode. 145 tests pass.
- **Phase 3: done (2026-11-16).** Repair engine with change log, undo, own-change filtering,
  idle-time slicing and batched writes; rules for controls, images, ARIA and headings;
  settings in storage.local (repairsOn, offSites, focus and speech prefs); content script with
  live port updates to the popup; real popup (status, switch, counts, can't-fix page) and real
  settings page (global switch, paused sites, theme, text size, speed, online voices).
  Fixtures + `npm run fixtures`. 208 unit tests. Verified in headless Chrome 157: every fixture's
  counts match its expected list; pausing a site removes every change (empty aria-label restored)
  and resuming re-applies; content added later is repaired and VisioFix's label is removed once
  the site adds text. Found and fixed in real-browser testing: popup blank without
  chrome.commands, popup fonts overridden by Chrome's extension stylesheet, link names dropping
  meaningful queries (Wikipedia "?action=edit"), images whose src is set later never rechecked.
  Focus Mode and Read aloud tiles do nothing yet (Phases 4 and 5).
- **Phase 4: done (2026-11-21).** Focus Mode opens from the popup tile and Alt+Shift+F: real
  extraction (Readability 0.6.0 + listing check + fallback), allow-list builder, modal dialog in a
  closed shadow root, bundled font via FontFace (web-accessible with `use_dynamic_url`), settings
  saved and followed live. Fixtures `article`, `not-article`, `article?csp=strict`. 249 unit tests.
  Verified in headless Chrome 158: fixtures match their expected lists; focus starts on the title,
  Tab stays inside, arrow keys scroll, Escape in "Aa" closes only the panel, Escape closes Focus
  Mode and focus returns to the page link it came from; the accessibility tree shows only the
  dialog "Focus Mode" with its headings (page content hidden); the repair engine ignores the host;
  same result under a strict CSP. Real sites: BBC/Guardian articles, MDN, GitHub README and
  Wikipedia read as articles; BBC and Guardian front pages, Hacker News fall back with the
  notice. Found and fixed on real sites: Readability ran (1.5s) on pages it would then reject;
  home pages read as articles with the site menu; Wikipedia section headings dropped and
  " - Wikipedia" in titles; infoboxes split into fragments; words joined across spans spaced by
  margins; VisioFix's own link names shown as text; black-on-transparent images invisible.
  Also added the missing dom-accessibility-api license (it has shipped since Phase 3).
  Play/previous/next and the Read aloud tile do nothing yet (Phase 5).
- **Phase 5: done (2026-11-21).** Read-aloud in Focus Mode: sentence marking (`Intl.Segmenter`),
  player (pause = cancel + remember), sentence highlight that follows the reading, local voices
  only by default with a "no voice for French" message instead of a wrong-language voice,
  "Read from here" buttons, previous/next. Popup Read aloud and four shortcuts (Alt+Shift+F/K/./,).
  Settings page voice list and "Play a sample". Loading indicator for slow opens (user request).
  French fixture. 294 unit tests. Verified in headless Chrome 158 with the speech muted
  (volume 0): reading starts at the title with Microsoft David (local), pause/resume replays the
  sentence, next/previous, speed changes, closing stops speech, the article scrolls with the
  reading on Wikipedia (662 sentences, no utterance over 161 characters), no speech on the French
  page, the indicator shows during the stress page's busy second and never on a light article.
  Found and fixed: Alt+Shift+P is taken by Chrome 158 (now K); Chrome needs page activation
  before speaking (now "Press Play" + focus on Play); Chrome's second voice list; "[note 1]"
  markers read aloud. Not tried with real audio or a real screen reader.
- **Phase 6: done (2026-11-21).** Version 1.0.0, `minimum_chrome_version` 123. Settings: version,
  credits linked to the bundled licenses, shortcut list in a sensible order and refreshed after
  changing keys, sample note announced from a persistent status region. Store package: privacy
  policy (`PRIVACY.md`), listing text, Privacy-tab answers and permission justifications, final
  manual checklist (`store/`), 5 screenshots + small promo tile made from the real build by
  `npm run store-images` on a demo page (`store/demo/`). 300 unit tests. Verified headless in
  Chrome 158 and Edge 158 with the production build: all 4 shortcuts assigned, demo page 9 fixes +
  4 reported as designed, pause undoes all 12 changes and resume re-applies, popup, Focus Mode,
  font, local voice chosen (Edge offers 300+ online voices), settings links, "Change shortcuts"
  opens each browser's shortcuts page. The zip is the 27 built files (167 KB); no eval or remote
  code. Still not done by a person: real audio, screen readers, Gmail, Mac/ChromeOS keys
  (`store/test-checklist.md`). The user submits.
