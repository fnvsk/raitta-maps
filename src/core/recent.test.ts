import { describe, expect, it } from 'vitest';
import { withRecent, type RecentPlace } from './recent';

const place = (name: string): RecentPlace => ({ name, detail: '', lat: 61.5, lon: 23.8 });

describe('withRecent', () => {
  it('puts the newest place first', () => {
    expect(withRecent([place('Hippos')], place('Ratina')).map((p) => p.name)).toEqual(['Ratina', 'Hippos']);
  });

  it('moves a repeated place to the top instead of listing it twice', () => {
    const list = [place('Ratina'), place('Hippos')];
    expect(withRecent(list, place('Hippos')).map((p) => p.name)).toEqual(['Hippos', 'Ratina']);
  });

  it('keeps two places with one name but different locations', () => {
    expect(withRecent([place('Keskustori')], { ...place('Keskustori'), lat: 60 })).toHaveLength(2);
  });

  it('forgets the oldest places beyond the limit', () => {
    let list: RecentPlace[] = [];
    for (let i = 0; i < 12; i++) list = withRecent(list, place(`Place ${i}`));
    expect(list).toHaveLength(8);
    expect(list[0].name).toBe('Place 11');
  });
});
