import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const envFile = join(ROOT, '.env.local');
const fromFile = existsSync(envFile) ? readFileSync(envFile, 'utf8').match(/^TELEGRAM_BOT_TOKEN=(.+)$/m)?.[1]?.trim() : undefined;
const token = process.env.TELEGRAM_BOT_TOKEN ?? fromFile;
const url = process.argv[2];

if (!token) throw new Error('Set TELEGRAM_BOT_TOKEN in .env.local');
if (!url?.startsWith('https://')) throw new Error('Pass the deployed app URL. Telegram requires https.');

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

const TEXTS = {
  '': ['Open RAITTA', 'Real-time public transport across Finland: live vehicles, departures and trip planning.'],
  fi: ['Avaa RAITTA', 'Joukkoliikenne koko Suomessa reaaliajassa: ajoneuvot, lähdöt ja reittisuunnittelu.'],
  sv: ['Öppna RAITTA', 'Kollektivtrafik i hela Finland i realtid: fordon, avgångar och reseplanering.'],
  ru: ['Открыть RAITTA', 'Общественный транспорт Финляндии в реальном времени: транспорт на карте, отправления и маршруты.'],
  et: ['Ava RAITTA', 'Soome ühistransport reaalajas: sõidukid, väljumised ja teekonna planeerimine.'],
};

for (const [language_code, [text, description]] of Object.entries(TEXTS)) {
  await call('setMyDescription', { description, language_code });
  await call('setMyShortDescription', { short_description: description.slice(0, 120), language_code });
  if (language_code === '') await call('setChatMenuButton', { menu_button: { type: 'web_app', text, web_app: { url } } });
}
