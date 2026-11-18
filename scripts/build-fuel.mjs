import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE = 'https://www.fuel-prices.eu/Finland/llms.txt';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data', 'fuel.json');

const res = await fetch(SOURCE);
if (!res.ok) throw new Error(`Fuel prices failed: ${res.status}`);
const text = await res.text();
const price = (label) => Number(text.match(new RegExp(`${label}\\s+€([\\d.]+)`))?.[1]);
const prices = {
  petrol95: price('Euro 95'),
  diesel: price('Diesel'),
  updated: text.match(/Last updated:\s*([\d-]+)/)?.[1] ?? '',
};
if (!prices.petrol95 || !prices.diesel || !prices.updated) throw new Error('Could not read fuel prices');
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(prices));
console.log('Fuel prices:', prices);
