import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const apk = join(ROOT, 'landing', 'raitta.apk');
const oldApk = join(ROOT, 'landing', 'raita.apk');
const hasApk = existsSync(apk);

const SITE = 'https://raitta.fi';
const LANGUAGES = ['fi', 'en', 'sv', 'ru', 'et'];
const seoHead = (path, languages = LANGUAGES) =>
  [
    `<link rel="canonical" href="${SITE}${path}" />`,
    ...languages.map((code) => `<link rel="alternate" hreflang="${code}" href="${SITE}${path}?lang=${code}" />`),
    `<link rel="alternate" hreflang="x-default" href="${SITE}${path}" />`,
    `<script>
      window.raittaLanguage = function (known) {
        var asked = new URLSearchParams(location.search).get('lang');
        return asked && Object.prototype.hasOwnProperty.call(known, asked) ? asked : null;
      };
      window.raittaSeo = function (code, description) {
        var asked = new URLSearchParams(location.search).get('lang');
        var canonical = document.querySelector('link[rel=canonical]');
        if (canonical) canonical.href = canonical.href.split('?')[0] + (asked === code ? '?lang=' + code : '');
        var meta = document.querySelector('meta[name=description]');
        if (meta && description) meta.content = description;
      };
    </script>`,
  ].join('\n    ');
const withSeo = (page, path, languages) => page.replace('</head>', () => `    ${seoHead(path, languages)}\n  </head>`);

const STRUCTURED = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'Organization', '@id': `${SITE}/#org`, name: 'RAITTA', url: `${SITE}/`, logo: 'https://maps.raitta.fi/apple-touch-icon.png', email: 'online@raitta.fi' },
    { '@type': 'WebSite', '@id': `${SITE}/#site`, url: `${SITE}/`, name: 'RAITTA', inLanguage: LANGUAGES, publisher: { '@id': `${SITE}/#org` } },
    {
      '@type': 'MobileApplication',
      name: 'RAITTA',
      url: `${SITE}/`,
      downloadUrl: `${SITE}/download`,
      operatingSystem: 'Android, iOS, Web',
      applicationCategory: 'TravelApplication',
      description: 'Real-time public transport across Finland: live buses, trams, metro and trains on the map, journey planning, timetables, network maps and car navigation.',
      image: `${SITE}/screens/share-2026-11.jpg`,
      inLanguage: LANGUAGES,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
      publisher: { '@id': `${SITE}/#org` },
    },
  ],
};
const html = withSeo(readFileSync(join(ROOT, 'landing', 'index.html'), 'utf8').replace('__APK_AVAILABLE__', String(hasApk)), '/').replace(
  '</head>',
  () => `    <script type="application/ld+json">${JSON.stringify(STRUCTURED)}</script>\n  </head>`,
);
writeFileSync(join(DIST, 'index.html'), html);
copyFileSync(join(ROOT, 'public', 'favicon.svg'), join(DIST, 'favicon.svg'));
if (hasApk) copyFileSync(apk, join(DIST, 'raitta.apk'));

if (existsSync(join(ROOT, 'landing', 'app-version.json'))) copyFileSync(join(ROOT, 'landing', 'app-version.json'), join(DIST, 'app-version.json'));
if (existsSync(oldApk)) copyFileSync(oldApk, join(DIST, 'raita.apk'));

mkdirSync(join(DIST, 'download'), { recursive: true });
writeFileSync(join(DIST, 'download', 'index.html'), withSeo(readFileSync(join(ROOT, 'landing', 'download.html'), 'utf8'), '/download'));
copyFileSync(join(ROOT, 'landing', 'ticket-test.html'), join(DIST, 'ticket-test.html'));
cpSync(join(ROOT, 'landing', 'screens'), join(DIST, 'screens'), { recursive: true });
cpSync(join(ROOT, 'landing', 'fonts'), join(DIST, 'fonts'), { recursive: true });
cpSync(join(ROOT, 'landing', 'mascot'), join(DIST, 'mascot'), { recursive: true });

cpSync(join(ROOT, 'landing', 'mail'), join(DIST, 'mail'), { recursive: true });

cpSync(join(ROOT, 'landing', 'bot'), join(DIST, 'bot'), { recursive: true });

