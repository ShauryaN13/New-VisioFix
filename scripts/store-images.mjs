// Makes the Chrome Web Store images from the real extension running in Chrome:
//   store/screenshots/1-read-aloud.png … 5-settings.png  (1280×800)
//   store/promo/small-tile.png                             (440×280)
//
// Run `npm run build` first, then `npm run store-images`. No dependencies: it
// starts Chrome headless and drives it over the DevTools protocol (a pipe).
// Set CHROME_PATH if Chrome isn't in its usual place.
//
// The pages are store/demo/ (a made-up newspaper), served by this script and
// reached as http://riversidecourier.example (Chrome maps that name to this
// computer), so the popup shows a realistic site name. Read-aloud is muted
// (volume 0) while the screenshots are taken.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
// Node runs this TypeScript file directly (type stripping, Node 23.6+), as in build-icons.mjs.
import { ICON, toSvgString } from '../src/assets/brand.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const EXT = join(ROOT, '.output', 'chrome-mv3');
const OUT_SHOTS = join(ROOT, 'store', 'screenshots');
const OUT_PROMO = join(ROOT, 'store', 'promo');
const HOST = 'riversidecourier.example';
const WIDTH = 1280;
const HEIGHT = 800;

const CHROME =
  process.env.CHROME_PATH ??
  {
    win32: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  }[process.platform] ??
  'google-chrome';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

if (!existsSync(join(EXT, 'manifest.json'))) {
  console.error('No build found. Run `npm run build` first.');
  process.exit(1);
}

/* ---------- A small static server: the demo site, fonts, icon, composed frames ---------- */

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};
const MOUNTS = {
  '/demo/': join(ROOT, 'store', 'demo'),
  '/fonts/': join(ROOT, 'public', 'fonts'),
  '/icon/': join(ROOT, 'public', 'icon'),
};
/** Images captured so far, and HTML pages composed from them. */
const memory = new Map();

const server = createServer((req, res) => {
  const path = new URL(req.url ?? '/', 'http://x').pathname;
  const held = memory.get(path);
  if (held) {
    res.writeHead(200, { 'content-type': held.type }).end(held.body);
    return;
  }
  for (const [prefix, dir] of Object.entries(MOUNTS)) {
    if (!path.startsWith(prefix)) continue;
    const file = normalize(join(dir, decodeURIComponent(path.slice(prefix.length))));
    if (!file.startsWith(dir + sep) || !existsSync(file)) break;
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(readFileSync(file));
    return;
  }
  res.writeHead(404).end('Not found');
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const PORT = server.address().port;
const DEMO_URL = `http://${HOST}:${PORT}/demo/article.html`;

/* ---------- Chrome over the DevTools protocol ---------- */

const profile = mkdtempSync(join(tmpdir(), 'visiofix-store-'));
const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--remote-debugging-pipe',
    // Lets the protocol load an unpacked extension (Chrome ignores --load-extension now).
    '--enable-unsafe-extension-debugging',
    `--user-data-dir=${profile}`,
    `--host-resolver-rules=MAP ${HOST} 127.0.0.1`,
    '--no-first-run',
    '--no-default-browser-check',
    '--hide-scrollbars',
    '--force-color-profile=srgb',
    '--lang=en-US',
    `--window-size=${WIDTH},${HEIGHT}`,
  ],
  { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] },
);

let nextId = 0;
const pending = new Map();
const listeners = new Set();
let buffer = '';
chrome.stdio[4].on('data', (chunk) => {
  buffer += chunk.toString('utf8');
  let end;
  while ((end = buffer.indexOf('\0')) !== -1) {
    const message = JSON.parse(buffer.slice(0, end));
    buffer = buffer.slice(end + 1);
    if (message.id === undefined) {
      for (const listener of listeners) listener(message);
      continue;
    }
    const call = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) call?.reject(new Error(`${call.method}: ${message.error.message}`));
    else call?.resolve(message.result);
  }
});
function send(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    nextId += 1;
    pending.set(nextId, { resolve, reject, method });
    chrome.stdio[3].write(JSON.stringify({ id: nextId, method, params, sessionId }) + '\0');
  });
}

