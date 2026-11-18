import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

type DevMiddleware = (
  req: { url?: string; method?: string; headers?: Record<string, string | string[] | undefined> },
  res: { statusCode: number; setHeader: (name: string, value: string) => void; end: (body?: string) => void },
  next: () => void,
) => void;

export default defineConfig(({ mode }) => {
  const native = mode === 'native';

  const maps = mode === 'maps';
  const base = native || maps ? '/' : '/app/';
  return {
  base,
  define: { __BUILD_TIME__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ')) },
  build: native ? { outDir: 'dist-native', copyPublicDir: false } : { outDir: maps ? 'dist-maps' : 'dist/app' },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  plugins: [
    native && {
      name: 'raitta-native-viewport',
      transformIndexHtml: (html: string) => html.replace(', viewport-fit=cover', ''),
    },

    {
      name: 'raitta-dev-api',
      apply: 'serve' as const,
      configureServer(server: { middlewares: { use: (handler: DevMiddleware) => void } }) {
        server.middlewares.use(async (req, res, next) => {
          const url = new URL(req.url ?? '/', 'http://localhost');
          const name = /^\/api\/(chargers|charger-status|road-events|long-trains|place-extra|station|road-reports)$/.exec(url.pathname)?.[1];
          if (!name) return next();
          const reply = Object.assign(res, {
            status: (code: number) => Object.assign(res, { statusCode: code }) && reply,
            json: (body: unknown) => {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(body));
            },
          });
          try {
            const { default: handler } = await import(new URL(`./server/api/${name}.mjs`, import.meta.url).href);

            let body: unknown;
            if (req.method === 'POST') {
              const chunks: Buffer[] = [];
              for await (const chunk of req as unknown as AsyncIterable<Buffer>) chunks.push(chunk);
              const text = Buffer.concat(chunks).toString('utf8');
              try {
                body = text ? JSON.parse(text) : undefined;
              } catch {
                body = text;
              }
            }
            await handler({ query: Object.fromEntries(url.searchParams), method: req.method ?? 'GET', headers: req.headers ?? {}, body }, reply);
          } catch (error) {
            console.error(error);
            reply.status(500).end();
          }
        });
      },
    },
    react(),
    tailwindcss(),
    VitePWA({
      disable: native,
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'RAITTA',
        short_name: 'RAITTA',
        description: 'Real-time public transport across Finland. Move with the city.',
        lang: 'fi',

        id: base,
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#155EEF',
        theme_color: '#155EEF',
        categories: ['navigation', 'travel'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,woff2}', 'data/regions.json'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: `${base}index.html`,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith(`${base}data/landmarks/`) || url.pathname.startsWith(`${base}data/brands/`),
            handler: 'CacheFirst',
            options: {
              cacheName: 'raita-map-images',
              expiration: { maxEntries: 600, maxAgeSeconds: 60 * 24 * 3600 },
            },
          },
          {
            urlPattern: ({ url }) => url.hostname === 'upload.wikimedia.org' || (url.hostname === 'commons.wikimedia.org' && url.pathname.startsWith('/wiki/Special:FilePath')),
            handler: 'CacheFirst',
            options: {
              cacheName: 'raita-photos',
              expiration: { maxEntries: 120, maxAgeSeconds: 30 * 24 * 3600 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }) => url.hostname.endsWith('.wikipedia.org') && url.pathname.startsWith('/api/rest_v1/page/summary/'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'raita-wiki',
              expiration: { maxEntries: 200, maxAgeSeconds: 14 * 24 * 3600 },
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith(`${base}data/`),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'raita-transit-data',
              expiration: { maxEntries: 400, maxAgeSeconds: 14 * 24 * 3600 },
            },
          },
          {
            urlPattern: ({ url }) => url.hostname === 'tiles.openfreemap.org',
            handler: 'CacheFirst',
            options: {
              cacheName: 'raita-map-tiles',
              expiration: { maxEntries: 400, maxAgeSeconds: 7 * 24 * 3600 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  };
});
