import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CITIES = {
  Helsinki: { latitude: 60.1699, longitude: 24.9384 },
  Tampere: { latitude: 61.4978, longitude: 23.761 },
  Oulu: { latitude: 65.0121, longitude: 25.4651 },
};
const RADIUS_M = 8000;

const envFile = join(dirname(fileURLToPath(import.meta.url)), '..', '.env.local');
const key = readFileSync(envFile, 'utf8').match(/^GOOGLE_PLACES_KEY=(.+)$/m)?.[1]?.trim();
if (!key) throw new Error('Add GOOGLE_PLACES_KEY=... to .env.local');

for (const [city, center] of Object.entries(CITIES)) {
  const res = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'places.displayName,places.fuelOptions',
    },
    body: JSON.stringify({
      includedTypes: ['gas_station'],
      maxResultCount: 20,
      locationRestriction: { circle: { center, radius: RADIUS_M } },
    }),
  });
  if (!res.ok) throw new Error(`${city}: ${res.status} ${(await res.text()).slice(0, 300)}`);
  const places = (await res.json()).places ?? [];
  const priced = places.filter((place) => place.fuelOptions?.fuelPrices?.length);
  console.log(`${city}: ${priced.length} of ${places.length} stations have prices`);
  for (const place of priced.slice(0, 3)) {
    const prices = place.fuelOptions.fuelPrices.map((p) => `${p.type} ${p.price?.units ?? 0}.${String(p.price?.nanos ?? 0).padStart(9, '0').slice(0, 3)} (${p.updateTime})`);
    console.log(`  ${place.displayName?.text}: ${prices.join(', ')}`);
  }
}
