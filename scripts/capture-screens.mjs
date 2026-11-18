import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const APP = 'https://raita-xi.vercel.app/app';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'landing', 'screens');
const VIEWPORT = { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

async function open(path, region = 'tampere') {
  const page = await browser.newPage();
  await page.setViewport(VIEWPORT);
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
  await page.evaluateOnNewDocument((chosen) => {
    localStorage.setItem(
      'raita-settings',
      JSON.stringify({ state: { onboarded: true, language: 'en', theme: 'light', region: chosen }, version: 2 }),
    );

    const target = new Date();
    target.setDate(target.getDate() + 1);
    target.setHours(10, 30, 0, 0);
    const shift = target.getTime() - Date.now();
    const RealDate = Date;
    globalThis.Date = class extends RealDate {
      constructor(...args) {
        super(...(args.length ? args : [RealDate.now() + shift]));
      }
      static now() {
        return RealDate.now() + shift;
      }
    };
  }, region);
  await page.goto(`${APP}${path}`, { waitUntil: 'domcontentloaded' });
  await wait(6000);
  return page;
}

async function shot(page, name) {
  await page.waitForFunction(() => document.fonts.ready.then(() => true));
  const png = await page.screenshot({ type: 'png' });
  await sharp(png).webp({ quality: 82 }).toFile(join(OUT, `${name}.webp`));
  console.log('saved', name);
}

const tap = (page, text) =>
  page.evaluate((label) => {
    const target = [...document.querySelectorAll('button, a')].find((element) => element.textContent.trim().startsWith(label));
    target?.click();
    return !!target;
  }, text);

const type = (page, text) =>
  page.evaluate((value) => {
    const input = document.querySelector('input[type=search]');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, text);

const home = await open('/');
await shot(home, 'home');
await home.close();

const plan = await open('/routes?view=plan&toLat=61.5018&toLon=23.8006&toName=Hippos');
await type(plan, 'Keskustori');
await wait(2500);
await shot(plan, 'search');
await tap(plan, 'Tuulensuu');
await type(plan, 'Tuulensuu');
await wait(1800);
await tap(plan, 'Tuulensuu A');
await wait(4000);
await shot(plan, 'route');
await plan.click('button[aria-label="Plan a trip"]');
await wait(1500);
await tap(plan, 'Choose a time');
await wait(1500);
await shot(plan, 'time');
await tap(plan, 'Done');
await wait(1500);
await plan.click('button[aria-label="Plan a trip"]');
await wait(1500);
await plan.evaluate(() => document.querySelector('.scroll-area').scrollTo(0, 230));
await wait(800);
await shot(plan, 'options');
await plan.close();

const helsinki = await open('/', 'helsinki');
await wait(5000);

const map = await helsinki.evaluateHandle(() => {
  const root = document.querySelector('.app-shell');
  const key = Object.keys(root).find((name) => name.startsWith('__reactFiber'));
  const queue = [root[key]];
  while (queue.length) {
    const fiber = queue.shift();
    if (!fiber) continue;
    for (let hook = fiber.memoizedState; hook && typeof hook === 'object' && 'next' in hook; hook = hook.next) {
      if (hook.memoizedState?.current?.queryRenderedFeatures) return hook.memoizedState.current;
    }
    queue.push(fiber.child, fiber.sibling);
  }
  return null;
});
await map.evaluate((instance) => instance.jumpTo({ zoom: 12.4 }));
await wait(7000);
await shot(helsinki, 'live');
for (let attempt = 0; attempt < 6; attempt++) {
  const point = await map.evaluate((instance) => {
    const found = instance
      .queryRenderedFeatures({ layers: ['vehicles', 'vehicle-heading'] })
      .map((feature) => instance.project(feature.geometry.coordinates))
      .filter((p) => p.y > 120 && p.y < 500 && p.x > 30 && p.x < 330)[0];
    return found ? { x: found.x, y: found.y } : null;
  });
  if (point) {
    await helsinki.mouse.click(point.x, point.y);
    await wait(5000);
    await shot(helsinki, 'vehicle');
    break;
  }
  await wait(4000);
}
await helsinki.close();

const stop = await open('/stops/0518');
await shot(stop, 'stop');
await stop.close();

const fuel = await open('/fuel');
await shot(fuel, 'fuel');
await fuel.close();

await browser.close();
