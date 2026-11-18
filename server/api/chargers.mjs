import { compactChargers, fetchAfir } from './_chargers.mjs';

const CACHE_S = 6 * 3600;

export default async function handler(req, res) {
  try {
    const signal = AbortSignal.timeout(25_000);
    const [locations, tariffs] = await Promise.all([fetchAfir('locations?limit=ALL', signal), fetchAfir('tariffs?limit=ALL', signal)]);
    const data = compactChargers(locations.features ?? [], tariffs.tariffs ?? []);
    res.setHeader('Cache-Control', `public, s-maxage=${CACHE_S}, stale-while-revalidate=${4 * CACHE_S}`);

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({ updated: locations.modifiedAt ?? new Date().toISOString(), ...data });
  } catch (error) {
    console.error(error);
    return res.status(502).end();
  }
}
