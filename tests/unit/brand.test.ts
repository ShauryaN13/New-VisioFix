import { describe, expect, it } from 'vitest';
import { BRAND, ICON, toSvgString } from '@/assets/brand';

describe('VisioFix icon', () => {
  it('both drawings start with the deep navy tile and have a yellow pupil', () => {
    for (const drawing of [ICON.small, ICON.detailed]) {
      expect(drawing[0]?.tag).toBe('rect');
      expect(drawing[0]?.attrs.fill).toBe(BRAND.navy);
      expect(drawing.some((s) => s.tag === 'circle' && s.attrs.fill === BRAND.yellow)).toBe(true);
    }
  });

  it('the detailed tile is 96px with 16px padding (Chrome Web Store guidance)', () => {
    expect(ICON.detailed[0]?.attrs).toMatchObject({ x: 16, y: 16, width: 96, height: 96 });
  });

  it('the small drawing fills its 16px canvas', () => {
    expect(ICON.small[0]?.attrs).toMatchObject({ x: 0, y: 0, width: 16, height: 16 });
  });

  it('serializes to a standalone SVG', () => {
    const svg = toSvgString(ICON.small, '0 0 16 16', 16);
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" viewBox="0 0 16 16" width="16" height="16">/);
    expect(svg).toContain(`fill="${BRAND.navy}"`);
    expect(svg).toContain(`fill="${BRAND.yellow}"`);
    expect(svg.endsWith('</svg>')).toBe(true);
  });
});
