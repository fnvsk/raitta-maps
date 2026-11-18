import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ANDROID = join(ROOT, 'android');

const sdk = process.env.ANDROID_HOME ?? ['D:/Android/sdk', join(homedir(), 'Android', 'sdk')].find((path) => existsSync(path)) ?? 'D:/Android/sdk';
const jdk = process.env.RAITA_JDK ?? join(homedir(), 'Android', 'jdk21');
if (!existsSync(sdk)) throw new Error(`No Android SDK at ${sdk}`);
if (!existsSync(jdk)) throw new Error(`No JDK 21 at ${jdk}`);

writeFileSync(join(ANDROID, 'local.properties'), `sdk.dir=${sdk.replaceAll('\\', '/')}\n`);

const versionCode = Math.floor((Date.now() - Date.UTC(2026, 0, 1)) / 60_000);
const day = new Date().toISOString().slice(0, 10).replaceAll('-', '.');
const versionName = `${day}.${versionCode % 1440}`;
const gradleFile = join(ANDROID, 'app', 'build.gradle');
writeFileSync(
  gradleFile,
  readFileSync(gradleFile, 'utf8')
    .replace(/versionCode \d+/, `versionCode ${versionCode}`)
    .replace(/versionName "[^"]*"/, `versionName "${versionName}"`),
);
const task = process.argv[2] ?? 'assembleDebug';

const gradle = join(ANDROID, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');
execFileSync(gradle, [task, '--no-daemon'], {
  cwd: ANDROID,
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, JAVA_HOME: jdk, ANDROID_HOME: sdk },
});
console.log('Built', task, versionName);

if (task === 'bundleRelease') {
  const keyFile = process.env.RAITTA_UPLOAD_PROPERTIES ?? join(homedir(), '.raitta', 'upload-key.properties');
  const out = join(ROOT, 'release', `raitta-${versionName}.aab`);
  mkdirSync(dirname(out), { recursive: true });
  copyFileSync(join(ANDROID, 'app', 'build', 'outputs', 'bundle', 'release', 'app-release.aab'), out);
  console.log(`Bundle: ${out} (${existsSync(keyFile) ? 'signed with the upload key' : `NOT signed: no upload key at ${keyFile}`})`);
}

if (task === 'assembleDebug') {
  copyFileSync(join(ANDROID, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk'), join(ROOT, 'landing', 'raitta.apk'));
  writeFileSync(
    join(ROOT, 'landing', 'app-version.json'),
    JSON.stringify({ android: { latest: versionCode, minimum: versionCode, name: versionName, url: 'https://raitta.fi/raitta.apk' } }, null, 2) + '\n',
  );
  console.log('Published to landing/raitta.apk and landing/app-version.json');
}
