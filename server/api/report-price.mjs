import { head, put } from '@vercel/blob';

const ORIGINS = new Set(['https://raita-xi.vercel.app', 'https://raitta.fi', 'https://www.raitta.fi', 'https://maps.raitta.fi', 'https://localhost', 'capacitor://localhost']);
const LOWEST = 1;
const HIGHEST = 4;
const THROTTLE_MS = 30_000;

const validPrice = (value) => value === undefined || (typeof value === 'number' && value >= LOWEST && value <= HIGHEST);
const rounded = (value) => (value === undefined ? undefined : Math.round(value * 1000) / 1000);

async function current(pathname) {
  try {
    const { url } = await head(pathname);
    const res = await fetch(`${url}?fresh=${Date.now()}`);
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  const origin = req.headers.origin;
  if (!ORIGINS.has(origin)) return res.status(403).end();
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }
  if (req.method !== 'POST') return res.status(405).end();

  const { stationId, petrol95, diesel } = req.body ?? {};
  if (typeof stationId !== 'string' || !/^[\w.,-]{1,40}$/.test(stationId)) return res.status(400).json({ error: 'station' });
  if ((petrol95 === undefined && diesel === undefined) || !validPrice(petrol95) || !validPrice(diesel)) {
    return res.status(400).json({ error: 'price' });
  }

  const pathname = `prices/${stationId}.json`;
  const previous = await current(pathname);
  const now = Date.now();
  if (previous && now - previous.updated < THROTTLE_MS) return res.status(429).json({ error: 'too soon' });

  const prices = {
    petrol95: rounded(petrol95) ?? previous?.petrol95,
    diesel: rounded(diesel) ?? previous?.diesel,
    updated: now,
  };
  await put(pathname, JSON.stringify(prices), {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
    cacheControlMaxAge: 60,
  });
  return res.status(200).json(prices);
}
