import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', '..', 'landing', 'bot');
const FPS = 30;
mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ['--allow-file-access-from-files'] });
const page = await browser.newPage();
await page.setViewport({ width: 640, height: 360, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(join(HERE, 'intro.html')).href);
await page.evaluate(() => window.ready);
const duration = await page.evaluate(() => window.DURATION);

const mp4 = join(OUT, 'intro.mp4');
const ffmpeg = spawn(
  'ffmpeg',
  ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', '-an', mp4],
  { stdio: ['pipe', 'inherit', 'inherit'] },
);
for (let frame = 0; frame < duration * FPS; frame++) {
  await page.evaluate((t) => window.render(t), frame / FPS);
  if (!ffmpeg.stdin.write(await page.screenshot({ type: 'png' }))) await new Promise((resolve) => ffmpeg.stdin.once('drain', resolve));
}
ffmpeg.stdin.end();
await new Promise((resolve, reject) => ffmpeg.on('close', (code) => (code ? reject(new Error(`ffmpeg ${code}`)) : resolve())));

await page.evaluate((t) => window.render(t), duration - 0.05);
await page.screenshot({ path: join(OUT, 'intro.png') });
await browser.close();

const palette = join(OUT, 'palette.png');
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', mp4, '-vf', 'fps=15,scale=640:360:flags=lanczos,palettegen=max_colors=64', palette]);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', mp4, '-i', palette, '-lavfi', 'fps=15,scale=640:360:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=4', join(OUT, 'intro.gif')]);
execFileSync('node', ['-e', `require('node:fs').rmSync(${JSON.stringify(palette)})`]);
console.log('wrote', OUT);
