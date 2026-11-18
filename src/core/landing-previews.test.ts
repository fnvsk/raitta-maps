import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import sharp from 'sharp';
import { it } from 'vitest';
import { buildNetwork } from './scheme';
import { drawScheme, LINE_WIDTH, smoothOutline, stationSpan, STOP_R } from './schemeDraw';
import { schemeFor } from './schemeHand';

it('draws the landing previews', async () => {
  for (const [region, mode, file] of [['helsinki', 'metro', 'helsinki-metro'], ['helsinki', 'tram', 'helsinki-tram'], ['helsinki', 'train', 'helsinki-rail'], ['tampere', 'tram', 'tampere-tram']] as const) {
    const load = (f: string) => JSON.parse(gunzipSync(readFileSync(`public/data/${region}/${f}`)).toString());
    const n = buildNetwork(mode, load('lines.json.gz'), load('patterns.json.gz'), load('stops.json.gz'));
    const layout = schemeFor(n);
    const drawn = drawScheme(n, layout.pos, { labels: false });
    const [x0, y0, x1, y1] = drawn.bounds;
    const pad = 60;
    const w = x1 - x0 + pad * 2;
    const h = y1 - y0 + pad * 2;
    const parts = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x0 - pad} ${y0 - pad} ${w} ${h}" width="${w}" height="${h}">`, `<rect x="${x0 - pad}" y="${y0 - pad}" width="${w}" height="${h}" fill="#121b2c"/>`];
    for (const a of layout.water.areas) parts.push(`<path d="${smoothOutline(a, true)}" fill="#18304d" stroke="#18304d" stroke-width="8" stroke-linejoin="round"/>`);
    for (const r of layout.water.rivers) parts.push(`<path d="${smoothOutline(r.path, false)}" fill="none" stroke="#18304d" stroke-width="${r.width}" stroke-linecap="round"/>`);
    for (const line of drawn.lines) for (const d of line.paths) parts.push(`<path d="${d}" fill="none" stroke="${line.color}" stroke-width="${LINE_WIDTH * 1.6}" stroke-linecap="round" stroke-linejoin="round"/>`);
    for (const s of drawn.stations) {
      const [a, b] = stationSpan(s);
      if (s.change) parts.push(`<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#fff" stroke-width="${LINE_WIDTH * 1.6 + 4}" stroke-linecap="round"/>`);
      else parts.push(`<circle cx="${a[0]}" cy="${a[1]}" r="${STOP_R * 1.4}" fill="#fff"/>`);
    }
    parts.push('</svg>');
    await sharp(Buffer.from(parts.join(''))).resize(720, 440, { fit: 'cover', position: 'centre' }).webp({ quality: 82 }).toFile(`landing/screens/schemes/${file}.webp`);
  }
}, 60_000);
