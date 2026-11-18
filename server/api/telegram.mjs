const SITE = 'https://raitta.fi';

const PARTY_EFFECT = '5046509860389126442';
const MAP = 'https://maps.raitta.fi/';

const clean = (value) => value?.trim().replace(/^["']|["']$/g, '');
const TOKEN = clean(process.env.TELEGRAM_BOT_TOKEN);

const SECRET = clean(process.env.TELEGRAM_WEBHOOK_SECRET);

const EMOJI_IDS = {
  logo: ['🔵', '5424609034185516934'],
  bus: ['🚌', '5424924087216549668'],
  tram: ['🚋', '5424972418483528933'],
  metro: ['🚇', '5424723722697224453'],
  train: ['🚆', '5424771422604010054'],
  pin: ['📍', '5424656931660802191'],
  navigate: ['🧭', '5424602535900002528'],
  clock: ['🕒', '5425145973816993049'],
  ticket: ['🎫', '5424756931384356700'],
  heart: ['❤', '5424700186276442697'],
  star: ['⭐', '5424989173150955223'],
};
const E = Object.fromEntries(Object.entries(EMOJI_IDS).map(([name, [emoji, id]]) => [name, `<tg-emoji emoji-id="${id}">${emoji}</tg-emoji>`]));
const MODES = `${E.bus}${E.tram}${E.metro}${E.train}`;

const welcome = (w) =>
  [
    `${E.logo} <b>RAITTA</b> — <i>${w.tagline}</i>`,
    '',
    `<blockquote>${MODES} <b>${w.cities}</b>\n${w.modes}</blockquote>`,
    '',
    `${E.pin} <b>${w.live[0]}</b> — ${w.live[1]}`,
    `${E.clock} <b>${w.departures[0]}</b> — ${w.departures[1]}`,
    `${E.navigate} <b>${w.guide[0]}</b> — ${w.guide[1]}`,
    `${E.ticket} <b>${w.tickets[0]}</b> — ${w.tickets[1]}`,
    '',
    `<blockquote expandable>${E.star} <b>${w.howTitle}</b>\n${w.how.map((step, i) => `${i + 1}. ${step}`).join('\n')}</blockquote>`,
    '',
    `${E.heart} <a href="${SITE}">raitta.fi</a> · <tg-spoiler>${w.secret}</tg-spoiler>`,
  ].join('\n');

const TEXTS = {
  en: {
    welcome: welcome({
      tagline: 'Finland’s public transport, live',
      cities: '19 cities',
      modes: 'Buses, trams, metro and trains',
      live: ['Live map', 'every vehicle moving in real time'],
      departures: ['Departures', 'the next ones from your stop, to the minute'],
      guide: ['Trip guide', 'step by step to the door, and a nudge before your stop'],
      tickets: ['Tickets', 'your city’s ticket app in one tap'],
      howTitle: 'How to start',
      how: ['Tap “Open RAITTA” below', 'Allow location and your city is found by itself', 'Tap “Where to?” and pick a place'],
      secret: 'no ads, no tracking',
    }),
    hint: `${E.navigate} <b>Tap the button</b> to open RAITTA.`,
    open: 'Open RAITTA',
    site: 'Website',
  },
  fi: {
    welcome: welcome({
      tagline: 'Suomen joukkoliikenne livenä',
      cities: '19 kaupunkia',
      modes: 'Bussit, ratikat, metro ja junat',
      live: ['Live-kartta', 'jokainen ajoneuvo liikkeessä reaaliajassa'],
      departures: ['Lähdöt', 'seuraavat omalta pysäkiltäsi minuutilleen'],
      guide: ['Matkaopas', 'vaihe vaiheelta perille ja muistutus ennen pysäkkiäsi'],
      tickets: ['Liput', 'kaupunkisi lippusovellus yhdellä napautuksella'],
      howTitle: 'Näin aloitat',
      how: ['Napauta alta ”Avaa RAITTA”', 'Salli sijainti, niin kaupunkisi löytyy itsestään', 'Napauta ”Minne mennään?” ja valitse paikka'],
      secret: 'ei mainoksia, ei seurantaa',
    }),
    hint: `${E.navigate} <b>Napauta painiketta</b> avataksesi RAITTAn.`,
    open: 'Avaa RAITTA',
    site: 'Verkkosivu',
  },
  sv: {
    welcome: welcome({
      tagline: 'Finlands kollektivtrafik, live',
      cities: '19 städer',
      modes: 'Bussar, spårvagnar, metro och tåg',
      live: ['Livekarta', 'varje fordon i rörelse i realtid'],
      departures: ['Avgångar', 'nästa från din hållplats, på minuten'],
      guide: ['Reseguide', 'steg för steg ända fram och en påminnelse före din hållplats'],
      tickets: ['Biljetter', 'stadens biljettapp med ett tryck'],
      howTitle: 'Så kommer du igång',
      how: ['Tryck på ”Öppna RAITTA” nedan', 'Tillåt plats så hittas din stad av sig själv', 'Tryck på ”Vart?” och välj en plats'],
      secret: 'ingen reklam, ingen spårning',
    }),
    hint: `${E.navigate} <b>Tryck på knappen</b> för att öppna RAITTA.`,
    open: 'Öppna RAITTA',
    site: 'Webbplats',
  },
  ru: {
    welcome: welcome({
      tagline: 'транспорт Финляндии вживую',
      cities: '19 городов',
      modes: 'Автобусы, трамваи, метро и поезда',
      live: ['Живая карта', 'весь транспорт движется в реальном времени'],
      departures: ['Отправления', 'ближайшие с вашей остановки, с точностью до минуты'],
      guide: ['Навигатор', 'ведёт по шагам до двери и напомнит, где выходить'],
      tickets: ['Билеты', 'приложение вашего города в одно касание'],
      howTitle: 'Как начать',
      how: ['Нажмите «Открыть RAITTA» ниже', 'Разрешите геолокацию — город определится сам', 'Нажмите «Куда едем?» и выберите место'],
      secret: 'без рекламы и слежки',
    }),
    hint: `${E.navigate} <b>Нажмите кнопку</b>, чтобы открыть RAITTA.`,
    open: 'Открыть RAITTA',
    site: 'Сайт',
  },
  et: {
    welcome: welcome({
      tagline: 'Soome ühistransport reaalajas',
      cities: '19 linna',
      modes: 'Bussid, trammid, metroo ja rongid',
      live: ['Elav kaart', 'iga sõiduk liigub reaalajas'],
      departures: ['Väljumised', 'järgmised sinu peatusest minuti täpsusega'],
      guide: ['Teejuht', 'samm-sammult kohale ja meeldetuletus enne sinu peatust'],
      tickets: ['Piletid', 'sinu linna piletirakendus ühe puudutusega'],
      howTitle: 'Kuidas alustada',
      how: ['Puuduta allpool „Ava RAITTA”', 'Luba asukoht ja linn leitakse ise', 'Puuduta „Kuhu lähed?” ja vali koht'],
      secret: 'ilma reklaami ja jälgimiseta',
    }),
    hint: `${E.navigate} <b>Puuduta nuppu</b>, et RAITTA avada.`,
    open: 'Ava RAITTA',
    site: 'Veebileht',
  },
};

export const textsFor = (languageCode = '') => TEXTS[languageCode.slice(0, 2).toLowerCase()] ?? TEXTS.en;

async function call(method, body) {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) console.error(method, res.status, await res.text());
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  if (!TOKEN || !SECRET) return res.status(503).end();
  if (req.headers['x-telegram-bot-api-secret-token'] !== SECRET) return res.status(401).end();

  const message = req.body?.message;
  if (!message?.chat || message.chat.type !== 'private') return res.status(200).end();

  const text = textsFor(message.from?.language_code);
  const reply_markup = {
    inline_keyboard: [
      [{ text: text.open, web_app: { url: MAP }, icon_custom_emoji_id: EMOJI_IDS.navigate[1], style: 'primary' }],
      [{ text: text.site, url: SITE, icon_custom_emoji_id: EMOJI_IDS.logo[1] }],
    ],
  };

  if (/^\/id\b/.test(message.text ?? '')) {
    await call('sendMessage', { chat_id: message.chat.id, text: String(message.chat.id) });
    return res.status(200).end();
  }
  if (/^\/start\b/.test(message.text ?? '')) {
    await call('sendAnimation', {
      chat_id: message.chat.id,
      animation: `${SITE}/bot/intro.mp4`,
      caption: text.welcome,
      parse_mode: 'HTML',
      message_effect_id: PARTY_EFFECT,
      reply_markup,
    });
  } else {
    await call('sendMessage', { chat_id: message.chat.id, text: text.hint, parse_mode: 'HTML', reply_markup });
  }
  return res.status(200).end();
}
