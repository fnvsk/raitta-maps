import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'assets', 'telegram-emoji');
const FRAMES = join(OUT, 'frames');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

const OWNER = 6575276233;
const PACK = 'raitta_by_Raita_Robot';
const FPS = 30;
const SECONDS = 2;
const MAX_BYTES = 256 * 1024;

const BLUE = '#155eef';
const TRAM = '#9333ea';
const METRO = '#ea580c';
const TRAIN = '#15803d';
const FERRY = '#0e7490';
const CORAL = '#ff5c35';
const SUN = '#ffc83d';
const INK = '#0e1526';

const LOGO = [
  ['path', { d: 'M21 50V14h17.5a12.5 12.5 0 0 1 0 25H21', class: 'draw' }],
  ['path', { d: 'M38 39l11 11', class: 'draw tail' }],
];
const CLOCK = [
  ['circle', { cx: 12, cy: 12, r: 10 }],
  ['path', { d: 'M12 12V6.5', class: 'long' }],
  ['path', { d: 'M12 12h3.5', class: 'short' }],
];

const lights = (a, b, y) =>
  `<circle class="light" cx="${a}" cy="${y}" r="1.7" fill="${SUN}" stroke="none"/><circle class="light" cx="${b}" cy="${y}" r="1.7" fill="${SUN}" stroke="none"/>`;
const ROAD = `<g class="road" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity="0.45"><path d="M8 92h14M38 92h14M68 92h14M98 92h14"/></g>`;
const RIDE = `
  .icon { animation: ride 0.5s ease-in-out infinite; }
  .light { animation: glow 1s ease-in-out infinite; }
  .road { animation: road 0.5s linear infinite; }
  @keyframes ride { 50% { transform: translateY(-2.2px) rotate(-1.2deg); } }
  @keyframes glow { 50% { opacity: 0.25; } }
  @keyframes road { to { transform: translateX(-30px); } }`;
const vehicle = (name, icon, color, emoji, [a, b, y]) => ({ name, icon, color, emoji, back: ROAD, inner: lights(a, b, y), css: RIDE });

