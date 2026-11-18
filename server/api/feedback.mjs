const TOKEN = process.env.TELEGRAM_BOT_TOKEN?.trim().replace(/^["']|["']$/g, '');

const CHAT_ID = process.env.FEEDBACK_CHAT_ID?.trim() || '6575276233';

const ORIGINS = new Set(['https://raita-xi.vercel.app', 'https://raitta.fi', 'https://www.raitta.fi', 'https://maps.raitta.fi', 'https://localhost', 'capacitor://localhost']);
const KINDS = { idea: '💡 Idea', bug: '🐞 Bug', question: '❓ Question', other: '✉️ Other' };
const MIN_LENGTH = 5;
const MAX_LENGTH = 3000;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

const escapeHtml = (text) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const field = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

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
  const kind = KINDS[body.kind] ? body.kind : 'other';
  const message = field(body.message, MAX_LENGTH);
  const name = field(body.name, 80);
  const email = field(body.email, 254);
  const language = field(body.language, 5);
  if (message.length < MIN_LENGTH) return res.status(400).json({ error: 'message' });
  if (email && !EMAIL.test(email)) return res.status(400).json({ error: 'email' });

  const lines = [
    `<b>${KINDS[kind]}</b> · RAITTA${language ? ` · ${escapeHtml(language)}` : ''}`,
    '',
    escapeHtml(message),
    '',
    name ? `👤 ${escapeHtml(name)}` : '',
    email ? `📧 ${escapeHtml(email)}` : '📧 —',
  ].filter((line, i, all) => line !== '' || (i > 0 && all[i - 1] !== ''));
  const sent = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT_ID, text: lines.join('\n'), parse_mode: 'HTML', disable_web_page_preview: true }),
  });
  if (!sent.ok) {
    console.error('feedback', sent.status, await sent.text());
    return res.status(502).json({ error: 'delivery' });
  }
  return res.status(200).json({ ok: true });
}
