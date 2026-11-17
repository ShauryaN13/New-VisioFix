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
| `npm run fixtures` | (Phase 3) serves `tests/fixtures/` on localhost; tiny Node script, no dependency |

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
| `dom-accessibility-api` 0.7.x | yes | Phase 3. Accessible-name computation per spec |
| `@mozilla/readability` 0.6.0 | yes | Phase 4. Focus Mode extraction (Firefox Reader View's engine) |

No DOMPurify (Focus Mode builds its own DOM from an allow-list), no ESLint/Prettier unless asked.

## Permissions (with store justifications)
- `storage`: saves your settings and per-site on/off choices on your computer.
- Host access `http://*/*`, `https://*/*` (also the content-script matches, shared via
  `src/shared/matches.ts`): needed to repair pages automatically and open Focus Mode on any site
  you visit. Nothing is collected or sent. Expect the "Read and change all your data on all
  websites" warning and a slower first review.
- Phase 4: font files listed in `web_accessible_resources` (with `use_dynamic_url`) so Focus Mode
  can load its bundled font.
- Not requested: `tabs`, `scripting`, `activeTab`, `tts`. Commands is a manifest key, not a permission.
  Tabs opened before install get a "Reload this page" button in the popup instead of `scripting`.
- Check the production manifest after builds: WXT adds `tabs`/`scripting` only in dev mode.

## Approved design

### 1. Repairs (live page, main document)
**Engine**
- Content script at `document_idle`, `all_frames: false`.
- First scan in idle-time slices (requestIdleCallback, small budget) so heavy pages don't freeze.
- MutationObserver queues added nodes; processed in batches, debounced ~250ms with ~1s max wait.
  Re-check a processed node only when a relevant attribute changes. Filter out our own changes.
- Cheap pre-filter: skip elements that already have text or `aria-label` before running the full
  accessible-name computation (only causes missed repairs, never wrong ones).
- Change log: element → {attribute, value we set}; elements tagged `data-visiofix-*`.

**a. Unlabeled controls** (buttons, links, form fields with no accessible name per
dom-accessibility-api). Only real sources:
- Form fields: an unassociated `<label>` immediately before the field, or a `<label for>` with a
  broken id and exactly one candidate field → `aria-labelledby` to the author's label (stays in sync).
- Links: cleaned destination, e.g. `twitter.com/visiofix` (no protocol, www, query, hash).
  Skip `#` and `javascript:` hrefs.
- `title`/`placeholder` already count as names in browsers, so those elements aren't unlabeled.
- Never "Button"/"Link" fallbacks. Icon-only buttons with no source stay unnamed and are reported.

**b. Images**: only `<img>` with no `alt` attribute and no computed name. Never touch `alt=""`.
- In a `<figure>` with `<figcaption>` → `aria-labelledby` to the caption (no text copying).
- Else `aria-describedby` text, a parent link's `title`, or a known CMS caption class matched as a
  whole class token (`wp-caption-text`, `wp-element-caption`), never a substring.
- Image-only links: name the link (from its title or destination); the image is then covered.
- Nothing reliable: leave it, count it as "needs a description". No placeholder text.
- Exception: `alt=""` for tracking pixels/spacers, **only after the image has loaded**
  (`img.complete && naturalWidth > 0`) and only when `naturalWidth <= 2 && naturalHeight <= 2`.
  **Never use rendered size**: lazy-loaded images that haven't loaded yet and hidden images
  (carousel slides, `display:none`) also measure 0×0, and `alt=""` would hide real images.
  Images that haven't loaded yet are re-checked on their `load` event.
  Fixtures must cover a lazy-loaded image and a hidden image.

**c. ARIA**
- Invalid role values and `aria-labelledby`/`aria-describedby` pointing to missing IDs:
  **report only**. Browsers already ignore both per the ARIA spec, so changing them changes
  nothing for screen readers, and removing a reference the page fills in later would break it.
- `aria-hidden` on focusable elements: fix only one case. A link inside `aria-hidden` that
  duplicates a visible, non-hidden link to the same URL in the same container gets
  `tabindex="-1"`. Everything else is reported only.

**d. Heading check** (report only, computed when the popup opens): skipped levels, missing h1,
empty headings, including `role="heading"`/`aria-level`. Multiple h1s are not flagged.

### 2. Focus Mode
- Native `<dialog>` + `showModal()` inside a closed shadow root (WXT `createShadowRootUi`,
  `isolateEvents`). The page behind becomes inert for Tab and screen readers; Escape closes; it
  sits in the top layer. Restore focus to the previously focused element on close. `all: initial`
  blocks page CSS. Our host element is the only change to the page and is removed on close.
- Font: `@font-face` inside a shadow root doesn't apply in Chrome, so register the font at page
  level via the FontFace API under a unique family ("VisioFix Atkinson"), loaded from the bundled
  file. If a site blocks it, fall back to system sans-serif. Verify in Phase 4.
- Extraction: Readability on a clone of the document, only when opened. Output goes through our
  allow-list builder: h1–h6 (levels kept), p, ul/ol/li, blockquote, pre/code, figure/figcaption,
  img with alt, links inline in paragraphs, strong/em. Everything else becomes text; no scripts,
  styles or handlers. Fallback for non-articles: headings/paragraphs/lists from
  `main`/`[role=main]`/`article`/`body`, skipping nav/aside/footer by element and role (never
  class substrings), with a visible notice.
- Toolbar: text size, theme, play/pause, speed, close.
- Themes: **High Contrast** (default): bg #000000, H1 #FFFF00, H2 #FFD700, body #FFFFFF,
  links #00FFFF underlined. **Dark**. **Light** (soft off-white, not pure white).

### 3. Read-aloud (Focus Mode only)
- speechSynthesis in the content script. One utterance per sentence (avoids Chrome's ~15s
  cutoff; sentence start/end events drive the highlight). Split with `Intl.Segmenter`.
- Highlight: wrap the sentence in a span in our overlay; background band + underline/outline
  (not color alone); keep it in view (instant scroll under reduced motion). Sentence-level only.
- Pause = cancel + remember the sentence; resume replays it (Chrome's pause/resume is unreliable).
- Voices load async (`voiceschanged`). Default: local voice matching the page's `lang`.
- Start from the top, from a paragraph's play button, or (keyboard) from the first paragraph on
  screen. Previous/next sentence controls.
- Proposed shortcuts (max 4 suggested in Chrome; users rebind at chrome://extensions/shortcuts):
  Alt+Shift+F Focus Mode, Alt+Shift+P play/pause, Alt+Shift+. / Alt+Shift+, next/previous
  sentence. Check conflicts on Windows, macOS, ChromeOS in Phase 5.

### 4. Popup and settings
- Popup and settings follow system light/dark. Font: Atkinson Hyperlegible Next.

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
ring when selected), credits for the font and icons under Privacy.

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

## File structure (planned)
```
src/
  entrypoints/  background.ts · content.ts (→ content/ later) · popup/ · options/ · preview/ (dev-only)
  repair/       engine.ts · changes.ts · names.ts · controls.ts · images.ts · aria.ts · headings.ts
  focus/        model.ts · view.ts · focus.css (Phase 2) · overlay.ts · extract.ts · build.ts
  speech/       sentences.ts · player.ts · highlight.ts
  shared/       site.ts · matches.ts · messages.ts · report.ts · settings.ts
  ui/           tokens.css · base.css · fonts.css · dom.ts · icons.ts (Lucide) · logo.ts · popup/ · options/
  assets/       brand.ts (the icon as data)
preview/        design preview (dev only): index.html · frame.html · sample-data.ts
scripts/        build-icons.mjs · copy-fonts.mjs
public/fonts/   Atkinson Hyperlegible Next woff2 files
public/licenses/ OFL (font) and ISC (Lucide) license texts
public/icon/    16, 32, 48, 128 PNGs (from a detailed SVG and a simplified small-size SVG)
tests/unit/     *.test.ts
tests/fixtures/ legacy-bugs, controls, images (incl. lazy-loaded + hidden), aria, headings,
                dynamic, article, not-article
store/          listing.md · permissions.md · screenshots/
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
- Readability works poorly on home pages, feeds and web apps; the fallback is rough.
- Voice quality depends on the OS; some systems have few local voices.
- Gmail mutates constantly: the main performance risk (measure in Phase 3).

## Progress
- **Phase 1: done (2026-11-16).** Legacy v1 extracted to `legacy/android-v1/` (zip deleted),
  v2 copied to `legacy/android-v2/` (no `.git`). No earlier extension code existed. Node 26 LTS
  installed. WXT scaffold with `srcDir: 'src'`; manifest has only `storage` + http/https host
  access. Placeholder popup pings the content script and shows "running" / "can't run here" /
  "reload this page". `getSiteKey()` in `src/shared/site.ts` with 6 unit tests. Verified the
  production build in headless Chrome 157: service worker starts, content script answers the
  popup, popup renders, no console errors. Not yet tried: `npm run dev` (opens a Chrome window).
  Pushed to GitHub.
- **Phase 2: built (2026-11-16), waiting for the user's approval of the look.** Design system,
  icon (16/32/48/128 PNGs), popup/Focus Mode/settings views with sample data, design preview
  (`npm run design`), contrast tests (104 tests pass). The toolbar popup in the extension is still
  the Phase 1 placeholder; the real popup switches to the new view when it's wired in Phase 3.
  The contrast test caught Focus Mode light's Play button at 6.2:1 and it was darkened to #1546B5.
  Pushed.
- **Phase 2 revision 2: built (2026-11-16), waiting for the user's review and icon choice.**
  User feedback applied: larger type, one card level, navy brand, Lucide icons, motion,
  popup restructure (status, tiles, one number, can't-fix details page), Focus Mode toolbar
  with "Aa" panel + progress + reading time, Chrome-style settings, three icon concepts.
  **Approved 2026-11-16; code eye icon chosen, other concepts removed.**
  Fixed the horizontal-scrollbar bug (fixed-width body + frame scrollbars; now fluid content,
  inner scroll area, ResizeObserver-sized frames) and native controls using the wrong color
  scheme in Focus Mode. 145 tests pass.
