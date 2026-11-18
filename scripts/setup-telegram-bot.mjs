import { randomBytes } from 'node:crypto';
import { appendFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ENV_FILE = join(ROOT, '.env.local');
const WEBHOOK = 'https://raita-xi.vercel.app/api/telegram';

const env = readFileSync(ENV_FILE, 'utf8');
const read = (name) => env.match(new RegExp(`^${name}=(.+)$`, 'm'))?.[1]?.trim();
const token = read('TELEGRAM_BOT_TOKEN');
if (!token) throw new Error('Set TELEGRAM_BOT_TOKEN in .env.local');
let secret = read('TELEGRAM_WEBHOOK_SECRET');
if (!secret) {
  secret = randomBytes(24).toString('hex');
  appendFileSync(ENV_FILE, `\nTELEGRAM_WEBHOOK_SECRET=${secret}\n`);
}

async function call(method, body) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(`${method}: ${json.description}`);
  console.log(`${method}: ok`);
}

await call('setWebhook', { url: WEBHOOK, secret_token: secret, allowed_updates: ['message'], drop_pending_updates: true });

const EMAIL = 'online@raitta.fi';
const DEVELOPER = '@raitta';

const TEXTS = {
  '': ['Real-time public transport across Finland: live vehicles, departures and trip planning in 19 cities.', 'Public transport across Finland in real time.', 'Open RAITTA', 'Contact', 'Developer'],
  fi: ['Joukkoliikenne koko Suomessa reaaliajassa: ajoneuvot kartalla, lähdöt ja reittisuunnittelu 19 kaupungissa.', 'Joukkoliikenne koko Suomessa reaaliajassa.', 'Avaa RAITTA', 'Yhteys', 'Kehittäjä'],
  sv: ['Kollektivtrafik i hela Finland i realtid: fordon på kartan, avgångar och reseplanering i 19 städer.', 'Kollektivtrafik i hela Finland i realtid.', 'Öppna RAITTA', 'Kontakt', 'Utvecklare'],
  ru: ['Общественный транспорт Финляндии в реальном времени: транспорт на карте, отправления и маршруты в 19 городах.', 'Транспорт Финляндии в реальном времени.', 'Открыть RAITTA', 'Почта', 'Разработчик'],
  et: ['Soome ühistransport reaalajas: sõidukid kaardil, väljumised ja teekonnad 19 linnas.', 'Soome ühistransport reaalajas.', 'Ava RAITTA', 'Kontakt', 'Arendaja'],
};
for (const [language_code, [about, short, open, contact, developer]] of Object.entries(TEXTS)) {
  const description = `${about}\n\n✉️ ${contact}: ${EMAIL}\n👤 ${developer}: ${DEVELOPER}\n🌐 raitta.fi`;

  const short_description = `${short} ${EMAIL} · ${DEVELOPER}`.slice(0, 120);
  await call('setMyDescription', { description, language_code });
  await call('setMyShortDescription', { short_description, language_code });
  await call('setMyCommands', { commands: [{ command: 'start', description: open }], language_code });
}
