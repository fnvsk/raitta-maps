const CACHE_S = 7 * 24 * 3600;
const MAX_BYTES = 600_000;

const decode = (text) =>
  text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, ' ')
    .trim();

function meta(html, names) {
  for (const name of names) {
    const tag = new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]*>`, 'i').exec(html)?.[0];
    const content = tag && /content=["']([^"']*)["']/i.exec(tag)?.[1];
    if (content) return decode(content);
  }
  return undefined;
}

const DAY = { monday: 'Mo', tuesday: 'Tu', wednesday: 'We', thursday: 'Th', friday: 'Fr', saturday: 'Sa', sunday: 'Su' };
const DAY_ORDER = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const clock = (value) => (/^\d{1,2}:\d\d/.test(String(value ?? '')) ? String(value).slice(0, 5).padStart(5, '0') : null);

function* objects(value) {
  if (Array.isArray(value)) for (const item of value) yield* objects(item);
  else if (value && typeof value === 'object') {
    yield value;
    for (const child of Object.values(value)) if (child && typeof child === 'object') yield* objects(child);
  }
}

export function openingHours(html) {
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let data;
    try {
      data = JSON.parse(match[1].trim());
    } catch {
      continue;
    }
    for (const item of objects(data)) {
      const spec = item.openingHoursSpecification;
      if (spec) {
        const days = new Map();
        for (const entry of Array.isArray(spec) ? spec : [spec]) {
          const opens = clock(entry?.opens);
          const closes = clock(entry?.closes);
          if (!opens || !closes || entry?.validThrough || entry?.validFrom) continue;
          const list = Array.isArray(entry.dayOfWeek) ? entry.dayOfWeek : [entry.dayOfWeek];
          for (const day of list) {
            const code = DAY[String(day ?? '').split('/').pop().toLowerCase()];
            if (!code) continue;

            if (opens === closes) continue;
            days.set(code, [...(days.get(code) ?? []), `${opens}-${closes === '00:00' ? '24:00' : closes}`]);
          }
        }
        if (days.size) {
          const rules = [];
          let from = null;
          let prev = null;
          for (const day of [...DAY_ORDER, null]) {
            const hours = day ? (days.get(day) ?? []).join(',') : null;
            if (hours !== prev) {
              if (from !== null && prev) {
                const to = DAY_ORDER[DAY_ORDER.indexOf(day ?? 'Su') - (day ? 1 : 0)];
                rules.push(`${from === to ? from : `${from}-${to}`} ${prev}`);
              }
              from = day;
              prev = hours;
            }
          }
          if (rules.length) return rules.join('; ');
        }
      }
      const plain = item.openingHours;
      if (plain && (typeof plain === 'string' || Array.isArray(plain))) {
        const text = (Array.isArray(plain) ? plain : [plain]).map(String).join('; ').trim();
        if (/\d{1,2}:\d\d/.test(text)) return text;
      }
    }
  }
  const micro = /itemprop=["']openingHours["'][^>]*content=["']([^"']+)["']/i.exec(html)?.[1];
  return micro && /\d{1,2}:\d\d/.test(micro) ? micro.trim() : undefined;
}

export default async function handler(req, res) {
  let url;
  try {
    url = new URL(String(req.query.url));
  } catch {
    return res.status(400).end();
  }
  if (!/^https?:$/.test(url.protocol) || /^(localhost|127\.|10\.|192\.168\.|169\.254\.)/.test(url.hostname)) return res.status(400).end();
  try {
    const page = await fetch(url, { headers: { 'User-Agent': 'RAITTA/1.0 (https://raitta.fi)', Accept: 'text/html' }, redirect: 'follow', signal: AbortSignal.timeout(5000) });
    const type = page.headers.get('content-type') ?? '';
    if (!page.ok || !type.includes('html')) return res.status(204).end();
    const html = (await page.text()).slice(0, MAX_BYTES);
    const image = meta(html, ['og:image:secure_url', 'og:image', 'twitter:image']);
    const body = {
      title: meta(html, ['og:title', 'twitter:title']),
      description: meta(html, ['og:description', 'description', 'twitter:description'])?.slice(0, 400),
      image: image ? new URL(image, page.url).href : undefined,
      hours: openingHours(html),
    };
    res.setHeader('Cache-Control', `public, s-maxage=${CACHE_S}, stale-while-revalidate=${CACHE_S}`);
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json(body);
  } catch {
    res.setHeader('Cache-Control', 'public, s-maxage=86400');
    return res.status(204).end();
  }
}
