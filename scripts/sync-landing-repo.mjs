import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = process.argv[2];
if (!target) throw new Error('Usage: node scripts/sync-landing-repo.mjs <folder of the raitta-landing repo>');

for (const part of ['landing', 'server/api', 'scripts', 'src', 'public']) rmSync(join(target, part), { recursive: true, force: true });
mkdirSync(target, { recursive: true });
cpSync(join(ROOT, 'landing'), join(target, 'landing'), { recursive: true, filter: (path) => !/\.(apk|aab)$/.test(path) });
cpSync(join(ROOT, 'server', 'api'), join(target, 'server', 'api'), { recursive: true });
mkdirSync(join(target, 'scripts'), { recursive: true });
cpSync(join(ROOT, 'scripts', 'build-site.mjs'), join(target, 'scripts', 'build-site.mjs'));
mkdirSync(join(target, 'src', 'pages'), { recursive: true });
cpSync(join(ROOT, 'src', 'pages', 'privacyPolicy.ts'), join(target, 'src', 'pages', 'privacyPolicy.ts'));
mkdirSync(join(target, 'public'), { recursive: true });
cpSync(join(ROOT, 'public', 'favicon.svg'), join(target, 'public', 'favicon.svg'));

const { devDependencies } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
writeFileSync(
  join(target, 'package.json'),
  JSON.stringify(
    {
      name: 'raitta-landing',
      private: true,
      type: 'module',
      scripts: { build: 'node scripts/build-site.mjs' },
      devDependencies: { '@vercel/blob': devDependencies['@vercel/blob'] },
    },
    null,
    2,
  ) + '\n',
);
writeFileSync(join(target, '.gitignore'), ['node_modules', 'dist', '.vercel', '*.local', '*.apk', '*.aab', ''].join('\n'));
console.log('Landing synced to', target);
