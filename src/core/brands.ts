import type { ExpressionSpecification } from 'maplibre-gl';
import list from './brands.json';
import { foldWord } from './categories';
import type { PlaceKind } from './geocode';

export interface Brand {
  id: string;
  name: string;
  
  match: string[];
  kind: PlaceKind;
  color: string;
  
  short: string;
  
  logo?: string;
  
  site?: string;
  
  icon?: boolean;
}

export const BRANDS = list as Brand[];

export function brandOf(name: string): Brand | undefined {
  const lower = `${name.toLowerCase()} `;
  return BRANDS.find((brand) => brand.match.some((start) => lower.startsWith(start)));
}

const foldedBrands = BRANDS.map((brand) => ({ brand, words: [brand.name, ...brand.match].map(foldWord) }));

export function matchBrand(query: string): Brand | null {
  const text = foldWord(query);
  if (text.length < 3) return null;
  for (const { brand, words } of foldedBrands) if (words.some((word) => word === text)) return brand;
  for (const { brand, words } of foldedBrands) if (words.some((word) => word.startsWith(text))) return brand;
  return null;
}

export function brandIconExpression(): ExpressionSpecification {
  const name: ExpressionSpecification = ['concat', ['downcase', ['coalesce', ['get', 'name'], '']], ' '];
  const cases: unknown[] = ['case'];
  for (const brand of BRANDS) {
    cases.push(['any', ...brand.match.map((start) => ['==', ['index-of', start, name], 0])], `brand|${brand.id}`);
  }
  cases.push('');
  return cases as ExpressionSpecification;
}
