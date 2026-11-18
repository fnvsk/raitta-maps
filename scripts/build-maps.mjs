import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'dist-maps');
const link = join(OUT, '.vercel');
const kept = existsSync(link) ? join(mkdtempSync(join(tmpdir(), 'raitta-maps-')), '.vercel') : null;
if (kept) cpSync(link, kept, { recursive: true });

execSync('npx vite build --mode maps', { cwd: ROOT, stdio: 'inherit' });

if (kept) {
  cpSync(kept, link, { recursive: true });
  rmSync(dirname(kept), { recursive: true, force: true });
}
writeFileSync(
  join(OUT, 'vercel.json'),
  JSON.stringify(
    {
      buildCommand: '',
      outputDirectory: '.',

      rewrites: [{ source: '/:path((?!.*\\.).*)', destination: '/index.html' }],
      headers: [
        { source: '/data/(.*)', headers: [{ key: 'Access-Control-Allow-Origin', value: '*' }] },

        { source: '/assets/(.*)', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
        { source: '/data/(landmarks|brands)/(.*)', headers: [{ key: 'Cache-Control', value: 'public, max-age=2592000, stale-while-revalidate=604800' }] },
      ],
    },
    null,
    2,
  ),
);

const schemes = [
  { region: 'helsinki', kind: 'metro' },
  { region: 'helsinki', kind: 'tram' },
  { region: 'helsinki', kind: 'rail' },
  { region: 'tampere', kind: 'tram' },
];
const today = new Date().toISOString().slice(0, 10);
const pages = ['/', ...schemes.map(({ region, kind }) => `/schemes/${region}/${kind}`)];
writeFileSync(
  join(OUT, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages
    .map((path) => `  <url><loc>https://maps.raitta.fi${path}</loc><lastmod>${today}</lastmod><priority>${path === '/' ? '1.0' : '0.8'}</priority></url>`)
    .join('\n')}\n</urlset>\n`,
);
writeFileSync(join(OUT, 'robots.txt'), ['User-agent: *', 'Allow: /', 'Disallow: /data/', '', 'Sitemap: https://maps.raitta.fi/sitemap.xml', ''].join('\n'));
console.log('Built dist-maps for maps.raitta.fi');
