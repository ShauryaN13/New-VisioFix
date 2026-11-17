import type { NotFixedCounts, PageReport } from '@/shared/report';
import { ChangeLog, TAG_ATTR } from './changes';
import { checkHeadings } from './headings';
import { evaluate, type Fix, type IssueKind, type RuleContext } from './rules';

/**
 * The repair engine: walks the page, applies the rules, and keeps up with
 * content that loads later.
 *
 * How it stays fast on heavy pages:
 *   - Work happens in small slices (about 8ms) during idle time, so the page
 *     never freezes, even on a first scan of tens of thousands of elements.
 *   - New content is collected from a MutationObserver and handled in
 *     batches: 250ms after the last change, or at most 1s after the first.
 *   - Each element is checked once (a WeakSet remembers it) and again only
 *     when something about it changes.
 *
 * How it stays safe:
 *   - Every change goes through the ChangeLog, so stop() undoes all of them.
 *   - VisioFix's own attribute changes are dropped from the observer queue
 *     right after they're made, so they never trigger more work.
 *   - If the site later sets an attribute VisioFix had set, the site wins and
 *     VisioFix forgets its change.
 */

export interface EngineOptions {
  /** Called after a batch of work that changed fixes or issues. */
  onChange?: () => void;
  debounceMs?: number;
  maxWaitMs?: number;
  sliceMs?: number;
}

export interface EngineStats {
  elementsChecked: number;
  slices: number;
  /** Total main-thread time spent, in ms. */
  totalMs: number;
  /** Longest single slice, in ms. Should stay under ~16ms (one frame). */
  longestSliceMs: number;
}

/** Attributes whose changes can change a repair decision. */
const WATCHED_ATTRIBUTES = [
  'alt',
  'aria-label',
  'aria-labelledby',
  'aria-describedby',
  'aria-hidden',
  'role',
  'title',
  'href',
  'src', // images whose source is set later by a script
  'tabindex',
  'hidden',
  'inert',
];

/** Subtrees never worth walking. */
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'HEAD']);
/** VisioFix's own UI (Focus Mode, Phase 4) lives in this element. */
export const OWN_UI_TAG = 'VISIOFIX-UI';

/** When content changes inside one of these, the element itself needs a new look. */
const NAME_HOLDERS = 'a[href], button, label, figure, [role="button"], [role="link"], .wp-caption';

type IdleHandle = { cancel(): void };

export class RepairEngine {
  private readonly changes = new ChangeLog();
  private readonly issues = new Map<Element, IssueKind[]>();
  private seen = new WeakSet<Element>();
  /** Subtrees to walk. true = check every element again, even ones already checked. */
  private readonly roots = new Map<Element, boolean>();
  private readonly singles = new Set<Element>();
  private walker: TreeWalker | null = null;
  private walkerForced = false;
  private observer: MutationObserver | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private firstQueuedAt = 0;
  private idle: IdleHandle | null = null;
  private dirty = false;
  private idCounter = 0;
  private readonly loadListeners = new Map<HTMLImageElement, () => void>();
  /** Fixes decided in this slice, written all at once at its end (no style reads between writes). */
  private pending: { owner: Element; fix: Fix }[] = [];
  private readonly opts: Required<EngineOptions>;
  private readonly ctx: RuleContext;

  readonly stats: EngineStats = { elementsChecked: 0, slices: 0, totalMs: 0, longestSliceMs: 0 };

  constructor(
    private readonly doc: Document,
    options: EngineOptions = {},
  ) {
    this.opts = {
      onChange: options.onChange ?? (() => {}),
      debounceMs: options.debounceMs ?? 250,
      maxWaitMs: options.maxWaitMs ?? 1000,
      sliceMs: options.sliceMs ?? 8,
    };
    this.ctx = {
      doc,
      newId: (prefix) => {
        let id: string;
        do {
          this.idCounter += 1;
          id = `${prefix}-${this.idCounter}`;
        } while (doc.getElementById(id));
        return id;
      },
      ourValue: (el, attr) =>
        this.changes.valueOf(el, attr) ?? this.pending.find((p) => p.fix.el === el && p.fix.attr === attr)?.fix.value ?? null,
    };
  }

  get running(): boolean {
    return this.observer !== null;
  }

