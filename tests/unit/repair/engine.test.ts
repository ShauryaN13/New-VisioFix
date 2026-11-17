import { describe, expect, it, vi } from 'vitest';
import { $, fakeImage, load, run } from './helpers';

/** A page with something for every rule, plus things that must be left alone. */
const MIXED_PAGE = `
  <header class="site-header headline-bar"><h1>Riverside Courier</h1></header>
  <nav><a href="https://twitter.com/rc"><svg></svg></a><a href="/">Home</a></nav>
  <main>
    <article class="lead-story">
      <h2 class="headline">Library adds evening hours</h2>
      <p class="read-more">Starting next month… <a class="read-more-link" href="/story">Read more</a></p>
      <figure><img src="room.jpg"><figcaption>The new reading room</figcaption></figure>
      <img src="divider.png" alt="">
      <ins datetime="2026-11-01">Updated with new hours.</ins>
      <iframe title="Video tour" src="https://video.example/embed/1"></iframe>
      <div class="card shadow">
        <a href="/p/1" aria-hidden="true"><img src="p1.jpg" alt=""></a>
        <h3><a href="/p/1">Blue widget</a></h3>
        <button class="btn-add-to-cart">Add to cart</button>
      </div>
    </article>
    <form><label>Email</label><input type="email"><button><svg></svg></button></form>
    <div role="btn" aria-describedby="nope">Weird</div>
  </main>
  <div class="modal-overlay" role="dialog" aria-label="Newsletter"><p>Subscribe?</p></div>`;

describe('repair engine', () => {
  it('is reversible: turning it off restores the page exactly', () => {
    load(MIXED_PAGE);
    const original = document.body.innerHTML;
    const engine = run();
    expect(document.body.innerHTML).not.toBe(original); // it did fix things
    engine.stop();
    expect(document.body.innerHTML).toBe(original);
  });

  it('is idempotent: processing everything a second time changes nothing', () => {
    const engine = run(MIXED_PAGE);
    const once = document.body.innerHTML;
    const report = engine.report();
    engine.rescan();
    engine.flush();
    expect(document.body.innerHTML).toBe(once);
    expect(engine.report()).toEqual(report);
  });

  it('never deletes anything, including what legacy v1 deleted', () => {
    load(MIXED_PAGE);
    const count = document.querySelectorAll('*').length;
    run();
    expect(document.querySelectorAll('*').length).toBe(count);
    // v1's substring selectors removed all of these.
    for (const selector of ['.read-more', '.lead-story', '.headline', '.shadow', '.btn-add-to-cart', 'header', 'ins', 'iframe', '.modal-overlay', 'form'])
      expect(document.querySelector(selector), selector).not.toBeNull();
  });

  it('reports what it fixed and what it left alone', () => {
    const engine = run(MIXED_PAGE);
    const report = engine.report();
    expect(report.fixes).toEqual({
      linkNames: 1,
      fieldLabels: 1,
      imageDescriptions: 1,
      decorativeImages: 0,
      hiddenDuplicates: 1,
    });
    expect(report.notFixed.unnamedControls).toBe(1); // the icon-only submit button
    expect(report.notFixed.invalidRoles).toBe(1);
    expect(report.notFixed.brokenReferences).toBe(1);
  });

  it('repairs content added later', () => {
    const engine = run('<main></main>');
    const link = document.createElement('a');
    link.href = 'https://example.org/later';
    link.innerHTML = '<svg></svg>';
    $('main').append(link);
    engine.flush();
    expect(link.getAttribute('aria-label')).toBe('example.org/later');
  });

  it('removes its own label when the link gets real text later', () => {
    const engine = run('<a href="https://example.org/x"><svg></svg></a>');
    const link = $('a');
    expect(link.hasAttribute('aria-label')).toBe(true);
    link.append('Example page'); // the site finishes rendering the link
    engine.flush();
    expect(link.hasAttribute('aria-label')).toBe(false);
    expect(link.hasAttribute('data-visiofix')).toBe(false);
    expect(engine.report().fixes.linkNames).toBe(0);
  });

  it('lets the site win: if the site sets an attribute VisioFix set, undo leaves the site\'s value', () => {
    const engine = run('<a href="https://example.org/x"><svg></svg></a>');
    const link = $('a');
    link.setAttribute('aria-label', 'Follow us');
    engine.flush();
    engine.stop();
    expect(link.getAttribute('aria-label')).toBe('Follow us');
    expect(link.hasAttribute('data-visiofix')).toBe(false);
  });

  it('ignores its own changes: no extra work after a batch', () => {
    const onChange = vi.fn();
    const engine = run('<a href="/a"><svg></svg></a><label>Name</label><input>', onChange);
    const calls = onChange.mock.calls.length;
    const checked = engine.stats.elementsChecked;
    engine.flush();
    expect(onChange.mock.calls.length).toBe(calls);
    expect(engine.stats.elementsChecked).toBe(checked);
  });

  it('drops elements the page removed from the counts', () => {
    const engine = run('<div id="box"><a href="/a"><svg></svg></a></div>');
    expect(engine.report().fixes.linkNames).toBe(1);
    $('#box').remove();
    engine.flush();
    expect(engine.report().fixes.linkNames).toBe(0);
  });

  it('checks a subtree again when aria-hidden is removed from it', () => {
    const engine = run('<div id="menu" aria-hidden="true"><a href="https://example.org/m"><svg></svg></a></div>');
    expect($('a').hasAttribute('aria-label')).toBe(false); // hidden: not exposed, not named
    $('#menu').removeAttribute('aria-hidden');
    engine.flush();
    expect($('a').getAttribute('aria-label')).toBe('example.org/m');
  });

  it('undoes everything on stop, and can start again', () => {
    load('<a href="https://example.org/a"><svg></svg></a><img src="pixel.gif">');
    fakeImage($('img'), { width: 1, height: 1 });
    const original = document.body.innerHTML;
    const engine = run();
    engine.stop();
    expect(document.body.innerHTML).toBe(original);
    engine.start();
    engine.flush();
    expect($('a').hasAttribute('aria-label')).toBe(true);
    expect($('img').getAttribute('alt')).toBe('');
  });

  it('works in time slices without losing anything', () => {
    load(Array.from({ length: 3000 }, (_, i) => `<p><a href="/p/${i}"><svg></svg></a></p>`).join(''));
    const engine = run();
    expect(engine.report().fixes.linkNames).toBe(3000);
    expect(engine.stats.elementsChecked).toBeGreaterThanOrEqual(3000 * 3);
  });
});
