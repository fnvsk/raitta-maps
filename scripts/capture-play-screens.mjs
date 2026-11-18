import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const APP = 'https://maps.raitta.fi';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const DEVICES = {
  phone: { width: 360, height: 640, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  tablet: { width: 800, height: 1280, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1.5 },
};
const [device = 'phone', ...chosen] = process.argv.slice(2);
const VIEWPORT = DEVICES[device];
if (!VIEWPORT) throw new Error(`Unknown device ${device}`);
const LANGUAGES = chosen.length ? chosen : ['en', 'fi', 'sv', 'ru', 'et'];

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: true,

  args: ['--host-resolver-rules=MAP maps.raitta.fi 216.198.79.1', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

for (const language of LANGUAGES) {
  const strings = (await import(`../src/i18n/locales/${language}.ts`))[language];
  const out = join(ROOT, 'release', 'play', 'screens', device, language);
  mkdirSync(out, { recursive: true });
  let count = 0;

  const open = async (path, region = 'tampere') => {
    const page = await browser.newPage();
    await page.setViewport(VIEWPORT);
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
    await page.evaluateOnNewDocument(
      (chosen, code) => {
        localStorage.setItem('raita-settings', JSON.stringify({ state: { onboarded: true, language: code, theme: 'light', region: chosen }, version: 2 }));

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
    );
    await page.goto(`${APP}${path}`, { waitUntil: 'domcontentloaded' });
    await wait(6000);
    return page;
  };

  const shot = async (page, name) => {
    await page.waitForFunction(() => document.fonts.ready.then(() => true));
    const png = await page.screenshot({ type: 'png' });
    await sharp(png).png().toFile(join(out, `${String(++count).padStart(2, '0')}-${name}.png`));
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
      const input = document.querySelector('input[type=search]');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }, text);

  const home = await open('/');
  await shot(home, 'map');
  await home.close();

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
  await tap(plan, strings.plan.chooseTime);
  await wait(1500);
  await shot(plan, 'time');
  await plan.close();

  const stop = await open('/stops/0518');
  await shot(stop, 'stop');
  await stop.close();

  const fuel = await open('/fuel');
  await shot(fuel, 'fuel');
  await fuel.close();
}

await browser.close();
