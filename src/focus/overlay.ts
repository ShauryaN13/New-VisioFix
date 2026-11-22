import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { createShadowRootUi, type ShadowRootContentScriptUi } from 'wxt/utils/content-script-ui/shadow-root';
import { OWN_UI_TAG } from '@/repair/engine';
import { focusPrefsItem, type SpeechPrefs, speechPrefsItem } from '@/shared/settings';
import { ReadAloud } from '@/speech/read-aloud';
import { markSentences } from '@/speech/sentences';
import { h } from '@/ui/dom';
import { extractFocusDoc } from './extract';
import focusCss from './focus.css?inline';
import { addFocusFont, removeFocusFont } from './font';
import type { FocusSettings } from './model';
import { type FocusView, renderFocusView, renderLoading } from './view';

/**
 * Opens and closes Focus Mode on the page.
 *
 * Focus Mode is a native <dialog> opened with showModal(), inside a closed
 * shadow root (WXT's createShadowRootUi):
 *   - The dialog sits in the top layer, above everything on the page, and the
 *     page behind it becomes inert: Tab and screen readers stay in Focus Mode.
 *   - Escape closes it (the browser's own dialog behavior).
 *   - The shadow root keeps page CSS out (plus all: initial on the host), and
 *     key presses inside it don't reach the page's keyboard shortcuts.
 *   - The host element <visiofix-ui> is the only change to the page, and it's
 *     removed on close. The repair engine ignores it.
 *   - Focus returns to where it was before Focus Mode opened.
 *
 * Opening happens in two steps, so big pages show they're loading: the
 * dialog opens at once with a loading message (revealed only after 300ms,
 * so quick opens don't flash it), gets painted, and only then is the page's
 * text read (which blocks the page for a moment) and the article shown.
 */

interface Mounted {
  dialog: HTMLDialogElement;
  view: FocusView | null;
  reader: ReadAloud | null;
}

export type ReadAloudAction = 'start' | 'toggle' | 'next' | 'previous';

/** Give up waiting for a frame after this long (a hidden tab doesn't paint). */
const PAINT_WAIT_MS = 100;

export class FocusMode {
  private ui: ShadowRootContentScriptUi<Mounted> | null = null;
  private opening: Promise<void> | null = null;
  private previousFocus: Element | null = null;
  private settings: FocusSettings | null = null;
  private speech: SpeechPrefs | null = null;
  private unwatch: (() => void)[] = [];

  constructor(private readonly ctx: ContentScriptContext) {
    ctx.onInvalidated(() => this.close());
  }

  get isOpen(): boolean {
    return this.ui !== null;
  }

  /** Opens Focus Mode, or closes it if it's open. Resolves to whether it's open now. */
  async toggle(): Promise<boolean> {
    if (this.ui) {
      this.close();
      return false;
    }
    await this.open();
    return this.isOpen;
  }

  /** Opens Focus Mode. If it's already open, moves focus back into it. */
  open(): Promise<void> {
    if (this.ui && !this.opening) {
      this.ui.mounted?.view?.focusTitle();
      return Promise.resolve();
    }
    this.opening ??= this.mount().finally(() => {
      this.opening = null;
    });
    return this.opening;
  }

  /**
   * Read-aloud from outside Focus Mode's toolbar (the popup, keyboard shortcuts).
   * 'start' and 'toggle' open Focus Mode first when it's closed.
   */
  async readAloud(action: ReadAloudAction): Promise<void> {
    if (action === 'next' || action === 'previous') {
      if (this.opening) await this.opening;
      const reader = this.ui?.mounted?.reader;
      if (action === 'next') reader?.next();
      else reader?.previous();
      return;
    }
    const wasOpen = this.isOpen && !this.opening;
    await this.open();
    const reader = this.ui?.mounted?.reader;
    if (action === 'toggle' && wasOpen) reader?.toggle();
    else reader?.start();
  }

  close(): void {
    const ui = this.ui;
    if (!ui) return;
    this.ui = null;
    for (const stop of this.unwatch) stop();
    this.unwatch = [];
    ui.mounted?.reader?.destroy();
    const dialog = ui.mounted?.dialog;
    if (dialog?.open) dialog.close();
    ui.remove();
    removeFocusFont();

    const previous = this.previousFocus;
    this.previousFocus = null;
    if (previous instanceof HTMLElement && previous.isConnected && previous !== document.body) {
      previous.focus({ preventScroll: true });
    }
  }

