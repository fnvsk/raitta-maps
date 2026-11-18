const OSM_API = 'https://api.openstreetmap.org/api/0.6';
const CACHE_S = 7 * 24 * 3600;

export default async function handler(req, res) {
  const match = /^(node|way|relation)\((\d{1,20})\)$/.exec(String(req.query.osm));
  if (!match) return res.status(400).end();

  const upstream = await fetch(`${OSM_API}/${match[1]}/${match[2]}.json`, {
    headers: { 'User-Agent': 'RAITTA/1.0 (https://raitta.fi)' },
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (!upstream?.ok) return res.status(502).end();

  const { elements } = await upstream.json();
  res.setHeader('Cache-Control', `public, s-maxage=${CACHE_S}, stale-while-revalidate=${CACHE_S}`);

  res.setHeader('Access-Control-Allow-Origin', '*');
  return res.status(200).json(elements?.[0]?.tags ?? {});
}