  start(): void {
    if (this.running) return;
    this.observer = new MutationObserver((records) => this.enqueue(records, true));
    this.observer.observe(this.doc, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: WATCHED_ATTRIBUTES,
      attributeOldValue: false,
    });
    this.addRoot(this.doc.documentElement, false);
    this.schedule(true);
  }

  /** Stop watching and undo every change. The page is back to how the site made it. */
  stop(): void {
    if (!this.running) return;
    this.observer?.disconnect();
    this.observer = null;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.idle?.cancel();
    this.idle = null;
    for (const [img, listener] of this.loadListeners) img.removeEventListener('load', listener);
    this.loadListeners.clear();
    this.pending = [];
    this.changes.revertAll();
    this.issues.clear();
    this.roots.clear();
    this.singles.clear();
    this.walker = null;
    this.seen = new WeakSet();
    this.opts.onChange();
  }

  /** Check every element again, as if new (used to prove that a second pass changes nothing). */
  rescan(): void {
    if (!this.running) return;
    this.seen = new WeakSet();
    this.walker = null;
    this.addRoot(this.doc.documentElement, false);
    this.schedule(true);
  }

  /** Do all pending work now, without time slicing. For tests only: on a heavy page it would block. */
  flush(): void {
    if (!this.running) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.idle?.cancel();
    this.idle = null;
    this.work(Number.POSITIVE_INFINITY);
  }

  report(): PageReport {
    const notFixed: NotFixedCounts = {
      unnamedControls: 0,
      imagesNeedDescription: 0,
      invalidRoles: 0,
      brokenReferences: 0,
      hiddenFocusable: 0,
    };
    for (const [el, kinds] of this.issues) {
      if (!el.isConnected) {
        this.issues.delete(el);
        continue;
      }
      for (const kind of kinds) notFixed[kind] += 1;
    }
    return { fixes: this.changes.counts(), notFixed, headings: checkHeadings(this.doc) };
  }

  /* ---------------- Queue ---------------- */

  private enqueue(records: MutationRecord[], schedule: boolean): void {
    if (!this.running) return;
    for (const record of records) {
      const target = record.target;
      if (record.type === 'childList') {
        for (const node of record.addedNodes) {
          if (node instanceof Element && node.tagName !== OWN_UI_TAG) this.addRoot(node, false);
        }
        // Text or children changed inside a link/button/label/figure: its name may have changed.
        const holder = target instanceof Element ? target.closest(NAME_HOLDERS) : target.parentElement?.closest(NAME_HOLDERS);
        if (holder) this.singles.add(holder);
      } else if (record.type === 'attributes' && target instanceof Element) {
        const attr = record.attributeName ?? '';
        const ours = this.changes.valueOf(target, attr);
        // The site set an attribute VisioFix had set: the site wins.
        if (ours !== null && target.getAttribute(attr) !== ours) this.changes.forget(target, attr);
        this.singles.add(target);
        // Hiding or showing a subtree changes every element inside it.
        if (attr === 'aria-hidden' || attr === 'hidden' || attr === 'inert') this.addRoot(target, true);
        // A changed link may change its image's decision, and the other way round.
        const holder = target.parentElement?.closest(NAME_HOLDERS);
        if (holder) this.singles.add(holder);
      }
    }
    if (schedule && (this.roots.size || this.singles.size)) this.schedule(false);
  }

  /** Debounce: wait for changes to settle, but never longer than maxWait. */
  private schedule(immediate: boolean): void {
    const now = performance.now();
    if (this.timer) {
      if (now - this.firstQueuedAt >= this.opts.maxWaitMs) return; // let the pending timer fire
      clearTimeout(this.timer);
    } else {
      this.firstQueuedAt = now;
    }
    const delay = immediate ? 0 : Math.min(this.opts.debounceMs, Math.max(0, this.opts.maxWaitMs - (now - this.firstQueuedAt)));
    this.timer = setTimeout(() => {
      this.timer = null;
      this.runWhenIdle();
    }, delay);
  }

  private runWhenIdle(): void {
    if (this.idle || !this.running) return;
    this.idle = requestIdle(() => {
      this.idle = null;
      const finished = this.work(this.opts.sliceMs);
      if (!finished) this.runWhenIdle();
    });
  }

  /* ---------------- Work ---------------- */

  /** Process queued work for up to `budgetMs`. Returns true when the queue is empty. */
  private work(budgetMs: number): boolean {
    if (!this.running) return true;
    const started = performance.now();
    const deadline = started + budgetMs;
    // Page changes that arrived since the last batch, before VisioFix writes anything.
    this.enqueue(this.observer?.takeRecords() ?? [], false);

    let finished = true;
    for (const el of [...this.singles]) {
      this.singles.delete(el);
      if (el.isConnected) this.recheck(el);
      if (performance.now() > deadline) {
        finished = false;
        break;
      }
    }

    while (finished) {
      if (!this.walker) {
        const next = this.roots.entries().next();
        if (next.done) break;
        const [rootEl, forced] = next.value;
        this.roots.delete(rootEl);
        if (!rootEl.isConnected) continue;
        this.walkerForced = forced;
        this.walker = this.doc.createTreeWalker(rootEl, NodeFilter.SHOW_ELEMENT, {
          acceptNode: (node) => {
            const tag = (node as Element).tagName;
            return SKIP_TAGS.has(tag) || tag === OWN_UI_TAG ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
          },
        });
        this.visit(this.walker.currentNode as Element);
      }
      let node = this.walker.nextNode();
      let count = 0;
      while (node) {
        this.visit(node as Element);
        // Checking the clock costs a little time too; do it every 8 elements.
        count += 1;
        if ((count & 7) === 0 && performance.now() > deadline) break;
        node = this.walker.nextNode();
      }
      if (node) {
        finished = false;
        break;
      }
      this.walker = null;
    }

    this.applyPending();

    const elapsed = performance.now() - started;
    this.stats.slices += 1;
    this.stats.totalMs += elapsed;
    this.stats.longestSliceMs = Math.max(this.stats.longestSliceMs, elapsed);

    if (finished && this.dirty) {
      this.dirty = false;
      this.opts.onChange();
    }
    return finished && this.roots.size === 0 && this.singles.size === 0;
  }

  private visit(el: Element): void {
    if (this.walkerForced) this.recheck(el);
    else if (!this.seen.has(el)) this.check(el);
  }

  private addRoot(el: Element, forced: boolean): void {
    this.roots.set(el, forced || (this.roots.get(el) ?? false));
  }

  /** Something about an element changed: undo VisioFix's changes on it and decide again. */
  private recheck(el: Element): void {
    if (this.changes.owns(el)) {
      this.write(() => this.changes.revertOwnedBy(el));
      this.dirty = true;
    }
    this.check(el);
  }

  private check(el: Element): void {
    this.seen.add(el);
    this.stats.elementsChecked += 1;
    const result = evaluate(el, this.ctx);

    if (result.fixes.length) {
      for (const fix of result.fixes) this.pending.push({ owner: el, fix });
      this.dirty = true;
    }

    const before = this.issues.get(el);
    if (result.issues.length) this.issues.set(el, result.issues);
    else this.issues.delete(el);
    if ((before?.join() ?? '') !== result.issues.join()) this.dirty = true;

    if (result.waitForLoad) this.whenLoaded(result.waitForLoad);
  }

  private applyPending(): void {
    if (this.pending.length === 0) return;
    const batch = this.pending;
    this.pending = [];
    this.write(() => {
      for (const { owner, fix } of batch) this.changes.set(owner, fix.el, fix.attr, fix.value, fix.kind);
    });
  }

  private whenLoaded(img: HTMLImageElement): void {
    if (this.loadListeners.has(img)) return;
    const listener = () => {
      img.removeEventListener('load', listener);
      this.loadListeners.delete(img);
      if (!this.running) return;
      this.singles.add(img);
      this.schedule(false);
    };
    this.loadListeners.set(img, listener);
    img.addEventListener('load', listener);
  }

  /**
   * Make DOM changes without reacting to them. Queued page changes are moved
   * into the work queue first; whatever the observer records after that is
   * VisioFix's own and is dropped.
   */
  private write(change: () => void): void {
    this.enqueue(this.observer?.takeRecords() ?? [], false);
    change();
    this.observer?.takeRecords();
  }
}

/** requestIdleCallback where available (Chrome), a zero-delay timer elsewhere (tests). */
function requestIdle(callback: () => void): IdleHandle {
  if (typeof requestIdleCallback === 'function') {
    const handle = requestIdleCallback(callback, { timeout: 1000 });
    return { cancel: () => cancelIdleCallback(handle) };
  }
  const handle = setTimeout(callback, 0);
  return { cancel: () => clearTimeout(handle) };
}

export { TAG_ATTR };
