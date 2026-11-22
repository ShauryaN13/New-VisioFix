# Privacy practices tab (developer dashboard)

Answers for each field, with the reasoning, so they can be defended if a reviewer asks.
Sources: [Fill out the privacy fields](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy),
[User Data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq),
[Limited Use](https://developer.chrome.com/docs/webstore/program-policies/limited-use).

## Single purpose

> VisioFix makes web pages more accessible for people who use screen readers or have low vision: it
> repairs missing accessibility labels on the pages you visit, and offers a high-contrast reading view
> (Focus Mode) that can read the page aloud.

All three features serve that one purpose; the store's single-purpose rule is about not bundling
unrelated features.

## Permission justifications

The dashboard shows one box per permission in the manifest.

**storage**

> Saves the user's VisioFix settings on their computer (chrome.storage.local, not synced): whether
> automatic repairs are on, the sites where the user paused them, Focus Mode theme and text size, and
> read-aloud voice and speed. Nothing is sent anywhere.

**Host permission** (`http://*/*`, `https://*/*`)

> VisioFix's main feature runs automatically on every page the user visits: it finds buttons, links,
> form fields and images that screen readers can't name and adds the missing label (for example,
> connecting a form field to the label next to it). That needs a content script on all http and https
> pages. The same script opens Focus Mode, a high-contrast reading view of the page, from the toolbar
> button or a keyboard shortcut. VisioFix only adds missing attributes, never deletes content, undoes
> every change when the user pauses it on a site, and sends no data anywhere. activeTab isn't enough
> because repairs have to happen without a click on every page.

Not in the manifest, so no box: `tabs`, `scripting`, `activeTab`, `tts`. Keyboard shortcuts
(`commands`) and the font files (`web_accessible_resources`) are manifest keys, not permissions.

Expect the install warning "Read and change all your data on all websites" and a slower first
review: broad host access always gets an in-depth review.

## Remote code

**No, I am not using remote code.** All JavaScript is in the package (built by WXT); the font and
icons are bundled; nothing is loaded or evaluated from the network.

Checked in the 1.0.0 build: no `eval`, `new Function`, `importScripts`, XMLHttpRequest, WebSocket or
`sendBeacon`. The only two `fetch` calls are in WXT's and Vite's helper code and load the
extension's own files (a stylesheet by `runtime.getURL`, and its own code chunks). The code is
minified by Vite, which the store allows; it isn't obfuscated. The source is in this repository if a
reviewer asks.

## Data usage

**What user data do you plan to collect?** Tick **Website content** only.

Why: the User Data FAQ counts data that is only processed on the user's device as "handled" and
asks for it to be disclosed ("even when data is processed or stored locally on a user's device and
is not transmitted"). VisioFix reads the text and structure of the pages the user visits to repair
them and to build Focus Mode, so website content is the honest box to tick. It never leaves the
computer, and the privacy policy says so.

Left unticked, with the reasoning:

- Personally identifiable information, health, financial and payment, authentication information,
  personal communications, location: never read or stored.
- Web browsing activity: VisioFix doesn't record which pages are visited. The list of sites where
  the user paused repairs is a setting the user makes, kept on their computer, never a history.
  If a reviewer disagrees, ticking it changes nothing about how VisioFix works.
- User activity (clicks, keystrokes): only VisioFix's own keyboard shortcuts and buttons, handled
  when pressed, never logged.

**Certifications:** tick all three (data isn't sold or transferred to third parties, isn't used for
anything unrelated to the single purpose, isn't used for creditworthiness or lending). All true,
because no data leaves the computer.

## Privacy policy URL

The policy is [`PRIVACY.md`](../PRIVACY.md). The dashboard needs a public web address for it, for
example:

- https://github.com/ShauryaN13/New-VisioFix/blob/main/PRIVACY.md (works only if the repository is
  public), or
- a GitHub Pages site, or any page you control, with the same text.

The policy includes the Limited Use statement the store asks for.

## Test instructions tab (optional)

Nothing needed: no account or sign-in. If you want to help the reviewer:

> Open any article (for example a Wikipedia page), click the VisioFix toolbar button to see the
> repairs on that page, then press Focus Mode. In Focus Mode, press Play to hear it read aloud.