const { PRIVACY_POLICY } = await import('../src/pages/privacyPolicy.ts');
const escapeHtml = (text) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;');
const tableHtml = ({ head, rows }) =>
  `<div class="table"><table><thead><tr>${head.map((cell) => `<th>${escapeHtml(cell)}</th>`).join('')}</tr></thead><tbody>${rows
    .map((row) => `<tr>${row.map((cell, i) => `<td data-head="${escapeHtml(head[i])}">${escapeHtml(cell)}</td>`).join('')}</tr>`)
    .join('')}</tbody></table></div>`;
const policySection = ({ id, title, paragraphs = [], items = [], table }) =>
  `<section id="${id}"><h2>${escapeHtml(title)}</h2>${paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('')}${table ? tableHtml(table) : ''}${
    items.length ? `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''
  }</section>`;

const localSections = (code, policy) => policy.sections.map((section) => ({ ...section, id: `${code}-${section.id}` }));
const policyHtml = (code, policy) =>
  `<article data-policy="${code}" lang="${code}"${code === 'fi' ? '' : ' hidden'}><header class="hero"><div class="wrap"><h1>${escapeHtml(policy.title)}</h1><p class="date">${escapeHtml(policy.effective)}</p><ul class="summary">${policy.summary
    .map((point) => `<li>${escapeHtml(point)}</li>`)
    .join('')}</ul></div></header><div class="body"><div class="wrap layout"><nav class="toc" aria-label="${code === 'fi' ? 'Sisällys' : 'Contents'}">${localSections(code, policy)
    .map((section) => `<a href="#${section.id}">${escapeHtml(section.title)}</a>`)
    .join('')}</nav><div>${localSections(code, policy).map(policySection).join('')}</div></div></div></article>`;
const policyPage = readFileSync(join(ROOT, 'landing', 'privacy.html'), 'utf8').replace(
  '<!--POLICY-->',
  () => policyHtml('fi', PRIVACY_POLICY.fi) + policyHtml('en', PRIVACY_POLICY.en),
);
writeFileSync(join(DIST, 'privacy.html'), withSeo(policyPage, '/privacy', ['fi', 'en']));

mkdirSync(join(DIST, 'privacy'), { recursive: true });
writeFileSync(join(DIST, 'privacy', 'index.html'), withSeo(policyPage, '/privacy', ['fi', 'en']));

const { ANDROID_PRIVACY_POLICY } = await import('../src/pages/privacyPolicy.ts');
const androidPage = readFileSync(join(ROOT, 'landing', 'privacy.html'), 'utf8')
  .replace('<!--POLICY-->', () => policyHtml('fi', ANDROID_PRIVACY_POLICY.fi) + policyHtml('en', ANDROID_PRIVACY_POLICY.en))
  .replaceAll('RAITTA · Privacy Policy', 'RAITTA · Android App Privacy Policy')
  .replaceAll('How RAITTA handles personal data under the GDPR and Finnish law.', 'Permissions, data and deletion in the RAITTA app for Android.')
  .replace('content="https://raitta.fi/privacy"', 'content="https://raitta.fi/privacy/android"');
mkdirSync(join(DIST, 'privacy', 'android'), { recursive: true });
writeFileSync(join(DIST, 'privacy', 'android', 'index.html'), withSeo(androidPage, '/privacy/android', ['fi', 'en']));

const { DATA_DELETION } = await import('../src/pages/privacyPolicy.ts');
const deletionPage = readFileSync(join(ROOT, 'landing', 'privacy.html'), 'utf8')
  .replace('<!--POLICY-->', () => policyHtml('fi', DATA_DELETION.fi) + policyHtml('en', DATA_DELETION.en))
  .replaceAll('RAITTA · Privacy Policy', 'RAITTA · Delete your data')
  .replaceAll('How RAITTA handles personal data under the GDPR and Finnish law.', 'How to delete your RAITTA data, and what is kept.')
  .replace('content="https://raitta.fi/privacy"', 'content="https://raitta.fi/privacy/delete"');
mkdirSync(join(DIST, 'privacy', 'delete'), { recursive: true });
writeFileSync(join(DIST, 'privacy', 'delete', 'index.html'), withSeo(deletionPage, '/privacy/delete', ['fi', 'en']));
mkdirSync(join(DIST, 'feedback'), { recursive: true });
writeFileSync(join(DIST, 'feedback', 'index.html'), withSeo(readFileSync(join(ROOT, 'landing', 'feedback.html'), 'utf8'), '/feedback'));
mkdirSync(join(DIST, 'testers'), { recursive: true });
writeFileSync(join(DIST, 'testers', 'index.html'), withSeo(readFileSync(join(ROOT, 'landing', 'testers.html'), 'utf8'), '/testers'));

const SITEMAP_PAGES = [
  ['/', LANGUAGES, '1.0'],
  ['/download', LANGUAGES, '0.8'],
  ['/testers', LANGUAGES, '0.6'],
  ['/feedback', LANGUAGES, '0.4'],
  ['/privacy', ['fi', 'en'], '0.3'],
  ['/privacy/android', ['fi', 'en'], '0.2'],
  ['/privacy/delete', ['fi', 'en'], '0.2'],
];
const today = new Date().toISOString().slice(0, 10);
const alternates = (path, languages) =>
  [...languages.map((code) => `<xhtml:link rel="alternate" hreflang="${code}" href="${SITE}${path}?lang=${code}"/>`), `<xhtml:link rel="alternate" hreflang="x-default" href="${SITE}${path}"/>`].join('');
writeFileSync(
  join(DIST, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${SITEMAP_PAGES.flatMap(([path, languages, priority]) =>
    [path, ...languages.map((code) => `${path}?lang=${code}`)].map(
      (address) => `  <url><loc>${SITE}${address}</loc>${alternates(path, languages)}<lastmod>${today}</lastmod><priority>${priority}</priority></url>`,
    ),
  ).join('\n')}\n</urlset>\n`,
);
writeFileSync(
  join(DIST, 'robots.txt'),
  ['User-agent: *', 'Allow: /', 'Disallow: /api/', 'Disallow: /ticket-test.html', 'Disallow: /app/data/', '', `Sitemap: ${SITE}/sitemap.xml`, 'Sitemap: https://maps.raitta.fi/sitemap.xml', ''].join('\n'),
);

