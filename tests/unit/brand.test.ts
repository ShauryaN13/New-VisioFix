import { describe, expect, it } from 'vitest';
import { BRAND, CHOSEN_ICON, ICON_CONCEPTS, getConcept, toSvgString } from '@/assets/brand';

describe('icon concepts', () => {
  it('has the three concepts, and the chosen one exists', () => {
    expect(ICON_CONCEPTS.map((c) => c.id)).toEqual(['brackets', 'v-check', 'focus-frame']);
    expect(getConcept(CHOSEN_ICON).id).toBe(CHOSEN_ICON);
  });

  for (const concept of ICON_CONCEPTS) {
    it(`${concept.id}: both drawings start with the deep navy tile`, () => {
      for (const drawing of [concept.small, concept.detailed]) {
        expect(drawing[0]?.tag).toBe('rect');
        expect(drawing[0]?.attrs.fill).toBe(BRAND.navy);
        expect(drawing.length).toBeGreaterThan(1);
      }
    });

    it(`${concept.id}: the detailed tile is 96px with 16px padding (Chrome Web Store guidance)`, () => {
      expect(concept.detailed[0]?.attrs).toMatchObject({ x: 16, y: 16, width: 96, height: 96 });
    });
  }

  it('serializes to a standalone SVG', () => {
    const svg = toSvgString(getConcept('brackets').small, '0 0 16 16', 16);
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" viewBox="0 0 16 16" width="16" height="16">/);
    expect(svg).toContain(`fill="${BRAND.navy}"`);
    expect(svg).toContain(`fill="${BRAND.yellow}"`);
    expect(svg.endsWith('</svg>')).toBe(true);
  });
});
