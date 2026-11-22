# Chrome Web Store listing (Store listing tab)

Copy each field into the developer dashboard. The store shows the description as plain text, so it
has no Markdown. Edge users install from the Chrome Web Store too; no separate Edge listing is needed.

## Product details

**Name** (from the manifest): VisioFix

**Summary** (from the manifest `description`, 113 of 132 characters):

> Repairs common accessibility problems on the pages you visit and adds a high-contrast Focus Mode with read-aloud.

**Category:** Accessibility

**Language:** English (United States)

**Description:**

```text
VisioFix makes web pages easier to use with a screen reader or low vision. It does three things:

1. Repairs pages automatically
Many sites have buttons, links, form fields and images that screen readers can't name. VisioFix adds what's missing, using only what the page itself provides: a field's nearby label, a photo's caption, a link's address. It never guesses. What it can't fix safely, it lists in the popup instead.

2. Focus Mode
One click (or Alt+Shift+F) shows the article you're reading in a clean reading view: High contrast (yellow and white on black), Dark or Light, with the Atkinson Hyperlegible Next font, adjustable text size, and the page's headings, lists, tables, quotes and captioned pictures kept. Menus, ads and pop-ups are left out.

3. Read aloud
Focus Mode reads the article to you, highlighting each sentence as it's read and keeping it in view. Start from the top or from any paragraph, skip forward or back by sentence, and choose the voice and speed. It only starts when you press Play.

Not an "accessibility overlay"
Overlays are scripts a website adds for every visitor, and they have a bad reputation with screen reader users because they often break pages. VisioFix is different: you install it, and it follows strict do-no-harm rules.
- It never deletes page content. It only adds what's missing and never overrides what the page's author wrote.
- Every change is marked and reversible. Pausing VisioFix on a site puts the page back exactly as the site made it.
- It never speaks on its own, and it shows its status instead of announcing it.

Private by design
- Everything happens on your computer. No analytics, no accounts, no data collection, no remote code.
- Settings stay in this browser (not synced).
- Read-aloud uses the voices installed on your computer. Online voices, which send the text to Google or Microsoft, are off unless you turn them on.

Keyboard shortcuts (change them at chrome://extensions/shortcuts)
- Alt+Shift+F: open or close Focus Mode
- Alt+Shift+K: play or pause reading
- Alt+Shift+. and Alt+Shift+, : next and previous sentence
- Escape: close Focus Mode
On a Mac, use Control+Shift instead of Alt+Shift.

Good to know
- VisioFix can't change Chrome's own pages or the Chrome Web Store, and tabs that were open before you installed it need to be reloaded once.
- Focus Mode works best on articles. On home pages, feeds and web apps it shows the page's main content with a note that it may not be an article.
- Icon-only buttons and pictures with no caption usually can't be named without guessing, so VisioFix reports them rather than making something up.
- Read-aloud needs a voice for the page's language installed on your computer.

VisioFix's own popup, settings and Focus Mode are designed for screen readers and keyboard-only use: every control is labeled and reachable with Tab, focus is always visible, and they follow high zoom, reduced motion and Windows contrast themes.
```

Before submitting, run the screen reader part of `store/test-checklist.md`. If it passes, the last
paragraph can name the screen readers that were tried (for example "Tested with NVDA and Narrator").

## Graphic assets

| Field | File | Notes |
|---|---|---|
| Store icon (128×128) | `public/icon/128.png` | 96px tile with 16px transparent padding, as the store asks |
| Screenshot 1 | `store/screenshots/1-read-aloud.png` | Focus Mode, High contrast, reading aloud with the sentence highlighted |
| Screenshot 2 | `store/screenshots/2-popup.png` | Popup: fixes on the page, and what VisioFix can't fix safely |
| Screenshot 3 | `store/screenshots/3-focus-mode-settings.png` | Focus Mode, Light theme, reading settings open |
| Screenshot 4 | `store/screenshots/4-focus-mode-dark.png` | Focus Mode, Dark theme, a captioned picture and headings |
| Screenshot 5 | `store/screenshots/5-settings.png` | Settings page in dark mode |
| Small promo tile (440×280) | `store/promo/small-tile.png` | Optional, but it's what the store shows in search and category pages |
| Marquee (1400×560) | none | Optional; only used if the store features the extension |

All screenshots are 1280×800 and come from the real extension in Chrome on a made-up news page
(`store/demo/`). To make them again after a UI change: `npm run build`, then `npm run store-images`.

## Additional fields

- **Official URL:** none (needs a verified site in Google Search Console).
- **Homepage URL:** https://github.com/ShauryaN13/New-VisioFix
- **Support URL:** https://github.com/ShauryaN13/New-VisioFix/issues
- **Mature content:** No.

The privacy policy address goes in the Privacy practices tab (see `store/permissions.md`):
https://github.com/ShauryaN13/New-VisioFix/blob/main/PRIVACY.md

## Distribution tab

- **Payments:** Free.
- **Visibility:** Public (or Unlisted for a soft launch: installable by link, not in search).
- **Regions:** All regions.
