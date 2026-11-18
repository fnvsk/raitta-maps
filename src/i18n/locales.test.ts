import { describe, expect, it } from 'vitest';
import { en } from './locales/en';
import { et } from './locales/et';
import { fi } from './locales/fi';
import { ru } from './locales/ru';
import { sv } from './locales/sv';

type Tree = { [key: string]: string | Tree };

const flatten = (tree: Tree, prefix = ''): Record<string, string> =>
  Object.entries(tree).reduce<Record<string, string>>((out, [key, value]) => {
    if (typeof value === 'string') out[prefix + key] = value;
    else Object.assign(out, flatten(value, `${prefix}${key}.`));
    return out;
  }, {});

const PLURAL = /_(one|few|many|other)$/;
const baseKeys = (locale: Tree) => [...new Set(Object.keys(flatten(locale)).map((k) => k.replace(PLURAL, '')))].sort();
const placeholders = (text: string) => [...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();

describe.each([
  ['fi', fi],
  ['sv', sv],
  ['ru', ru],
  ['et', et],
])('%s translation', (_, locale) => {
  it('has every key that English has', () => {
    expect(baseKeys(locale)).toEqual(baseKeys(en));
  });

  it('keeps the placeholders of each string', () => {
    const source = flatten(en);
    const target = flatten(locale);
    for (const [key, value] of Object.entries(target)) {
      const original = source[key] ?? source[key.replace(PLURAL, '_other')];
      expect(placeholders(value), key).toEqual(placeholders(original));
    }
  });
});

describe('ru plurals', () => {
  it('defines every category Russian needs', () => {
    const keys = Object.keys(flatten(ru));
    for (const base of ['routes.stopCount', 'routes.vehiclesOnLine']) {
      for (const form of ['one', 'few', 'many', 'other']) expect(keys).toContain(`${base}_${form}`);
    }
  });
});
