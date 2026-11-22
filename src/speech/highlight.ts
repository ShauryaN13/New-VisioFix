import type { MarkedSentence } from './sentences';

/**
 * Shows which sentence is being read: the "is-current" class on its spans
 * (a background band plus an underline in focus.css, so it never depends on
 * color alone), and keeps it in view.
 *
 * Scrolling follows the reading, except for a few seconds after the reader
 * scrolls on their own (they may be looking ahead). Under reduced motion the
 * jump is instant instead of smooth.
 */

/** Keep the sentence between these fractions of the visible height; outside it, scroll. */
const COMFORT_TOP = 0.1;
const COMFORT_BOTTOM = 0.8;
/** Where a sentence lands after scrolling, as a fraction of the visible height. */
const LAND_AT = 0.3;
/** After the reader scrolls, don't follow for this long. */
const USER_SCROLL_PAUSE_MS = 5000;

const SCROLL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ']);

export class Highlighter {
  private current: number | null = null;
  private userScrolledAt = 0;
  private readonly onUserScroll = () => {
    this.userScrolledAt = Date.now();
  };
  private readonly onKey = (event: KeyboardEvent) => {
    if (SCROLL_KEYS.has(event.key)) this.onUserScroll();
  };

  constructor(
    private readonly scroller: HTMLElement,
    private readonly sentences: readonly MarkedSentence[],
  ) {
    scroller.addEventListener('wheel', this.onUserScroll, { passive: true });
    scroller.addEventListener('touchmove', this.onUserScroll, { passive: true });
    scroller.addEventListener('keydown', this.onKey);
  }

  show(index: number | null): void {
    if (index === this.current) return;
    for (const span of this.spans(this.current)) span.classList.remove('is-current');
    this.current = index;
    const spans = this.spans(index);
    for (const span of spans) span.classList.add('is-current');
    if (spans.length > 0 && Date.now() - this.userScrolledAt > USER_SCROLL_PAUSE_MS) this.keepInView(spans);
  }

  /** The first sentence at least partly visible: where Play starts when nothing has been read yet. */
  firstVisible(): number {
    const box = this.scroller.getBoundingClientRect();
    if (this.scroller.scrollTop === 0) return 0;
    const index = this.sentences.findIndex((sentence) => {
      const rect = sentence.spans[0]?.getBoundingClientRect();
      return rect !== undefined && rect.bottom > box.top && rect.height > 0;
    });
    return Math.max(0, index);
  }

  /** The first sentence inside this element (a paragraph's "Read from here"). */
  firstIn(element: Element): number | null {
    const index = this.sentences.findIndex((sentence) => sentence.spans.some((span) => element.contains(span)));
    return index === -1 ? null : index;
  }

  destroy(): void {
    this.show(null);
    this.scroller.removeEventListener('wheel', this.onUserScroll);
    this.scroller.removeEventListener('touchmove', this.onUserScroll);
    this.scroller.removeEventListener('keydown', this.onKey);
  }

  private spans(index: number | null): HTMLElement[] {
    return index === null ? [] : (this.sentences[index]?.spans ?? []);
  }

  private keepInView(spans: HTMLElement[]): void {
    const box = this.scroller.getBoundingClientRect();
    const first = spans[0]?.getBoundingClientRect();
    const last = spans[spans.length - 1]?.getBoundingClientRect();
    if (!first || !last || box.height === 0) return;
    const top = first.top - box.top;
    const bottom = last.bottom - box.top;
    if (top >= box.height * COMFORT_TOP && bottom <= box.height * COMFORT_BOTTOM) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    this.scroller.scrollTo({
      top: this.scroller.scrollTop + top - box.height * LAND_AT,
      behavior: reduced ? 'instant' : 'smooth',
    });
  }
}