  private async mount(): Promise<void> {
    const [focusPrefs, speechPrefs] = await Promise.all([focusPrefsItem.getValue(), speechPrefsItem.getValue()]);
    if (this.ctx.isInvalid || !document.documentElement) return;

    this.settings = { theme: focusPrefs.theme, textSize: focusPrefs.textSize, speed: speechPrefs.speed };
    this.speech = speechPrefs;
    this.previousFocus = activeElement();
    addFocusFont();

    // Step 1: the dialog with the loading message.
    const ui = await createShadowRootUi<Mounted>(this.ctx, {
      name: OWN_UI_TAG.toLowerCase(),
      position: 'inline',
      // Outside <body>, so sites whose scripts own the body's children don't trip over it.
      anchor: 'html',
      append: 'last',
      mode: 'closed',
      isolateEvents: true,
      css: focusCss,
      onMount: (container) => {
        const dialog = h(
          'dialog',
          { class: 'vf-dialog', 'aria-label': 'Focus Mode', 'aria-busy': 'true' },
          renderLoading(focusPrefs.theme),
        );
        // Escape (or anything else) closed the dialog: finish closing Focus Mode.
        dialog.addEventListener('close', () => {
          if (this.ui?.mounted?.dialog === dialog) this.close();
        });
        container.append(dialog);
        return { dialog, view: null, reader: null };
      },
      onRemove: (mounted) => mounted?.view?.destroy(),
    });
    if (this.ctx.isInvalid) {
      removeFocusFont();
      return;
    }
    this.ui = ui;
    ui.mount();
    const mounted = ui.mounted;
    if (!mounted) return;
    try {
      mounted.dialog.showModal();
    } catch {
      // The page is being unloaded, or the document can't show dialogs.
      this.close();
      return;
    }

    // Let the loading message get painted before the page is blocked.
    await nextPaint();
    if (this.ui !== ui) return; // closed meanwhile (Escape, the shortcut)

    // Step 2: read the page and show the article.
    try {
      const doc = extractFocusDoc(document);
      const view = renderFocusView(doc, this.settings, false, {
        onClose: () => this.close(),
        onPlayPause: () => mounted.reader?.toggle(),
        onPrevious: () => mounted.reader?.previous(),
        onNext: () => mounted.reader?.next(),
        onReadFrom: (paragraph) => mounted.reader?.readFrom(paragraph),
        onSettingsChange: (next) => this.save(next),
      });
      // Sentences are marked before the article is on screen: no extra layout work.
      const sentences = markSentences(view.article, doc.lang);
      mounted.view = view;
      mounted.reader = new ReadAloud(view, sentences, doc.lang, speechPrefs);
      mounted.dialog.replaceChildren(view.root);
      mounted.dialog.removeAttribute('aria-busy');
      view.focusTitle();
    } catch (error) {
      this.close();
      throw error;
    }

    // Settings changed elsewhere (the settings page, another tab): follow them.
    this.unwatch.push(
      focusPrefsItem.watch((prefs) => this.apply({ ...this.current(), theme: prefs.theme, textSize: prefs.textSize })),
      speechPrefsItem.watch((prefs) => {
        this.speech = prefs;
        this.ui?.mounted?.reader?.setPrefs(prefs);
        this.apply({ ...this.current(), speed: prefs.speed });
      }),
    );
  }

  private current(): FocusSettings {
    return this.settings as FocusSettings;
  }

  private apply(next: FocusSettings): void {
    const now = this.current();
    if (next.theme === now.theme && next.textSize === now.textSize && next.speed === now.speed) return;
    this.settings = next;
    this.ui?.mounted?.view?.setSettings(next);
  }

  /** The reader changed a setting in the "Aa" panel; the view has already applied it. */
  private save(next: FocusSettings): void {
    const before = this.current();
    this.settings = next;
    if (next.theme !== before.theme || next.textSize !== before.textSize) {
      void focusPrefsItem.setValue({ theme: next.theme, textSize: next.textSize });
    }
    if (next.speed !== before.speed && this.speech) {
      this.speech = { ...this.speech, speed: next.speed };
      this.ui?.mounted?.reader?.setPrefs(this.speech);
      void speechPrefsItem.setValue(this.speech);
    }
  }
}

/** Resolves after the next frame has been painted (or shortly, if the tab isn't painting). */
function nextPaint(): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, PAINT_WAIT_MS);
    requestAnimationFrame(() =>
      // rAF runs just before the paint; a task queued from it runs just after.
      setTimeout(() => {
        clearTimeout(timer);
        resolve();
      }, 0),
    );
  });
}

/** The focused element, looking inside open shadow roots (custom elements on the page). */
function activeElement(): Element | null {
  let el = document.activeElement;
  while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
  return el;
}
