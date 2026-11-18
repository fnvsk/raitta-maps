import { readFileSync, renameSync, writeFileSync, mkdirSync } from 'node:fs';
import { compactEvent, fetchSituation, SITUATIONS, snapCache, snapRoughLines } from './_road-events.mjs';

const OUT_DIR = '/var/www/raitta-route';
const CACHE = '/opt/raitta-route/snap-cache.json';

try {
  snapCache.load(JSON.parse(readFileSync(CACHE, 'utf8')));
} catch {
}

const features = (await Promise.all(SITUATIONS.map((type) => fetchSituation(type, AbortSignal.timeout(30_000))))).flat();
const now = Date.now();
const events = features.map((feature) => compactEvent(feature, now)).filter(Boolean);
await snapRoughLines(events, AbortSignal.timeout(60_000));

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(`${OUT_DIR}/road-events.json.tmp`, JSON.stringify({ updated: new Date(now).toISOString(), events }));
renameSync(`${OUT_DIR}/road-events.json.tmp`, `${OUT_DIR}/road-events.json`);
writeFileSync(CACHE, JSON.stringify(snapCache.entries()));
console.log(`${events.length} events, ${events.filter((event) => event.rough).length} left rough`);
