import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { createShadowRootUi, type ShadowRootContentScriptUi } from 'wxt/utils/content-script-ui/shadow-root';
import { OWN_UI_TAG } from '@/repair/engine';
import { focusPrefsItem, speechPrefsItem } from '@/shared/settings';
import { h } from '@/ui/dom';
import { extractFocusDoc } from './extract';
import focusCss from './focus.css?inline';
import { addFocusFont, removeFocusFont } from './font';
import type { FocusSettings } from './model';
import { type FocusView, renderFocusView } from './view';

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
 * Read-aloud (Play, previous, next) is wired up in Phase 5.
 */

interface Mounted {
  dialog: HTMLDialogElement;
  view: FocusView;
}

export class FocusMode {
  private ui: ShadowRootContentScriptUi<Mounted> | null = null;
  private opening: Promise<void> | null = null;
  private previousFocus: Element | null = null;
  private settings: FocusSettings | null = null;
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
    if (this.ui) {
      this.ui.mounted?.view.focusTitle();
      return Promise.resolve();
    }
    this.opening ??= this.mount().finally(() => {
      this.opening = null;
    });
    return this.opening;
  }

  close(): void {
    const ui = this.ui;
    if (!ui) return;
    this.ui = null;
    for (const stop of this.unwatch) stop();
    this.unwatch = [];
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

    const doc = extractFocusDoc(document);
    this.settings = { theme: focusPrefs.theme, textSize: focusPrefs.textSize, speed: speechPrefs.speed };
    this.previousFocus = activeElement();
    addFocusFont();

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
        const view = renderFocusView(doc, this.settings as FocusSettings, false, {
          onClose: () => this.close(),
          onPlayPause: () => undefined, // Phase 5
          onPrevious: () => undefined, // Phase 5
          onNext: () => undefined, // Phase 5
          onSettingsChange: (next) => this.save(next),
        });
        const dialog = h('dialog', { class: 'vf-dialog', 'aria-label': 'Focus Mode' }, view.root);
        // Escape (or anything else) closed the dialog: finish closing Focus Mode.
        dialog.addEventListener('close', () => {
          if (this.ui?.mounted?.dialog === dialog) this.close();
        });
        container.append(dialog);
        return { dialog, view };
      },
      onRemove: (mounted) => mounted?.view.destroy(),
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
    mounted.view.focusTitle();

    // Settings changed elsewhere (the settings page, another tab): follow them.
    this.unwatch.push(
      focusPrefsItem.watch((prefs) => this.apply({ ...this.current(), theme: prefs.theme, textSize: prefs.textSize })),
      speechPrefsItem.watch((prefs) => this.apply({ ...this.current(), speed: prefs.speed })),
    );
  }

  private current(): FocusSettings {
    return this.settings as FocusSettings;
  }

  private apply(next: FocusSettings): void {
    const now = this.current();
    if (next.theme === now.theme && next.textSize === now.textSize && next.speed === now.speed) return;
    this.settings = next;
    this.ui?.mounted?.view.setSettings(next);
  }

  /** The reader changed a setting in the "Aa" panel; the view has already applied it. */
  private save(next: FocusSettings): void {
    const before = this.current();
    this.settings = next;
    if (next.theme !== before.theme || next.textSize !== before.textSize) {
      void focusPrefsItem.setValue({ theme: next.theme, textSize: next.textSize });
    }
    if (next.speed !== before.speed) {
      void speechPrefsItem.getValue().then((prefs) => speechPrefsItem.setValue({ ...prefs, speed: next.speed }));
    }
  }
}

/** The focused element, looking inside open shadow roots (custom elements on the page). */
function activeElement(): Element | null {
  let el = document.activeElement;
  while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
  return el;
}
