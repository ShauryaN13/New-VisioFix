import { describe, expect, it } from 'vitest';
import { $, fakeHidden, fakeImage, load, run } from './helpers';

describe('images', () => {
  it('never touches alt="" (decorative) or any existing alt (legacy v1 overwrote alt="")', () => {
    const engine = run('<img src="divider.png" alt=""><img src="photo.jpg" alt="A red bicycle">');
    const [decorative, described] = document.querySelectorAll('img');
    expect(decorative?.getAttribute('alt')).toBe('');
    expect(described?.getAttribute('alt')).toBe('A red bicycle');
    expect(engine.report().notFixed.imagesNeedDescription).toBe(0);
    expect(document.querySelectorAll('[data-visiofix]').length).toBe(0);
  });

  it('points an image in a figure at its caption', () => {
    const engine = run('<figure><img src="room.jpg"><figcaption>The new reading room</figcaption></figure>');
    const caption = $('figcaption');
    expect(caption.id).toBe('visiofix-caption-1');
    expect($('img').getAttribute('aria-labelledby')).toBe(caption.id);
    expect($('img').hasAttribute('alt')).toBe(false);
    expect(engine.report().fixes.imageDescriptions).toBe(1);
  });

  it('does not use a caption shared by several images', () => {
    load('<figure><img src="a.jpg"><img src="b.jpg"><figcaption>Before and after</figcaption></figure>');
    for (const img of document.querySelectorAll('img')) fakeImage(img, { width: 800, height: 600 });
    const engine = run();
    expect(document.querySelectorAll('[aria-labelledby]').length).toBe(0);
    expect(engine.report().notFixed.imagesNeedDescription).toBe(2);
  });

  it('uses the image\'s own description (aria-describedby) as its alt', () => {
    run('<img src="chart.png" aria-describedby="d"><p id="d">Sales rose 20% in March.</p>');
    expect($('img').getAttribute('alt')).toBe('Sales rose 20% in March.');
  });

  it('uses the title of the link around it', () => {
    run('<a href="/p/1" title="Blue widget"><img src="w.jpg"></a>');
    expect($('img').getAttribute('alt')).toBe('Blue widget');
  });

  it('uses a WordPress caption, matching whole class names only', () => {
    run('<div class="wp-caption"><img src="x.jpg"><p class="wp-caption-text">Opening night</p></div>');
    expect($('img').getAttribute('aria-labelledby')).toBe($('.wp-caption-text').id);
  });

  it('does not treat class names that merely contain "caption" as captions', () => {
    load('<div class="my-wp-caption-box"><img src="x.jpg"><p class="wp-caption-texts">Not a caption</p></div>');
    fakeImage($('img'), { width: 800, height: 600 });
    const engine = run();
    expect($('img').hasAttribute('aria-labelledby')).toBe(false);
    expect(engine.report().notFixed.imagesNeedDescription).toBe(1);
  });

  it('covers an image-only link by naming the link, not the image', () => {
    load('<a href="https://example.org/shop"><img src="cart.png"></a>');
    fakeImage($('img'), { width: 24, height: 24 });
    const engine = run();
    expect($('a').getAttribute('aria-label')).toBe('example.org/shop');
    expect($('img').hasAttribute('alt')).toBe(false);
    expect(engine.report().notFixed.imagesNeedDescription).toBe(0);
  });

  it('reports an image with nothing reliable to describe it, without a placeholder', () => {
    load('<img src="IMG_3847.jpg">');
    fakeImage($('img'), { width: 1200, height: 800 });
    const engine = run();
    expect($('img').hasAttribute('alt')).toBe(false);
    expect(engine.report().notFixed.imagesNeedDescription).toBe(1);
  });
});

describe('tracking pixels (alt="" only for loaded images of 2px or less)', () => {
  it('marks a loaded 1×1 image as decorative', () => {
    load('<img src="https://tracker.example/p.gif">');
    fakeImage($('img'), { width: 1, height: 1 });
    const engine = run();
    expect($('img').getAttribute('alt')).toBe('');
    expect(engine.report().fixes.decorativeImages).toBe(1);
  });

  it('waits for a lazy-loaded image instead of measuring it, then decides by its real size', () => {
    load('<img src="photo.jpg" loading="lazy">');
    const img = $('img');
    fakeImage(img, { complete: false });
    const engine = run();
    expect(img.hasAttribute('alt')).toBe(false);
    expect(engine.report().notFixed.imagesNeedDescription).toBe(0); // not decided yet

    fakeImage(img, { complete: true, width: 800, height: 400 });
    img.dispatchEvent(new Event('load'));
    engine.flush();
    expect(img.hasAttribute('alt')).toBe(false);
    expect(engine.report().notFixed.imagesNeedDescription).toBe(1);
  });

  it('never marks a hidden image (carousel slide, display:none) as decorative', () => {
    load('<div class="slide"><img src="slide-2.jpg"></div>');
    const img = $('img');
    fakeImage(img, { width: 1600, height: 900 });
    fakeHidden(img);
    const engine = run();
    expect(img.hasAttribute('alt')).toBe(false);
    // Hidden images aren't reachable by screen readers, so they aren't counted either.
    expect(engine.report().notFixed.imagesNeedDescription).toBe(0);
  });

  it('waits for an image with no source yet (script-driven lazy loading), then checks it', () => {
    load('<img data-src="photo.jpg">');
    const img = $('img');
    fakeImage(img, { complete: true, width: 0, height: 0 });
    const engine = run();
    expect(img.hasAttribute('alt')).toBe(false);
    expect(engine.report().notFixed.imagesNeedDescription).toBe(0);

    img.setAttribute('src', 'photo.jpg'); // the site's script sets the source
    fakeImage(img, { complete: true, width: 800, height: 600 });
    engine.flush();
    expect(img.hasAttribute('alt')).toBe(false);
    expect(engine.report().notFixed.imagesNeedDescription).toBe(1);
  });

  it('leaves a 3×3 image alone (only 2px or less counts)', () => {
    load('<img src="dot.png">');
    fakeImage($('img'), { width: 3, height: 3 });
    run();
    expect($('img').hasAttribute('alt')).toBe(false);
  });
});
