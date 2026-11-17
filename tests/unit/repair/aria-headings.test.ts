import { describe, expect, it } from 'vitest';
import { checkHeadings } from '@/repair/headings';
import { hasValidRole } from '@/repair/roles';
import { $, load, run } from './helpers';

describe('ARIA roles and references (report only)', () => {
  it('reports invalid roles without changing them', () => {
    const engine = run('<div role="btn">Save</div><nav role="nav"></nav>');
    expect($('[role=btn]').getAttribute('role')).toBe('btn');
    expect(engine.report().notFixed.invalidRoles).toBe(2);
  });

  it('accepts valid roles, fallback lists, DPUB and graphics roles', () => {
    for (const role of ['button', 'switch checkbox', 'BUTTON', 'doc-footnote', 'graphics-symbol', 'none', ''])
      expect(hasValidRole(role)).toBe(true);
    for (const role of ['btn', 'nav', 'widget', 'landmark']) expect(hasValidRole(role)).toBe(false);
  });

  it('reports references to missing ids without changing them', () => {
    const engine = run('<div aria-describedby="help missing">x</div><p id="help">Help</p>');
    expect($('div').getAttribute('aria-describedby')).toBe('help missing');
    expect(engine.report().notFixed.brokenReferences).toBe(1);
  });
});

describe('aria-hidden on focusable elements', () => {
  const card = `
    <div class="card">
      <a href="/products/1" aria-hidden="true"><img src="p1.jpg" alt=""></a>
      <h3><a href="/products/1">Blue widget</a></h3>
    </div>`;

  it('takes a hidden duplicate link out of the Tab order', () => {
    const engine = run(card);
    const hidden = $('a[aria-hidden]');
    expect(hidden.getAttribute('tabindex')).toBe('-1');
    expect(hidden.getAttribute('aria-hidden')).toBe('true'); // the author's aria-hidden stays
    expect(engine.report().fixes.hiddenDuplicates).toBe(1);
  });

  it('is idempotent and reversible for the duplicate-link fix', () => {
    load(card);
    const before = document.body.innerHTML;
    const engine = run();
    const after = document.body.innerHTML;
    engine.rescan();
    engine.flush();
    expect(document.body.innerHTML).toBe(after);
    engine.stop();
    expect(document.body.innerHTML).toBe(before);
  });

  it('only reports a hidden control that has no visible twin', () => {
    const engine = run('<div aria-hidden="true"><button>Add to cart</button></div>');
    expect($('button').hasAttribute('tabindex')).toBe(false);
    expect(engine.report().notFixed.hiddenFocusable).toBe(1);
  });

  it('does not override a tabindex the author set', () => {
    const engine = run(`
      <div><a href="/a" aria-hidden="true" tabindex="0"><img alt=""></a><a href="/a">Story</a></div>`);
    expect($('a[aria-hidden]').getAttribute('tabindex')).toBe('0');
    expect(engine.report().notFixed.hiddenFocusable).toBe(1);
  });
});

describe('heading check', () => {
  it('finds skipped levels, empty headings and a missing h1', () => {
    load('<h2>News</h2><h4>Related stories</h4><h3></h3><h2>Sports</h2>');
    expect(checkHeadings(document)).toEqual([
      { kind: 'missing-h1' },
      { kind: 'skipped-level', from: 2, to: 4, text: 'Related stories' },
      { kind: 'empty', level: 3 },
    ]);
  });

  it('is happy with a normal outline, including going back up', () => {
    load('<h1>Title</h1><h2>A</h2><h3>A.1</h3><h2>B</h2>');
    expect(checkHeadings(document)).toEqual([]);
  });

  it('allows more than one h1', () => {
    load('<h1>Site</h1><h1>Article</h1><h2>Part</h2>');
    expect(checkHeadings(document)).toEqual([]);
  });

  it('understands role="heading", aria-level, and ignores hidden or demoted headings', () => {
    load(`
      <h1>Title</h1>
      <div role="heading" aria-level="2">Section</div>
      <h2 role="presentation">Not a heading</h2>
      <h4 aria-hidden="true">Hidden</h4>
      <div role="heading" aria-level="4">Deep</div>`);
    expect(checkHeadings(document)).toEqual([{ kind: 'skipped-level', from: 2, to: 4, text: 'Deep' }]);
  });

  it('does not change the page', () => {
    const html = '<h2>News</h2><h4>Related</h4>';
    load(html);
    checkHeadings(document);
    expect(document.body.innerHTML).toBe(html);
  });
});
