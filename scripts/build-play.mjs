import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const run = (command, env = {}) => execSync(command, { cwd: ROOT, stdio: 'inherit', env: { ...process.env, ...env } });

run('npx tsc --noEmit');
run('npx vite build --mode native', { VITE_CHANNEL: 'play' });
run('npx cap sync android');
run('node scripts/build-android.mjs bundleRelease');
