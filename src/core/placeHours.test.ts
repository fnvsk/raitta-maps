import { describe, expect, it } from 'vitest';
// @ts-expect-error untyped JS module
import { openingHours } from '../../server/api/place-extra.mjs';
import { parseOpeningHours } from './openingHours';

const page = (data: unknown) => `<html><head><script type="application/ld+json">${JSON.stringify(data)}</script></head></html>`;

describe('opening hours from a place’s own page', () => {
  it('reads schema.org opening hours specifications', () => {
    const hours = openingHours(
      page({
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'GroceryStore',
            openingHoursSpecification: [
              { dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], opens: '07:00:00', closes: '22:00:00' },
              { dayOfWeek: 'https://schema.org/Saturday', opens: '08:00', closes: '22:00' },
              { dayOfWeek: 'Sunday', opens: '10:00', closes: '22:00' },
            ],
          },
        ],
      }),
    );
    expect(hours).toBe('Mo-Fr 07:00-22:00; Sa-Su 08:00-22:00'.replace('Sa-Su 08:00-22:00', 'Sa 08:00-22:00; Su 10:00-22:00'));
    expect(parseOpeningHours(hours)).not.toBeNull();
  });

  it('reads the plain form and microdata, and nothing from a page without hours', () => {
    expect(openingHours(page({ '@type': 'Restaurant', openingHours: ['Mo-Fr 11:00-22:00', 'Sa,Su 12:00-23:00'] }))).toBe('Mo-Fr 11:00-22:00; Sa,Su 12:00-23:00');
    expect(openingHours('<meta itemprop="openingHours" content="Mo-Su 06:00-24:00">')).toBe('Mo-Su 06:00-24:00');
    expect(openingHours('<html><body>Hello</body></html>')).toBeUndefined();
  });
});