copyFileSync(join(ROOT, 'landing', '404.html'), join(DIST, '404.html'));

const assetLinks = join(ROOT, 'landing', 'assetlinks.json');
if (existsSync(assetLinks)) {
  mkdirSync(join(DIST, '.well-known'), { recursive: true });
  copyFileSync(assetLinks, join(DIST, '.well-known', 'assetlinks.json'));
}

cpSync(join(ROOT, 'server', 'api'), join(DIST, 'api'), { recursive: true });
const { devDependencies } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
writeFileSync(join(DIST, 'package.json'), JSON.stringify({ private: true, type: 'module', dependencies: { '@vercel/blob': devDependencies['@vercel/blob'] } }));

writeFileSync(
  join(DIST, 'vercel.json'),
  JSON.stringify({
    buildCommand: '',
    outputDirectory: '.',
    rewrites: [{ source: '/app/:path((?!.*\\.).*)', destination: '/app/index.html' }],

    redirects: [
      { source: '/schemes', destination: '/app/schemes/helsinki/metro', permanent: false },
      { source: '/schemes/:region/:kind', destination: '/app/schemes/:region/:kind', permanent: false },
    ],
    headers: [
      {
        source: '/app/data/(.*)',
        headers: [{ key: 'Access-Control-Allow-Origin', value: '*' }],
      },
      {
        source: '/app/assets/(.*)',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/app/data/(landmarks|brands)/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=2592000, stale-while-revalidate=604800' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
        ],
      },
      {
        source: '/app-version.json',
        headers: [
          { key: 'Cache-Control', value: 'no-store' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
        ],
      },
      {
        source: '/.well-known/assetlinks.json',
        headers: [{ key: 'Content-Type', value: 'application/json' }],
      },
    ],
  }),
);

writeFileSync(join(DIST, '_redirects'), '/app/* /app/index.html 200\n');
console.log(`Site assembled in dist (APK ${hasApk ? 'included' : 'not available yet'})`);
