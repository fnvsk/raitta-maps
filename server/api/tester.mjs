import { testerMail } from './_tester-mail.mjs';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN?.trim().replace(/^["']|["']$/g, '');

const CHAT_ID = process.env.FEEDBACK_CHAT_ID?.trim() || '6575276233';

const RESEND_KEY = process.env.TESTER_MAIL?.trim() === 'on' ? process.env.RESEND_API_KEY?.trim() : undefined;
const MAIL_FROM = process.env.TESTER_MAIL_FROM?.trim() || 'RAITTA <testers@raitta.fi>';
const MAIL_REPLY_TO = 'online@raitta.fi';

const ORIGINS = new Set(['https://raita-xi.vercel.app', 'https://raitta.fi', 'https://www.raitta.fi', 'https://localhost']);
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

const MAX_PER_WINDOW = 3;
const WINDOW_MS = 10 * 60 * 1000;
const recent = new Map();

const escapeHtml = (text) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const field = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

function allowed(ip) {
  const now = Date.now();
  const times = (recent.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (times.length >= MAX_PER_WINDOW) return false;
  recent.set(ip, [...times, now]);
  return true;
}

async function sendMail(signUp) {
  if (!RESEND_KEY) return false;
  const { subject, html, text } = testerMail(signUp);
  const sent = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: MAIL_FROM, to: [signUp.email], reply_to: MAIL_REPLY_TO, subject, html, text }),
  });
  if (!sent.ok) console.error('tester mail', sent.status, await sent.text());
  return sent.ok;
}

export default async function handler(req, res) {
  const origin = req.headers.origin;
  if (!ORIGINS.has(origin)) return res.status(403).end();
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }
  if (req.method !== 'POST') return res.status(405).end();
  if (!TOKEN || !CHAT_ID) return res.status(503).json({ error: 'not configured' });

  const body = req.body ?? {};

  if (field(body.website, 200)) return res.status(200).json({ ok: true });
  const signUp = {
    email: field(body.email, 254),
    name: field(body.name, 80),
    device: field(body.device, 80),
    city: field(body.city, 60),
    language: field(body.language, 5),
  };
  if (!EMAIL.test(signUp.email)) return res.status(400).json({ error: 'email' });
  if (body.consent !== 'on' && body.consent !== true) return res.status(400).json({ error: 'consent' });
  const ip = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || 'unknown';
  if (!allowed(ip)) return res.status(429).json({ error: 'too many' });

  const mailed = await sendMail(signUp).catch((error) => {
    console.error('tester mail', error);
    return false;
  });

  const { email, name, device, city, language } = signUp;
  const lines = [
    `<b>🧪 New tester</b> · RAITTA${language ? ` · ${escapeHtml(language)}` : ''}`,
    '',
    `📧 <code>${escapeHtml(email)}</code>`,
    name ? `👤 ${escapeHtml(name)}` : '',
    device ? `📱 ${escapeHtml(device)}` : '',
    city ? `📍 ${escapeHtml(city)}` : '',
    RESEND_KEY ? (mailed ? '✉️ Confirmation sent' : '⚠️ Confirmation email failed') : '',
  ].filter(Boolean);
  const sent = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT_ID, text: lines.join('\n'), parse_mode: 'HTML', disable_web_page_preview: true }),
  });
  if (!sent.ok) {
    console.error('tester', sent.status, await sent.text());
    return res.status(502).json({ error: 'delivery' });
  }
  return res.status(200).json({ ok: true, mailed });
}