async function attach(targetId) {
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const s = (method, params) => send(method, params, sessionId);
  return {
    send: s,
    async evaluate(expression, contextId) {
      const r = await s('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, contextId });
      if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 500));
      return r.result.value;
    },
    async screenshot(clip) {
      // captureBeyondViewport: real Chrome grows the popup window with its content (up to
      // 600px); headless doesn't, so render the whole document and crop to the content.
      const { data } = await s('Page.captureScreenshot', {
        format: 'png',
        ...(clip ? { clip: { ...clip, scale: 1 }, captureBeyondViewport: true } : {}),
      });
      return Buffer.from(data, 'base64');
    },
    async click(x, y) {
      for (const type of ['mousePressed', 'mouseReleased']) {
        await s('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
      }
    },
  };
}

/** Opens a tab at the store's screenshot size and waits for it to load. */
async function openTab(url, { colorScheme = 'light', reducedMotion = false } = {}) {
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const tab = await attach(targetId);
  tab.targetId = targetId;
  tab.contexts = new Map();
  listeners.add((m) => {
    if (m.method === 'Runtime.executionContextCreated') tab.contexts.set(m.params.context.id, m.params.context);
  });
  await tab.send('Runtime.enable');
  await tab.send('Page.enable');
  await tab.send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false });
  await emulate(tab, colorScheme, reducedMotion);
  const loaded = new Promise((resolve) => {
    const onLoad = (m) => {
      if (m.method === 'Page.loadEventFired') {
        listeners.delete(onLoad);
        resolve();
      }
    };
    listeners.add(onLoad);
  });
  await tab.send('Page.navigate', { url });
  await Promise.race([loaded, sleep(15000)]);
  await tab.send('Page.bringToFront');
  return tab;
}

function emulate(target, colorScheme, reducedMotion = false) {
  return target.send('Emulation.setEmulatedMedia', {
    features: [
      { name: 'prefers-color-scheme', value: colorScheme },
      { name: 'prefers-reduced-motion', value: reducedMotion ? 'reduce' : 'no-preference' },
    ],
  });
}

/* ---------- Helpers for Focus Mode (inside a closed shadow root; the protocol can reach it) ---------- */

async function focusShadowRoot(tab) {
  const { root } = await tab.send('DOM.getDocument', { depth: -1, pierce: true });
  const find = (node) => {
    if (node.localName === 'visiofix-ui') return node;
    for (const child of [...(node.children ?? []), ...(node.shadowRoots ?? [])]) {
      const hit = find(child);
      if (hit) return hit;
    }
    return null;
  };
  const shadow = find(root)?.shadowRoots?.[0];
  if (!shadow) throw new Error('Focus Mode is not open');
  return shadow.nodeId;
}

async function focusQuery(tab, selector) {
  const { nodeId } = await tab.send('DOM.querySelector', { nodeId: await focusShadowRoot(tab), selector });
  if (!nodeId) throw new Error(`Not found in Focus Mode: ${selector}`);
  return nodeId;
}

async function clickInFocus(tab, selector) {
  const { model } = await tab.send('DOM.getBoxModel', { nodeId: await focusQuery(tab, selector) });
  const [x1, y1, , , x3, y3] = model.content;
  await tab.click((x1 + x3) / 2, (y1 + y3) / 2);
}

async function callOn(tab, selector, fn) {
  const { object } = await tab.send('DOM.resolveNode', { nodeId: await focusQuery(tab, selector) });
  await tab.send('Runtime.callFunctionOn', { objectId: object.objectId, functionDeclaration: fn.toString() });
}

/* ---------- Composed images (popup frame, promo tile) ---------- */

const FONT_FACES = [400, 700]
  .map(
    (weight) =>
      `@font-face { font-family: 'Atkinson Hyperlegible Next'; font-weight: ${weight};
        src: url('/fonts/atkinson-hyperlegible-next-latin-${weight}-normal.woff2') format('woff2'); }`,
  )
  .join('\n');

function page(width, height, body, css) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>
    ${FONT_FACES}
    html, body { margin: 0; width: ${width}px; height: ${height}px; overflow: hidden; }
    body { font-family: 'Atkinson Hyperlegible Next', sans-serif; background: #0b1f4d; color: #fff; }
    ${css}
  </style></head><body>${body}</body></html>`;
}

async function renderComposite(name, width, height, html) {
  memory.set(`/frame/${name}.html`, { type: TYPES['.html'], body: html });
  const tab = await openTab(`http://127.0.0.1:${PORT}/frame/${name}.html`);
  await tab.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  await tab.evaluate('document.fonts.ready.then(() => Promise.all([...document.images].map((i) => i.decode())))');
  const png = await tab.screenshot({ x: 0, y: 0, width, height });
  await send('Target.closeTarget', { targetId: tab.targetId });
  return png;
}