const EMOJI = [
  {
    name: 'logo', node: LOGO, viewBox: 64, color: BLUE, emoji: '🔵',
    front: `<rect class="shine" x="-60" y="-20" width="26" height="140" fill="#fff" opacity="0.28" transform="rotate(20 50 50)"/>`,
    css: `
      .draw { stroke-dasharray: 120; animation: draw 2s ease-in-out infinite; }
      .tail { stroke-dasharray: 20; animation-name: tail; }
      .shine { animation: shine 2s ease-in-out infinite; }
      @keyframes draw { 0% { stroke-dashoffset: 120; } 40%, 88% { stroke-dashoffset: 0; } 100% { stroke-dashoffset: -120; } }
      @keyframes tail { 0%, 30% { stroke-dashoffset: 20; } 50%, 88% { stroke-dashoffset: 0; } 100% { stroke-dashoffset: -20; } }
      @keyframes shine { 0%, 45% { transform: translateX(0); } 75%, 100% { transform: translateX(190px); } }`,
  },
  vehicle('bus', 'bus-front', BLUE, '🚌', [8, 16, 15]),
  vehicle('tram', 'tram-front', TRAM, '🚋', [8, 16, 15]),
  vehicle('metro', 'train-front-tunnel', METRO, '🚇', [10, 14, 15]),
  vehicle('train', 'train-front', TRAIN, '🚆', [8.6, 15.4, 14.4]),
  {
    name: 'ferry', icon: 'ship', color: FERRY, emoji: '⛴',
    front: `<g class="waves" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity="0.55"><path d="M-40 90q7-6 14 0t14 0 14 0 14 0 14 0 14 0 14 0 14 0 14 0 14 0 14 0 14 0"/></g>`,
    css: `
      .icon { animation: rock 2s ease-in-out infinite; }
      .waves { animation: waves 1s linear infinite; }
      @keyframes rock { 0%, 100% { transform: rotate(-7deg) translateY(1px); } 50% { transform: rotate(7deg) translateY(-2px); } }
      @keyframes waves { to { transform: translateX(28px); } }`,
  },
  {
    name: 'stop', icon: 'bus-front', color: SUN, ink: INK, emoji: '🚏',
    css: `
      .icon { transform-origin: 50px 12px; animation: swing 2s ease-in-out infinite; }
      @keyframes swing { 0%, 100% { transform: rotate(-9deg); } 50% { transform: rotate(9deg); } }`,
  },
  {
    name: 'pin', icon: 'map-pin', color: CORAL, emoji: '📍',
    back: `<ellipse class="shadow" cx="50" cy="84" rx="13" ry="3.5" fill="${INK}" opacity="0.25"/>`,
    css: `
      .icon { transform-origin: 50px 80px; animation: drop 2s cubic-bezier(0.3, 0, 0.3, 1) infinite; }
      .shadow { transform-origin: 50px 84px; animation: shadow 2s cubic-bezier(0.3, 0, 0.3, 1) infinite; }
      @keyframes drop { 0% { transform: translateY(-34px); opacity: 0; } 12% { opacity: 1; } 30% { transform: translateY(0) scale(1.12, 0.86); } 42% { transform: translateY(-10px) scale(0.96, 1.05); } 54%, 86% { transform: none; opacity: 1; } 100% { transform: translateY(-34px); opacity: 0; } }
      @keyframes shadow { 0%, 100% { transform: scale(0.2); opacity: 0; } 30%, 88% { transform: none; opacity: 0.25; } }`,
  },
  {
    name: 'here', icon: 'locate-fixed', color: BLUE, emoji: '🎯',
    back: `<circle class="ring" cx="50" cy="50" r="20" fill="none" stroke="#fff" stroke-width="3"/><circle class="ring late" cx="50" cy="50" r="20" fill="none" stroke="#fff" stroke-width="3"/>`,
    inner: `<circle class="dot" cx="12" cy="12" r="1.6" fill="${SUN}" stroke="none"/>`,
    css: `
      .ring { transform-origin: 50px 50px; animation: ring 2s ease-out infinite; }
      .late { animation-delay: -1s; }
      .icon { animation: aim 2s ease-in-out infinite; }
      @keyframes ring { from { transform: scale(0.6); opacity: 0.8; } to { transform: scale(2.3); opacity: 0; } }
      @keyframes aim { 0%, 100% { transform: rotate(0); } 50% { transform: rotate(45deg); } }`,
  },
  {
    name: 'navigate', icon: 'navigation', color: BLUE, emoji: '🧭',
    back: `<g class="trail" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity="0.4"><path d="M30 78l-12 12M44 86l-8 8M22 64l-8 8"/></g>`,
    css: `
      .icon { animation: fly 1s ease-in-out infinite; }
      .trail { animation: trail 1s linear infinite; }
      @keyframes fly { 50% { transform: translate(3px, -3px) scale(1.04); } }
      @keyframes trail { 0% { transform: translate(8px, -8px); opacity: 0; } 40% { opacity: 0.45; } 100% { transform: translate(-10px, 10px); opacity: 0; } }`,
  },
  {
    name: 'route', icon: 'route', color: TRAM, emoji: '🗺',
    inner: `<circle r="2" fill="${SUN}" stroke="${INK}" stroke-width="0.9"><animateMotion dur="2s" repeatCount="indefinite" path="M6 19h11.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H18"/></circle>`,
    css: '',
  },
  {
    name: 'walk', icon: 'footprints', color: TRAIN, emoji: '🚶',
    css: `
      .icon { animation: step 1s ease-in-out infinite; }
      @keyframes step { 0%, 100% { transform: rotate(-6deg) translateY(1px); } 25% { transform: translateY(-3px); } 50% { transform: rotate(6deg) translateY(1px); } 75% { transform: translateY(-3px); } }`,
  },
  {
    name: 'bike', icon: 'bike', color: TRAIN, emoji: '🚲', back: ROAD,
    css: `
      .icon { animation: pedal 0.5s ease-in-out infinite; }
      .road { animation: road 0.5s linear infinite; }
      @keyframes pedal { 50% { transform: translateY(-2px) rotate(-2deg); } }
      @keyframes road { to { transform: translateX(-30px); } }`,
  },
  {
    name: 'clock', node: CLOCK, color: SUN, ink: INK, emoji: '🕒',
    css: `
      .long { transform-origin: 12px 12px; animation: turn 2s linear infinite; }
      .short { transform-origin: 12px 12px; animation: turn 24s linear infinite; }
      @keyframes turn { to { transform: rotate(360deg); } }`,
  },
  {
    name: 'ticket', icon: 'ticket', color: BLUE, emoji: '🎫',
    front: `<rect class="shine" x="-60" y="-20" width="22" height="140" fill="#fff" opacity="0.3" transform="rotate(20 50 50)"/>`,
    css: `
      .icon { animation: tilt 2s ease-in-out infinite; }
      .shine { animation: shine 2s ease-in-out infinite; }
      @keyframes tilt { 0%, 100% { transform: rotate(-8deg); } 50% { transform: rotate(8deg) scale(1.05); } }
      @keyframes shine { 0%, 30% { transform: translateX(0); } 70%, 100% { transform: translateX(190px); } }`,
  },
  {
    name: 'fuel', icon: 'fuel', color: CORAL, emoji: '⛽',
    front: `<path class="drop" d="M77 52c0 0-6 7-6 11a6 6 0 0 0 12 0c0-4-6-11-6-11z" fill="${SUN}" stroke="${INK}" stroke-width="2"/>`,
    css: `
      .drop { animation: drip 2s ease-in infinite; }
      .icon { animation: fill 2s ease-in-out infinite; }
      @keyframes drip { 0%, 20% { transform: translateY(-14px) scale(0.4); opacity: 0; } 35% { opacity: 1; transform: translateY(-6px); } 80% { transform: translateY(16px); opacity: 1; } 100% { transform: translateY(22px); opacity: 0; } }
      @keyframes fill { 0%, 100% { transform: none; } 85% { transform: scale(1.06); } }`,
  },
  {
    name: 'star', icon: 'star', color: SUN, ink: INK, emoji: '⭐',
    front: `<g class="spark" fill="#fff" stroke="none"><path d="M82 18l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/></g><g class="spark late" fill="#fff" stroke="none"><path d="M18 74l1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5z"/></g>`,
    css: `
      .icon { animation: star 2s ease-in-out infinite; }
      .spark { transform-box: fill-box; transform-origin: center; animation: spark 2s ease-in-out infinite; }
      .late { animation-delay: -1s; }
      @keyframes star { 0% { transform: rotate(0) scale(1); } 50% { transform: rotate(36deg) scale(1.12); } 100% { transform: rotate(72deg) scale(1); } }
      @keyframes spark { 0%, 100% { transform: scale(0); } 50% { transform: scale(1.2); } }`,
  },
  {
    name: 'heart', icon: 'heart', color: CORAL, emoji: '❤',
    back: `<circle class="pulse" cx="50" cy="50" r="24" fill="#fff" opacity="0"/>`,
    css: `
      .icon { animation: beat 1s ease-in-out infinite; }
      .pulse { transform-origin: 50px 50px; animation: pulse 1s ease-out infinite; }
      @keyframes beat { 0%, 100% { transform: scale(1); } 15% { transform: scale(1.18); } 30% { transform: scale(1.02); } 45% { transform: scale(1.12); } 70% { transform: scale(1); } }
      @keyframes pulse { 0%, 10% { transform: scale(0.8); opacity: 0.3; } 70%, 100% { transform: scale(1.9); opacity: 0; } }`,
  },
  {
    name: 'bell', icon: 'bell-ring', color: SUN, ink: INK, emoji: '🔔',
    css: `
      .icon { transform-origin: 50px 22px; animation: ring 2s ease-in-out infinite; }
      @keyframes ring { 0%, 60%, 100% { transform: rotate(0); } 8% { transform: rotate(16deg); } 18% { transform: rotate(-14deg); } 28% { transform: rotate(10deg); } 38% { transform: rotate(-7deg); } 48% { transform: rotate(3deg); } }`,
  },
  {
    name: 'access', icon: 'accessibility', color: BLUE, emoji: '♿', back: ROAD,
    css: `
      .icon { animation: roll 1s ease-in-out infinite; }
      .road { animation: road 0.5s linear infinite; }
      @keyframes roll { 50% { transform: translateX(3px) rotate(-3deg); } }
      @keyframes road { to { transform: translateX(-30px); } }`,
  },
];

