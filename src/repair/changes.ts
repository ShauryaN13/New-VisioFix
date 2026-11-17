import type { FixCounts } from '@/shared/report';

/**
 * The record of every change VisioFix makes, so each one can be undone.
 *
 * Rules:
 *   - Every changed element is tagged: data-visiofix="aria-label alt" lists
 *     the attributes VisioFix set on it (inspect it in DevTools).
 *   - Undo only removes an attribute if it still holds the value VisioFix set.
 *     If the site has since set its own value, the site's value stays.
 *   - VisioFix only adds attributes that were missing. The one exception is
 *     an empty aria-label="", which browsers ignore; the old value is kept
 *     and put back on undo.
 *
 * Each change has an owner: the element whose check produced it. Usually
 * that's the changed element itself; for a field labelled by a nearby
 * <label>, the id added to the label is owned by the field. Re-checking an
 * element undoes only the changes it owns.
 */

export type FixKind = keyof FixCounts;

export const TAG_ATTR = 'data-visiofix';

interface Change {
  owner: Element;
  attr: string;
  value: string;
  /** null = the attribute didn't exist before. */
  previous: string | null;
  /** Which "Fixed on this page" count it belongs to; null for supporting changes (an id). */
  kind: FixKind | null;
}

export class ChangeLog {
  /** Changed element → its changes. */
  private byTarget = new Map<Element, Change[]>();
  /** Owner → the elements it changed. */
  private byOwner = new Map<Element, Set<Element>>();

  set(owner: Element, el: Element, attr: string, value: string, kind: FixKind | null): void {
    const changes = this.byTarget.get(el) ?? [];
    if (changes.some((c) => c.attr === attr)) return; // already set by VisioFix
    changes.push({ owner, attr, value, previous: el.getAttribute(attr), kind });
    this.byTarget.set(el, changes);
    const targets = this.byOwner.get(owner) ?? new Set();
    targets.add(el);
    this.byOwner.set(owner, targets);
    el.setAttribute(attr, value);
    this.tag(el);
  }

  /** Does this element own any changes? */
  owns(owner: Element): boolean {
    return this.byOwner.has(owner);
  }

  /** The value VisioFix set for this attribute, if it set one. */
  valueOf(el: Element, attr: string): string | null {
    return this.byTarget.get(el)?.find((c) => c.attr === attr)?.value ?? null;
  }

  /** The site changed an attribute VisioFix had set: stop tracking it, leave the site's value. */
  forget(el: Element, attr: string): void {
    const change = this.byTarget.get(el)?.find((c) => c.attr === attr);
    if (change) this.drop(el, change);
  }

  /** Undo the changes an element's check made (before checking it again). */
  revertOwnedBy(owner: Element): void {
    for (const el of [...(this.byOwner.get(owner) ?? [])]) {
      for (const change of [...(this.byTarget.get(el) ?? [])]) {
        if (change.owner !== owner) continue;
        // An id that another element (labelled by VisioFix) still points to stays,
        // and is handed over to that element.
        if (change.attr === 'id' && this.handOver(el, change)) continue;
        this.undo(el, change);
      }
    }
  }

  /** Undo everything (turning VisioFix off for a site). */
  revertAll(): void {
    for (const [el, changes] of [...this.byTarget]) for (const change of [...changes]) this.undo(el, change);
  }

  /** Counts for "Fixed on this page", only for elements still on the page. */
  counts(): FixCounts {
    const counts: FixCounts = {
      linkNames: 0,
      fieldLabels: 0,
      imageDescriptions: 0,
      decorativeImages: 0,
      hiddenDuplicates: 0,
    };
    for (const [el, changes] of [...this.byTarget]) {
      if (!el.isConnected) {
        // Removed by the page. Forget it: there's nothing to undo on a detached element.
        for (const change of [...changes]) this.drop(el, change);
        continue;
      }
      for (const change of changes) if (change.kind) counts[change.kind] += 1;
    }
    return counts;
  }

  /** Number of elements VisioFix has changed. */
  get size(): number {
    return this.byTarget.size;
  }

  private undo(el: Element, change: Change): void {
    if (el.getAttribute(change.attr) === change.value) {
      if (change.previous === null) el.removeAttribute(change.attr);
      else el.setAttribute(change.attr, change.previous);
    }
    this.drop(el, change);
  }

  private handOver(el: Element, change: Change): boolean {
    for (const [target, changes] of this.byTarget) {
      if (target === change.owner) continue;
      const refersToId = changes.some(
        (c) => c.attr === 'aria-labelledby' && c.value.split(' ').includes(change.value),
      );
      if (refersToId) {
        this.reassign(el, change, target);
        return true;
      }
    }
    return false;
  }

  private reassign(el: Element, change: Change, newOwner: Element): void {
    const oldOwner = change.owner;
    change.owner = newOwner;
    const oldTargets = this.byOwner.get(oldOwner);
    if (oldTargets && !(this.byTarget.get(el) ?? []).some((c) => c.owner === oldOwner)) {
      oldTargets.delete(el);
      if (oldTargets.size === 0) this.byOwner.delete(oldOwner);
    }
    const newTargets = this.byOwner.get(newOwner) ?? new Set();
    newTargets.add(el);
    this.byOwner.set(newOwner, newTargets);
  }

  private drop(el: Element, change: Change): void {
    const remaining = (this.byTarget.get(el) ?? []).filter((c) => c !== change);
    if (remaining.length) this.byTarget.set(el, remaining);
    else this.byTarget.delete(el);
    const targets = this.byOwner.get(change.owner);
    if (targets && !remaining.some((c) => c.owner === change.owner)) {
      targets.delete(el);
      if (targets.size === 0) this.byOwner.delete(change.owner);
    }
    this.tag(el);
  }

  private tag(el: Element): void {
    const changes = this.byTarget.get(el);
    if (changes?.length) el.setAttribute(TAG_ATTR, changes.map((c) => c.attr).join(' '));
    else el.removeAttribute(TAG_ATTR);
  }
}
