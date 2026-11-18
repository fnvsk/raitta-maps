import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';

const APP = 'com.raitta.fi';
const GROUP = process.env.TESTER_GROUP?.trim() || 'testers@raitta.fi';
const API = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${APP}`;

const [keyPath, track] = process.argv.slice(2);
if (!keyPath) {
  console.error('Usage: node scripts/play-testers.mjs <service-account.json> [track]');
  process.exit(1);
}
const key = JSON.parse(readFileSync(keyPath, 'utf8'));

const base64url = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');

async function accessToken() {
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${base64url({ alg: 'RS256', typ: 'JWT' })}.${base64url({
    iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })}`;
  const signature = createSign('RSA-SHA256').update(unsigned).sign(key.private_key).toString('base64url');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` }),
  });
  if (!res.ok) throw new Error(`Google sign-in failed: ${res.status} ${await res.text()}`);
  return (await res.json()).access_token;
}

const auth = await accessToken();
async function call(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${auth}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${text}`);
  return text ? JSON.parse(text) : {};
}

const edit = await call('POST', '/edits');
try {
  const { tracks = [] } = await call('GET', `/edits/${edit.id}/tracks`);
  if (!track) {
    console.log('Tracks of', APP);
    for (const { track: name, releases = [] } of tracks) console.log(` - ${name}${releases.length ? ` (${releases.map((r) => r.status).join(', ')})` : ''}`);
    console.log('\nClosed testing is usually "alpha" or the name you gave it. Run again with that name.');
  } else {
    if (!tracks.some((t) => t.track === track)) throw new Error(`No track "${track}". Run without a track name to list them.`);
    const before = await call('GET', `/edits/${edit.id}/testers/${encodeURIComponent(track)}`).catch(() => ({}));
    console.log('Groups before:', before.googleGroups ?? []);
    const groups = [...new Set([...(before.googleGroups ?? []), GROUP])];
    await call('PUT', `/edits/${edit.id}/testers/${encodeURIComponent(track)}`, { googleGroups: groups });
    await call('POST', `/edits/${edit.id}:commit`);
    console.log('Groups now:', groups);
    console.log(`Done: everyone in ${GROUP} can join the "${track}" test.`);
  }
} finally {
  if (!track) await call('DELETE', `/edits/${edit.id}`).catch(() => {});
}