/* ---------- The shots ---------- */

const shots = {};
try {
  for (let i = 0; i < 50; i++) {
    try {
      await Promise.race([send('Browser.getVersion'), sleep(500).then(() => Promise.reject(new Error('timeout')))]);
      break;
    } catch {
      await sleep(200);
    }
  }
  console.log('Loading VisioFix in headless Chrome…');
  const { id: extId } = await send('Extensions.loadUnpacked', { path: EXT });

  // The service worker, for chrome.* calls (storage, tabs, opening the popup).
  // Right after loading, it can be attached before its chrome.* APIs exist: wait for them.
  let worker;
  for (let i = 0; i < 50 && !worker; i++) {
    const { targetInfos } = await send('Target.getTargets');
    const sw = targetInfos.find((t) => t.type === 'service_worker' && t.url.startsWith(`chrome-extension://${extId}/`));
    if (sw) {
      const candidate = await attach(sw.targetId);
      const ready = await Promise.race([
        candidate.evaluate('typeof chrome !== "undefined" && !!chrome.storage').catch(() => false),
        sleep(2000).then(() => false),
      ]);
      if (ready) worker = candidate;
    }
    if (!worker) await sleep(200);
  }
  if (!worker) throw new Error('The extension did not start');
  const setFocusPrefs = (theme) =>
    worker.evaluate(`chrome.storage.local.set({ focus: { theme: '${theme}', textSize: 22 } })`);
  await worker.evaluate('chrome.storage.local.clear()');

  const demo = await openTab(DEMO_URL, { reducedMotion: true });
  await sleep(2000); // let the repairs finish
  const tabId = await worker.evaluate(
    `chrome.tabs.query({}).then((tabs) => tabs.find((t) => t.url === ${JSON.stringify(DEMO_URL)})?.id)`,
  );
  if (tabId === undefined) throw new Error('Demo tab not found');
  const message = (m) => worker.evaluate(`chrome.tabs.sendMessage(${tabId}, ${JSON.stringify(m)}).catch(() => null)`);

  console.log('Popup…');
  // --- Popup: main view with "See what changed" open, then the "can't fix" page ---
  await worker.evaluate(`chrome.tabs.update(${tabId}, { active: true }).then(() => chrome.action.openPopup())`);
  let popupTarget;
  for (let i = 0; i < 30 && !popupTarget; i++) {
    const { targetInfos } = await send('Target.getTargets');
    popupTarget = targetInfos.find((t) => t.url.endsWith('/popup.html'));
    if (!popupTarget) await sleep(200);
  }
  if (!popupTarget) throw new Error('The popup did not open');
  const popup = await attach(popupTarget.targetId);
  await popup.send('Page.enable');
  await emulate(popup, 'light');
  await sleep(1000);
  const popupSize = () =>
    popup.evaluate(
      `document.fonts.ready.then(() => { const r = document.querySelector('.popup').getBoundingClientRect(); return { x: 0, y: 0, width: 360, height: Math.ceil(r.height) }; })`,
    );
  await popup.evaluate(`document.querySelector('.fix-details').open = true; document.activeElement?.blur(); true`);
  await sleep(300);
  const popupMain = await popup.screenshot(await popupSize());
  await popup.evaluate(`document.querySelector('[data-focus-key="open-issues"]').click(); document.activeElement?.blur(); true`);
  await sleep(300);
  const popupIssues = await popup.screenshot(await popupSize());
  await send('Target.closeTarget', { targetId: popupTarget.targetId }).catch(() => undefined);

  memory.set('/shot/popup-main.png', { type: TYPES['.png'], body: popupMain });
  memory.set('/shot/popup-issues.png', { type: TYPES['.png'], body: popupIssues });
  shots['2-popup'] = await renderComposite(
    'popup',
    WIDTH,
    HEIGHT,
    page(
      WIDTH,
      HEIGHT,
      `<h1>See what VisioFix fixed, and what it can’t</h1>
       <p>It only adds what a page is missing, never removes anything, and one switch puts a site back as it was.</p>
       <div class="shots"><img src="/shot/popup-main.png" alt=""><img src="/shot/popup-issues.png" alt=""></div>`,
      `body { display: grid; justify-items: center; align-content: start; padding-top: 44px; box-sizing: border-box; }
       h1 { margin: 0; font-size: 36px; line-height: 1.2; }
       p { margin: 12px 0 0; font-size: 20px; color: #c9d6f2; }
       .shots { display: flex; gap: 40px; align-items: flex-start; margin-top: 36px; }
       .shots img { border-radius: 12px; box-shadow: 0 12px 40px rgb(0 0 0 / 45%); }`,
    ),
  );

  console.log('Focus Mode…');
  // --- Focus Mode, High contrast, reading aloud (muted) with the sentence highlighted ---
  await send('Target.activateTarget', { targetId: demo.targetId });
  await demo.send('Page.bringToFront');
  await setFocusPrefs('contrast');
  // Chrome only lets a page speak after a click or key press in it.
  const byline = await demo.evaluate(
    `(() => { const r = document.querySelector('.byline').getBoundingClientRect(); return { x: r.left + 20, y: r.top + r.height / 2 }; })()`,
  );
  await demo.click(byline.x, byline.y);
  const isolated = [...demo.contexts.values()].find((c) => c.auxData?.type === 'isolated' && c.name === 'VisioFix');
  if (!isolated) throw new Error("VisioFix's content script isn't running on the demo page");
  await demo.evaluate(
    `(() => { const speak = speechSynthesis.speak.bind(speechSynthesis);
       speechSynthesis.speak = (u) => { u.volume = 0; speak(u); }; return true; })()`,
    isolated.id,
  );
  await message({ type: 'visiofix:speech', action: 'start' });
  await sleep(3000); // the first Play can wait for Chrome's list of local voices
  for (let i = 0; i < 2; i++) {
    await message({ type: 'visiofix:speech', action: 'next' });
    await sleep(400);
  }
  await sleep(600);
  shots['1-read-aloud'] = await demo.screenshot();
  await message({ type: 'visiofix:speech', action: 'toggle' }); // pause
  await message({ type: 'visiofix:focus', action: 'close' });
  await sleep(500);

  // --- Focus Mode, Light theme, reading settings ("Aa") open ---
  await setFocusPrefs('light');
  await message({ type: 'visiofix:focus', action: 'open' });
  await sleep(1200);
  await clickInFocus(demo, '.vf-aa');
  await sleep(400);
  shots['3-focus-mode-settings'] = await demo.screenshot();
  await message({ type: 'visiofix:focus', action: 'close' });
  await sleep(500);

  // --- Focus Mode, Dark theme, scrolled to the photo and the list ---
  await setFocusPrefs('dark');
  await message({ type: 'visiofix:focus', action: 'open' });
  await sleep(1200);
  await callOn(demo, '.vf-article figure', function () {
    this.scrollIntoView({ block: 'start' });
  });
  await callOn(demo, '.vf-scroll', function () {
    this.scrollTop -= 32;
  });
  await sleep(400);
  shots['4-focus-mode-dark'] = await demo.screenshot();
  await message({ type: 'visiofix:focus', action: 'close' });
  await setFocusPrefs('contrast');

  console.log('Settings…');
  // --- Settings page, dark mode ---
  const settings = await openTab(`chrome-extension://${extId}/options.html`, { colorScheme: 'dark' });
  await sleep(3000); // voices arrive in two steps
  shots['5-settings'] = await settings.screenshot();

  // --- Small promo tile: the icon's drawing (its navy tile matches the background) ---
  const promo = await renderComposite(
    'promo',
    440,
    280,
    page(
      440,
      280,
      `${toSvgString(ICON.detailed, '0 0 128 128', 176)}
       <div><h1>VisioFix</h1><p>Repairs pages<br>Focus Mode<br>Read aloud</p></div>`,
      `body { display: flex; align-items: center; justify-content: center; gap: 4px; padding-right: 16px; box-sizing: border-box; }
       svg { flex: none; }
       h1 { margin: 0; font-size: 48px; line-height: 1.05; }
       p { margin: 12px 0 0; font-size: 19px; line-height: 1.35; color: #c9d6f2; }`,
    ),
  );

  mkdirSync(OUT_SHOTS, { recursive: true });
  mkdirSync(OUT_PROMO, { recursive: true });
  for (const [name, png] of Object.entries(shots).sort()) {
    writeFileSync(join(OUT_SHOTS, `${name}.png`), png);
    console.log(`store/screenshots/${name}.png`);
  }
  writeFileSync(join(OUT_PROMO, 'small-tile.png'), promo);
  console.log('store/promo/small-tile.png');
} finally {
  chrome.kill();
  server.close();
  await sleep(500);
  try {
    rmSync(profile, { recursive: true, force: true });
  } catch {
    // Chrome may still hold a file for a moment; the OS cleans its temp folder.
  }
}