async function nodeOf({ icon, node }) {
  if (node) return node;
  const file = join(ROOT, 'node_modules', 'lucide-react', 'dist', 'esm', 'icons', `${icon}.mjs`);
  return (await import(pathToFileURL(file).href)).__iconData.node;
}

const attrs = (props) =>
  Object.entries(props)
    .filter(([key]) => key !== 'key')
    .map(([key, value]) => `${key}="${value}"`)
    .join(' ');

function svg(node, { color, ink = '#fff', viewBox = 24, back = '', inner = '', front = '', css = '' }) {
  const icon = node.map(([tag, props]) => `<${tag} ${attrs(props)}/>`).join('');
  const stroke = viewBox === 64 ? 8 : 2.25;
  return `<svg id="emoji" xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
    <style>g, path, circle, rect, ellipse { transform-origin: 50px 50px; } ${css}</style>
    <defs><clipPath id="tile"><rect x="2" y="2" width="96" height="96" rx="28"/></clipPath></defs>
    <rect x="2" y="2" width="96" height="96" rx="28" fill="${color}"/>
    <g clip-path="url(#tile)">${back}</g>
    <g class="icon"><svg x="20" y="20" width="60" height="60" viewBox="0 0 ${viewBox} ${viewBox}" overflow="visible" fill="none" stroke="${ink}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">${icon}${inner}</svg></g>
    <g clip-path="url(#tile)">${front}</g>
  </svg>`;
}

mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({ executablePath: EDGE });
const page = await browser.newPage();
await page.setViewport({ width: 100, height: 100 });
for (const item of EMOJI) {
  rmSync(FRAMES, { recursive: true, force: true });
  mkdirSync(FRAMES, { recursive: true });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg(await nodeOf(item), item)}</body></html>`);

  for (let frame = 0; frame < FPS * SECONDS; frame++) {
    const ms = (frame * 1000) / FPS;
    await page.evaluate((time) => {
      for (const animation of document.getAnimations()) {
        animation.pause();
        animation.currentTime = time;
      }
      const root = document.getElementById('emoji');
      root.pauseAnimations();
      root.setCurrentTime(time / 1000);
    }, ms);
    await page.screenshot({ path: join(FRAMES, `${String(frame).padStart(3, '0')}.png`), omitBackground: true, clip: { x: 0, y: 0, width: 100, height: 100 } });
  }
  const webm = join(OUT, `${item.name}.webm`);

  for (const crf of [28, 36, 44]) {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(FRAMES, '%03d.png'), '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', '0', '-crf', String(crf), '-an', webm]);
    if (statSync(webm).size <= MAX_BYTES) break;
  }
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', join(FRAMES, '030.png'), join(OUT, `${item.name}.png`)]);
  console.log(`${item.name}: ${(statSync(webm).size / 1024).toFixed(0)} KB`);
}
rmSync(FRAMES, { recursive: true, force: true });
await browser.close();

if (process.argv.includes('--upload')) {
  const env = readFileSync(join(ROOT, '.env.local'), 'utf8');
  const token = env.match(/^TELEGRAM_BOT_TOKEN=(.+)$/m)?.[1]?.trim().replace(/^["']|["']$/g, '');
  if (!token) throw new Error('Set TELEGRAM_BOT_TOKEN in .env.local');
  const call = async (method, form) => (await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: 'POST', body: form })).json();
  const sticker = (item, field) => ({ sticker: `attach://${field}`, format: 'video', emoji_list: [item.emoji] });
  const file = (item) => new Blob([readFileSync(join(OUT, `${item.name}.webm`))], { type: 'video/webm' });

  const lookup = new FormData();
  lookup.append('name', PACK);
  const set = await call('getStickerSet', lookup);
  if (!set.ok) {
    const form = new FormData();
    form.append('user_id', String(OWNER));
    form.append('name', PACK);
    form.append('title', 'RAITTA');
    form.append('sticker_type', 'custom_emoji');
    form.append('stickers', JSON.stringify(EMOJI.map((item, i) => sticker(item, `file${i}`))));
    EMOJI.forEach((item, i) => form.append(`file${i}`, file(item), `${item.name}.webm`));
    const created = await call('createNewStickerSet', form);
    if (!created.ok) throw new Error(`createNewStickerSet: ${created.description}`);
  } else {
    for (const [i, item] of EMOJI.entries()) {
      const old = set.result.stickers[i];
      const form = new FormData();
      form.append('user_id', String(OWNER));
      form.append('name', PACK);
      form.append('sticker', JSON.stringify(sticker(item, 'file')));
      form.append('file', file(item), `${item.name}.webm`);
      if (old) form.append('old_sticker', old.file_id);
      const done = await call(old ? 'replaceStickerInSet' : 'addStickerToSet', form);
      if (!done.ok) throw new Error(`${item.name}: ${done.description}`);
      console.log(`${item.name}: uploaded`);
    }
  }
  console.log(`Published https://t.me/addemoji/${PACK}`);
}
