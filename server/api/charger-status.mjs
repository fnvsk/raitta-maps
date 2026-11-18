import { compactStatuses, fetchAfir } from './_chargers.mjs';

const CACHE_S = 60;

export default async function handler(req, res) {
  try {
    const { statuses = [], modifiedAt } = await fetchAfir('locations/statuses?limit=ALL', AbortSignal.timeout(15_000));
    res.setHeader('Cache-Control', `public, s-maxage=${CACHE_S}, stale-while-revalidate=${5 * CACHE_S}`);
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({ updated: modifiedAt ?? new Date().toISOString(), busy: compactStatuses(statuses) });
  } catch (error) {
    console.error(error);
    return res.status(502).end();
  }
}
