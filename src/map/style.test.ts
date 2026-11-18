import { describe, expect, it } from 'vitest';
import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec';
import { buildStyle, POI_CATEGORIES, POI_ICONS } from './style';
import { POI_GLYPH_PATHS } from './poiGlyphs';

describe('map style', () => {
  it('is a valid MapLibre style, place icons included', () => {
    for (const dark of [false, true]) expect(validateStyleMin(buildStyle(dark, 'fi')).map((error) => error.message)).toEqual([]);
  });

  it('has a picture for every place icon', () => {
    for (const { glyph } of POI_ICONS) expect(POI_GLYPH_PATHS[glyph]).toBeTruthy();
    expect(POI_ICONS.length).toBeLessThan(230);
  });

  it('puts each class in one category only', () => {
    const seen = new Map<string, string>();
    for (const [category, { classes }] of Object.entries(POI_CATEGORIES))
      for (const cls of Object.keys(classes)) {
        expect(seen.get(cls), cls).toBeUndefined();
        seen.set(cls, category);
      }
  });
});
