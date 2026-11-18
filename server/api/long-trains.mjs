const GRAPHQL = 'https://rata.digitraffic.fi/api/v2/graphql/graphql';
const QUERY = `{
  currentlyRunningTrains(where: { trainType: { trainCategory: { name: { equals: "Long-distance" } } } }) {
    trainNumber departureDate trainType { name }
    trainLocations(orderBy: { timestamp: DESCENDING }, take: 1) { location speed }
    timeTableRows(where: { commercialStop: { equals: true } }) {
      station { shortCode } type scheduledTime liveEstimateTime actualTime differenceInMinutes cancelled commercialStop
    }
  }
}`;
const CACHE_S = 10;

export default async function handler(req, res) {
  try {
    const upstream = await fetch(GRAPHQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept-Encoding': 'gzip', 'Digitraffic-User': 'RAITTA/1.0 (https://raitta.fi)' },
      body: JSON.stringify({ query: QUERY }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!upstream.ok) return res.status(502).end();
    const body = await upstream.json();
    res.setHeader('Cache-Control', `public, s-maxage=${CACHE_S}, stale-while-revalidate=${6 * CACHE_S}`);
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json(body);
  } catch (error) {
    console.error(error);
    return res.status(502).end();
  }
}
