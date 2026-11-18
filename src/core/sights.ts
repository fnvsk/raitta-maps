export interface Sight {
  pic: number;

  wikidata?: string;

  lat?: number;
  lon?: number;
  name?: Record<string, string>;
}

export const SIGHTS: Sight[] = [
  { pic: 1, wikidata: 'Q738015' },
  { pic: 2, wikidata: 'Q1355001' },
  { pic: 3, lat: 60.1454, lon: 24.9881, name: { fi: 'Suomenlinna', sv: 'Sveaborg', en: 'Suomenlinna', ru: 'Суоменлинна', et: 'Suomenlinna' } },
  { pic: 4, wikidata: 'Q1132809' },
  { pic: 5, wikidata: 'Q1044613' },
  { pic: 6, lat: 60.1662, lon: 24.9577, name: { fi: 'SkyWheel Helsinki', en: 'SkyWheel Helsinki', ru: 'Колесо обозрения SkyWheel' } },

  { pic: 7, wikidata: 'Q1190334' },
  { pic: 8, lat: 61.5002, lon: 23.7585, name: { fi: 'Finlaysonin tehdas', en: 'Finlayson mill', ru: 'Фабрика Финлейсона', sv: 'Finlaysons fabrik', et: 'Finlaysoni vabrik' } },
  { pic: 9, wikidata: 'Q1236638' },

  { pic: 10, wikidata: 'Q136893' },
  { pic: 11, wikidata: 'Q1187606' },
  { pic: 12, wikidata: 'Q918929' },

  { pic: 13, wikidata: 'Q201935' },
  { pic: 14, lat: 65.0136, lon: 25.4641, name: { fi: 'Toripolliisi', en: 'Toripolliisi statue', ru: 'Статуя «Ториполлиси»', sv: 'Toripolliisi', et: 'Toripolliisi' } },

  { pic: 15, wikidata: 'Q15304480' },
  { pic: 16, lat: 62.2296, lon: 25.7396, name: { fi: 'Kuokkalan silta', en: 'Kuokkala Bridge', ru: 'Мост Куоккала', sv: 'Kuokkala bro', et: 'Kuokkala sild' } },

  { pic: 17, wikidata: 'Q15735566' },
  { pic: 18, lat: 62.8937, lon: 27.6802, name: { fi: 'Kuopion tuomiokirkko', en: 'Kuopio Cathedral', ru: 'Кафедральный собор Куопио', sv: 'Kuopio domkyrka', et: 'Kuopio toomkirik' } },

  { pic: 19, wikidata: 'Q952432' },
  { pic: 20, wikidata: 'Q1251089' },

  { pic: 21, lat: 61.4797, lon: 21.7745, name: { fi: 'Juséliuksen mausoleumi', en: 'Jusélius Mausoleum', ru: 'Мавзолей Юселиуса', sv: 'Juséliusmausoleet', et: 'Juséliuse mausoleum' } },
  { pic: 22, wikidata: 'Q10430702' },

  { pic: 23, wikidata: 'Q3585534' },
  { pic: 24, wikidata: 'Q4390833' },

  { pic: 25, lat: 61.0647, lon: 28.1786, name: { fi: 'Lappeenrannan linnoitus', en: 'Lappeenranta Fortress', ru: 'Крепость Лаппеэнранты', sv: 'Villmanstrands fästning', et: 'Lappeenranta kindlus' } },
  { pic: 26, lat: 61.0614, lon: 28.1874, name: { fi: 'Hiekkalinna', en: 'Sandcastle', ru: 'Песчаный замок', sv: 'Sandslottet', et: 'Liivaloss' } },

  { pic: 27, wikidata: 'Q1012561' },

  { pic: 28, lat: 63.0961, lon: 21.6156, name: { fi: 'Vaasan hovioikeus', en: 'Vaasa Court of Appeal', ru: 'Гофгерихт Ваасы', sv: 'Vasa hovrätt', et: 'Vaasa apellatsioonikohus' } },
  { pic: 29, wikidata: 'Q10701693' },

  { pic: 30, lat: 66.5004, lon: 25.7139, name: { fi: 'Jätkänkynttilä', en: "Lumberjack's Candle Bridge", ru: 'Мост «Свеча сплавщика»', sv: 'Jätkänkynttilä', et: 'Jätkänkynttilä sild' } },
  { pic: 31, wikidata: 'Q135379' },
  { pic: 32, lat: 66.5098, lon: 25.7188, name: { fi: 'Arktikum', en: 'Arktikum', ru: 'Арктикум', sv: 'Arktikum', et: 'Arktikum' } },

  { pic: 33, wikidata: 'Q2945864' },
  { pic: 34, wikidata: 'Q3387467' },

  { pic: 35, lat: 60.8699, lon: 26.7063, name: { fi: 'Kouvolan vesitorni', en: 'Kouvola water tower', ru: 'Водонапорная башня Коуволы', sv: 'Kouvola vattentorn', et: 'Kouvola veetorn' } },

  { pic: 36, wikidata: 'Q1236597' },

  { pic: 37, lat: 60.3846, lon: 23.1268, name: { fi: 'Salonjoen silta', en: 'Salo river bridge', ru: 'Мост через Салонйоки', sv: 'Salo å bro', et: 'Salo jõe sild' } },

  { pic: 38, wikidata: 'Q2628629' },

  { pic: 39, wikidata: 'Q1013619' },
  { pic: 40, lat: 59.9752, lon: 23.4339, name: { fi: 'Tammisaaren vanha kaupunki', en: 'Ekenäs Old Town', ru: 'Старый город Экенес', sv: 'Ekenäs gamla stan', et: 'Tammisaari vanalinn' } },
];

export const PIC_OF = new Map(SIGHTS.filter((s) => s.wikidata).map((s) => [s.wikidata!, s.pic]));
