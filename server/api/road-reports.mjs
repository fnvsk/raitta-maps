import { randomBytes } from 'node:crypto';
import { head, put } from '@vercel/blob';

const ORIGINS = new Set([
  'https://raita-xi.vercel.app',
  'https://raitta.fi',
  'https://www.raitta.fi',
  'https://maps.raitta.fi',
  'https://localhost',
  'capacitor://localhost',
  'http://localhost:5173',
]);
const PATH = 'road-reports/active.json';
const HOUR = 3600_000;
const LIFETIME = { camera: 3 * HOUR, police: 2 * HOUR, accident: 2 * HOUR, hazard: 4 * HOUR };

const SAME_M = 150;
const MAX_REPORTS = 600;

const RATE_WINDOW_MS = 10 * 60_000;
const RATE_MAX = 12;
const recent = new Map();

const metres = (a, b) => Math.hypot((a.lat - b.lat) * 111_320, (a.lon - b.lon) * 111_320 * Math.cos((a.lat * Math.PI) / 180));
const alive = (report, now) => now - report.seen < LIFETIME[report.kind] && !(report.no >= 2 && report.no > report.yes);

const stored = !!process.env.BLOB_READ_WRITE_TOKEN;
let memory = [];

async function load() {
  if (!stored) return memory;
  try {
    const { url } = await head(PATH);
    const res = await fetch(`${url}?fresh=${Date.now()}`);
    return res.ok ? ((await res.json()).reports ?? []) : [];
  } catch {
    return [];
  }
}

async function save(reports) {
  if (!stored) {
    memory = reports;
    return;
  }
  await put(PATH, JSON.stringify({ reports }), { access: 'public', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json', cacheControlMaxAge: 30 });
}

const shown = (reports) => reports.map(({ id, kind, lat, lon, seen }) => ({ id, kind, lat, lon, seen }));

function limited(req) {
  const address = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || 'unknown';
  const now = Date.now();
  const times = (recent.get(address) ?? []).filter((time) => now - time < RATE_WINDOW_MS);
  times.push(now);
  recent.set(address, times);
  if (recent.size > 5000) recent.clear();
  return times.length > RATE_MAX;
}

export default async function handler(req, res) {
  const origin = req.headers.origin;
  if (origin && ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }
  const now = Date.now();
  if (req.method === 'GET') {
    const reports = (await load()).filter((report) => alive(report, now));
    res.setHeader('Cache-Control', 'public, s-maxage=20, stale-while-revalidate=40');
    return res.status(200).json({ reports: shown(reports) });
  }
  if (req.method !== 'POST') return res.status(405).end();
  if (!ORIGINS.has(origin)) return res.status(403).end();
  if (limited(req)) return res.status(429).json({ error: 'too many' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body ?? {});
  const reports = (await load()).filter((report) => alive(report, now));

  if (typeof body.id === 'string') {
    const report = reports.find((item) => item.id === body.id);
    
    if (!report) return res.status(200).json({ reports: shown(reports), gone: true });
    if (body.vote === 'yes') {
      report.yes += 1;
      report.seen = now;
    } else if (body.vote === 'no') report.no += 1;
    else return res.status(400).json({ error: 'vote' });
  } else {
    const { kind, lat, lon } = body;
    if (!(kind in LIFETIME)) return res.status(400).json({ error: 'kind' });
    
    if (typeof lat !== 'number' || typeof lon !== 'number' || lat < 59.5 || lat > 70.2 || lon < 19 || lon > 31.7) return res.status(400).json({ error: 'place' });
    const same = reports.find((item) => item.kind === kind && metres(item, { lat, lon }) < SAME_M);
    if (same) {
      same.yes += 1;
      same.seen = now;
    } else {
      reports.push({ id: randomBytes(6).toString('base64url'), kind, lat: Number(lat.toFixed(5)), lon: Number(lon.toFixed(5)), at: now, seen: now, yes: 1, no: 0 });
    }
  }
  reports.sort((a, b) => b.seen - a.seen);
  const kept = reports.filter((report) => alive(report, now)).slice(0, MAX_REPORTS);
  await save(kept);
  return res.status(200).json({ reports: shown(kept) });
}
