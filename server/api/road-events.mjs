import { compactEvent, fetchSituation, markRough, SITUATIONS } from './_road-events.mjs';

const CACHE_S = 120;
const PREPARED = `${process.env.ROUTE_URL ?? 'https://route.raitta.fi'}/road-events.json`;

const PREPARED_MAX_AGE_MS = 10 * 60 * 1000;

async function prepared() {
  try {
    const res = await fetch(PREPARED, { signal: AbortSignal.timeout(4_000) });
    if (!res.ok) return null;
    const data = await res.json();
    return Date.now() - Date.parse(data.updated) < PREPARED_MAX_AGE_MS ? data : null;
  } catch {
    return null;
  }
}

async function direct() {
  const signal = AbortSignal.timeout(20_000);
  const features = (await Promise.all(SITUATIONS.map((type) => fetchSituation(type, signal)))).flat();
  const now = Date.now();
  const events = markRough(features.map((feature) => compactEvent(feature, now)).filter(Boolean));
  return { updated: new Date(now).toISOString(), events };
}

export default async function handler(req, res) {
  try {
    const data = (await prepared()) ?? (await direct());
    res.setHeader('Cache-Control', `public, s-maxage=${CACHE_S}, stale-while-revalidate=${5 * CACHE_S}`);

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json(data);
  } catch (error) {
    console.error(error);
    return res.status(502).end();
  }
}
