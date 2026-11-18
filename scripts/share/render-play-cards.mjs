import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';

const HERE = dirname(fileURLToPath(import.meta.url));
const PLAY = join(HERE, '..', '..', 'release', 'play');

const CAPTIONS = {
  en: {
    map: ['Every bus and tram, live', 'Real-time positions in 19 Finnish cities'],
    live: ['The whole city in motion', 'Metro, trams, buses and trains on one map'],
    search: ['Find any stop in seconds', 'Stops, streets and places'],
    route: ['Plan door to door', 'Walking, transit and the fare zones you need'],
    time: ['Leave later or arrive on time', 'Choose when to depart or when to arrive'],
    stop: ['Departures with live delays', 'Save your stops for one-tap access'],
    fuel: ['Fuel prices nearby', 'Stations and average prices in Finland'],
  },
  fi: {
    map: ['Jokainen bussi ja ratikka livenä', 'Reaaliaikaiset sijainnit 19 kaupungissa'],
    live: ['Koko kaupunki liikkeessä', 'Metro, ratikat, bussit ja junat samalla kartalla'],
    search: ['Löydä pysäkki hetkessä', 'Pysäkit, kadut ja paikat'],
    route: ['Reitti ovelta ovelle', 'Kävely, joukkoliikenne ja tarvittavat vyöhykkeet'],
    time: ['Lähde myöhemmin tai ole ajoissa', 'Valitse lähtö- tai saapumisaika'],
    stop: ['Lähdöt reaaliajassa', 'Tallenna pysäkit yhden napautuksen päähän'],
    fuel: ['Polttoaineen hinnat lähellä', 'Huoltoasemat ja keskihinnat Suomessa'],
  },
  sv: {
    map: ['Varje buss och spårvagn live', 'Positioner i realtid i 19 finländska städer'],
    live: ['Hela staden i rörelse', 'Metro, spårvagnar, bussar och tåg på en karta'],
    search: ['Hitta en hållplats direkt', 'Hållplatser, gator och platser'],
    route: ['Planera från dörr till dörr', 'Promenad, kollektivtrafik och rätt zoner'],
    time: ['Åk senare eller kom i tid', 'Välj när du vill åka eller vara framme'],
    stop: ['Avgångar med förseningar live', 'Spara dina hållplatser ett tryck bort'],
    fuel: ['Bränslepriser nära dig', 'Stationer och medelpriser i Finland'],
  },
  ru: {
    map: ['Каждый автобус и трамвай вживую', 'Транспорт в реальном времени в 19 городах'],
    live: ['Весь город в движении', 'Метро, трамваи, автобусы и поезда на одной карте'],
    search: ['Любая остановка за секунды', 'Остановки, улицы и места'],
    route: ['Маршрут от двери до двери', 'Пешком, на транспорте и с нужными зонами'],
    time: ['Выехать позже или успеть вовремя', 'Выберите время отправления или прибытия'],
    stop: ['Отправления с опозданиями', 'Сохраняйте остановки в избранное'],
    fuel: ['Цены на топливо рядом', 'Заправки и средние цены в Финляндии'],
  },
  et: {
    map: ['Iga buss ja tramm reaalajas', 'Sõidukite asukohad 19 Soome linnas'],
    live: ['Kogu linn liikumises', 'Metroo, trammid, bussid ja rongid ühel kaardil'],
    search: ['Leia peatus hetkega', 'Peatused, tänavad ja kohad'],
    route: ['Teekond uksest ukseni', 'Jalgsi, ühistranspordiga ja õigete tsoonidega'],
    time: ['Mine hiljem või jõua õigeks ajaks', 'Vali väljumise või saabumise aeg'],
    stop: ['Väljumised reaalajas', 'Salvesta peatused ühe puudutuse kaugusele'],
    fuel: ['Kütusehinnad lähedal', 'Tanklad ja keskmised hinnad Soomes'],
  },
};

const WITH_MOOSE = new Set(['map', 'fuel']);
const ORDER = ['map', 'live', 'search', 'route', 'time', 'stop', 'fuel'];

const SIZES = { phone: [1080, 1920], tablet: [1440, 2560], desktop: [1920, 1080] };
const devices = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SIZES);

const browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage();
await page.goto(pathToFileURL(join(HERE, 'play-card.html')).href, { waitUntil: 'networkidle0' });

for (const device of devices) {
  const [width, height] = SIZES[device];
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  for (const [language, captions] of Object.entries(CAPTIONS)) {
    const out = join(PLAY, 'cards', device, language);
    mkdirSync(out, { recursive: true });
    for (const [i, name] of ORDER.entries()) {
      const file = `${String(i + 1).padStart(2, '0')}-${name}.png`;
      const shot = `data:image/png;base64,${readFileSync(join(PLAY, 'screens', device, language, file)).toString('base64')}`;
      const [title, text] = captions[name];

      for (let pass = 0; pass < 2; pass++) {
        await page.evaluate((card) => window.fill(card), { layout: device, title, text, shot, moose: WITH_MOOSE.has(name) });
        await page.evaluate(() => document.fonts.ready);
      }
      await page.screenshot({ path: join(out, file), type: 'png', clip: { x: 0, y: 0, width, height } });
    }
    console.log('cards', device, language);
  }
}
await browser.close();
