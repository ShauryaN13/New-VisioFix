import { describe, expect, it } from 'vitest';
import { $, run } from './helpers';

describe('unlabeled links', () => {
  it('names an icon-only link from its destination and tags the change', () => {
    const engine = run('<a href="https://twitter.com/visiofix"><svg width="16" height="16"></svg></a>');
    const link = $('a');
    expect(link.getAttribute('aria-label')).toBe('twitter.com/visiofix');
    expect(link.getAttribute('data-visiofix')).toBe('aria-label');
    expect(engine.report().fixes.linkNames).toBe(1);
  });

  it('names a link whose only text is hidden from screen readers', () => {
    run('<a href="/next"><span aria-hidden="true">→</span></a>');
    expect($('a').getAttribute('aria-label')).toBe('localhost/next');
  });

  it('leaves links that already have a name alone', () => {
    const engine = run(`
      <a id="text" href="/a">Read more</a>
      <a id="img" href="/b"><img src="logo.png" alt="VisioFix home"></a>
      <a id="title" href="/c" title="Search"><svg></svg></a>
      <a id="label" href="/d" aria-label="Close"><svg></svg></a>
    `);
    for (const id of ['text', 'img', 'title']) expect($(`#${id}`).hasAttribute('aria-label')).toBe(false);
    expect($('#label').getAttribute('aria-label')).toBe('Close');
    expect(engine.report().fixes.linkNames).toBe(0);
  });

  it('keeps an image-only link named by its image (legacy v1 replaced it with "Link")', () => {
    run('<a href="/home"><img src="logo.png" alt="Riverside Courier home"></a>');
    expect($('a').hasAttribute('aria-label')).toBe(false);
  });

  it('ignores anchors without href and links that go nowhere', () => {
    const engine = run('<a name="top"></a><a href="#"><svg></svg></a><a href="javascript:void(0)"><svg></svg></a>');
    for (const a of document.querySelectorAll('a')) expect(a.hasAttribute('aria-label')).toBe(false);
    // The two "links" with nowhere to go are reported, not fixed.
    expect(engine.report().notFixed.unnamedControls).toBe(2);
  });

  it('fills an empty aria-label and puts the empty value back on undo', () => {
    const engine = run('<a href="https://example.org/help" aria-label=""><svg></svg></a>');
    expect($('a').getAttribute('aria-label')).toBe('example.org/help');
    engine.stop();
    expect($('a').getAttribute('aria-label')).toBe('');
    expect($('a').hasAttribute('data-visiofix')).toBe(false);
  });

  it('does not override a broken aria-labelledby the author wrote (report only)', () => {
    const engine = run('<a href="/x" aria-labelledby="missing"><svg></svg></a>');
    expect($('a').hasAttribute('aria-label')).toBe(false);
    const report = engine.report();
    expect(report.notFixed.unnamedControls).toBe(1);
    expect(report.notFixed.brokenReferences).toBe(1);
  });
});

describe('unlabeled buttons', () => {
  it('reports icon-only buttons instead of guessing (no generic "Button")', () => {
    const engine = run('<button><svg></svg></button><div role="button" tabindex="0"><i class="icon"></i></div>');
    for (const b of document.querySelectorAll('button, [role=button]')) expect(b.hasAttribute('aria-label')).toBe(false);
    expect(engine.report().notFixed.unnamedControls).toBe(2);
  });

  it('leaves one-character names like "×" alone (legacy v1 overwrote them)', () => {
    const engine = run('<button>×</button><button>+</button>');
    expect(document.querySelectorAll('[aria-label]').length).toBe(0);
    expect(engine.report().notFixed.unnamedControls).toBe(0);
  });

  it('counts a title as a name', () => {
    const engine = run('<button title="Search"><svg></svg></button>');
    expect(engine.report().notFixed.unnamedControls).toBe(0);
  });

  it('skips disabled buttons and submit inputs (browsers give those a default name)', () => {
    const engine = run('<button disabled><svg></svg></button><input type="submit">');
    expect(engine.report().notFixed.unnamedControls).toBe(0);
  });
});

describe('unlabeled form fields', () => {
  it('connects a field to the label right before it', () => {
    const engine = run('<label>Email address</label><input type="email">');
    const label = $('label');
    expect(label.id).toBe('visiofix-label-1');
    expect($('input').getAttribute('aria-labelledby')).toBe('visiofix-label-1');
    expect(engine.report().fixes.fieldLabels).toBe(1);
  });

  it('uses the label\'s existing id when it has one', () => {
    run('<label id="name-label">Full name</label><input>');
    expect($('input').getAttribute('aria-labelledby')).toBe('name-label');
    expect($('label').hasAttribute('data-visiofix')).toBe(false);
  });

  it('repairs a label whose for= points at an id that does not exist', () => {
    run('<input type="checkbox"><label for="typo">Remember me</label>');
    expect($('input').getAttribute('aria-labelledby')).toBe($('label').id);
  });

  it('does not borrow a label that belongs to another field', () => {
    const engine = run('<label for="other">Phone</label><input id="mine"><input id="other">');
    expect($('#mine').hasAttribute('aria-labelledby')).toBe(false);
    expect(engine.report().notFixed.unnamedControls).toBe(1);
  });

  it('leaves fields named by placeholder, title or a proper label alone', () => {
    const engine = run(`
      <input placeholder="Search">
      <input title="Quantity">
      <label for="z">Zip</label><input id="z">
      <label>City <input></label>
    `);
    expect(document.querySelectorAll('[aria-labelledby]').length).toBe(0);
    expect(engine.report().notFixed.unnamedControls).toBe(0);
  });

  it('undo removes both the field\'s aria-labelledby and the id added to the label', () => {
    const html = '<label>Email address</label><input type="email">';
    const engine = run(html);
    engine.stop();
    expect(document.body.innerHTML).toBe(html);
  });
});
