/**
 * A tiny helper for building DOM without a UI framework.
 *
 *   h('button', { class: 'btn', type: 'button', onclick: save }, 'Save')
 *
 * - Attributes are set with setAttribute (so aria-* and data-* work as written).
 * - `on<event>` keys with function values become event listeners.
 * - `false`, `null` and `undefined` attribute values are skipped; `true` sets an
 *   empty attribute (e.g. `hidden: true`).
 * - Children can be nodes, strings (inserted as text, never parsed as HTML),
 *   or nested arrays; null/false children are skipped.
 *
 * It never uses innerHTML, so it also works on sites that enforce Trusted Types.
 */

export type Child = Node | string | number | null | undefined | false | Child[];
export type Attrs = Record<string, string | number | boolean | null | undefined | EventListener>;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Attrs | null,
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs) setAttrs(el, attrs);
  append(el, children);
  return el;
}

export function setAttrs(el: Element, attrs: Attrs): void {
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value === true) {
      el.setAttribute(key, '');
    } else {
      el.setAttribute(key, String(value));
    }
  }
}

export function append(parent: Node, children: Child[]): void {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    if (Array.isArray(child)) append(parent, child);
    else if (child instanceof Node) parent.appendChild(child);
    else parent.appendChild(document.createTextNode(String(child)));
  }
}

let idCounter = 0;
/** Unique ids for aria-labelledby / aria-describedby wiring. */
export function uid(prefix = 'vf'): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}
