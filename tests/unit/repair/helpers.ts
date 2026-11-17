import { afterEach } from 'vitest';
import { RepairEngine } from '@/repair/engine';

/**
 * Test helpers: load HTML into the test document, run the engine to
 * completion, and clean up afterwards.
 */

let current: RepairEngine | null = null;

afterEach(() => {
  current?.stop();
  current = null;
  document.body.innerHTML = '';
  document.head.innerHTML = '';
});

export function load(html: string): void {
  document.body.innerHTML = html;
}

export function run(html?: string, onChange?: () => void): RepairEngine {
  if (html !== undefined) load(html);
  current = new RepairEngine(document, { onChange });
  current.start();
  current.flush();
  return current;
}

export function $(selector: string): Element {
  const el = document.querySelector(selector);
  if (!el) throw new Error(`No element for ${selector}`);
  return el;
}

/** Pretend an image has loaded (the test DOM never loads images). */
export function fakeImage(
  img: Element,
  { complete = true, width = 0, height = 0 }: { complete?: boolean; width?: number; height?: number },
): void {
  Object.defineProperty(img, 'complete', { configurable: true, get: () => complete });
  Object.defineProperty(img, 'naturalWidth', { configurable: true, get: () => width });
  Object.defineProperty(img, 'naturalHeight', { configurable: true, get: () => height });
}

/** Pretend an element is not rendered (display:none), as Chrome's checkVisibility() would say. */
export function fakeHidden(el: Element): void {
  Object.defineProperty(el, 'checkVisibility', { configurable: true, value: () => false });
}
