import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const APP = 'https://maps.raitta.fi';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const VIEWPORT = { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const LANGUAGES = process.argv.slice(2).length ? process.argv.slice(2) : ['en', 'fi', 'sv', 'ru', 'et'];

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: true,
  
  args: ['--host-resolver-rules=MAP maps.raitta.fi 216.198.79.1', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

const findMap = (page) =>
  page.evaluateHandle(() => {
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

for (const language of LANGUAGES) {
  const out = join(ROOT, 'landing', 'screens', 'tour', language);
  mkdirSync(out, { recursive: true });

  const open = async (path, region = 'tampere', extra = {}, at = null) => {
    const page = await browser.newPage();
    
    if (at) {
      await page.evaluateOnNewDocument((spot) => {
        const position = () => ({ coords: { latitude: spot.lat, longitude: spot.lon, accuracy: 8, heading: null, speed: null }, timestamp: Date.now() });
        const geolocation = {
          getCurrentPosition: (ok) => setTimeout(() => ok(position()), 200),
          watchPosition: (ok) => {
            setTimeout(() => ok(position()), 200);
            return 1;
          },
          clearWatch: () => {},
        };
        Object.defineProperty(navigator, 'geolocation', { value: geolocation });
        const query = navigator.permissions.query.bind(navigator.permissions);
        navigator.permissions.query = (descriptor) => (descriptor.name === 'geolocation' ? Promise.resolve({ state: 'granted' }) : query(descriptor));
      }, at);
    }
    await page.setViewport(VIEWPORT);
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
    await page.evaluateOnNewDocument(
      (chosen, code, more) => {
        localStorage.setItem('raita-settings', JSON.stringify({ state: { onboarded: true, language: code, theme: 'light', region: chosen, ...more }, version: 2 }));
        
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
      },
      region,
      language,
      extra,
    );
    await page.goto(`${APP}${path}`, { waitUntil: 'domcontentloaded' });
    await wait(6000);
    return page;
  };

  const shot = async (page, name) => {
    await page.waitForFunction(() => document.fonts.ready.then(() => true));
    const png = await page.screenshot({ type: 'png' });
    await sharp(png).webp({ quality: 82 }).toFile(join(out, `${name}.webp`));
    console.log(language, name);
  };

  const tap = (page, text) =>
    page.evaluate((label) => {
      const target = [...document.querySelectorAll('button, a')].find((element) => element.textContent.trim().startsWith(label));
      target?.click();
      return !!target;
    }, text);

  const type = (page, text) =>
    page.evaluate((value) => {
      const input = [...document.querySelectorAll('input[type=search]')].pop();
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }, text);

  const strings = (await import(`../src/i18n/locales/${language}.ts`))[language];

  const helsinki = await open('/transport', 'helsinki');
  await wait(5000);
  const map = await findMap(helsinki);
  await map.evaluate((instance) => instance.jumpTo({ zoom: 12.4 }));
  await wait(7000);
  await shot(helsinki, 'live');
  for (let attempt = 0; attempt < 8; attempt++) {
    const point = await map.evaluate((instance) => {
      const found = instance
        .queryRenderedFeatures({ layers: ['vehicles', 'vehicle-heading'] })
        .map((feature) => instance.project(feature.geometry.coordinates))
        .filter((p) => p.y > 140 && p.y < 420 && p.x > 40 && p.x < 340)[0];
      return found ? { x: found.x, y: found.y } : null;
    });
    if (point) {
      await helsinki.mouse.click(point.x, point.y);
      await wait(5000);
      if (helsinki.url().includes('/vehicle/')) {
        await shot(helsinki, 'vehicle');
        break;
      }
    }
    await wait(3000);
  }
  await helsinki.close();

  const plan = await open('/routes?view=plan&toLat=61.5018&toLon=23.8006&toName=Hippos');
  await type(plan, 'Keskustori');
  await wait(2500);
  await shot(plan, 'search');
  await type(plan, 'Tuulensuu');
  await wait(1800);
  await tap(plan, 'Tuulensuu A');
  await wait(4000);
  await shot(plan, 'route');
  await plan.click(`button[aria-label="${strings.routes.plan}"]`);
  await wait(1500);
  await plan.evaluate(() => document.querySelector('.scroll-area')?.scrollTo(0, 230));
  await wait(800);
  await shot(plan, 'options');
  await plan.evaluate(() => document.querySelector('.scroll-area')?.scrollTo(0, 0));
  await tap(plan, strings.plan.chooseTime);
  await wait(1500);
  await shot(plan, 'time');
  await plan.close();

  const lines = await open('/routes?view=plan&start=1');
  await type(lines, '3');
  await wait(2000);
  await shot(lines, 'lines');
  await lines.close();

  const trains = await open('/trains');
  await wait(4000);
  await shot(trains, 'trains');
  await trains.close();

  const TUULENSUU = { lat: 61.4947, lon: 23.7867 };
  const car = await open('/routes?view=plan&toLat=61.5018&toLon=23.8006&toName=Hippos', 'tampere', { travel: 'car', locationAllowed: true }, TUULENSUU);
  
  await tap(car, strings.plan.myLocation);
  await wait(6000);
  await car.click(`button[aria-label="${strings.routes.plan}"]`).catch(() => {});
  await wait(2500);
  await shot(car, 'car');
  await tap(car, strings.drive.go);
  await wait(6000);
  await shot(car, 'drive');
  await car.close();

  const charging = await open('/charging', 'tampere', { energy: 'charging' });
  await wait(5000);
  await shot(charging, 'charging');
  await charging.close();
}

await browser.close();
