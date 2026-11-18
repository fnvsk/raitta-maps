import type { PoiGlyph } from './poiGlyphs';
import { brandIconExpression } from '@/core/brands';
import type { ExpressionSpecification, LayerSpecification, StyleSpecification } from 'maplibre-gl';

interface Palette {
  land: string;
  water: string;
  park: string;
  wood: string;
  residential: string;
  campus: string;
  health: string;
  building: string;
  buildingTop: string;
  roadMinor: string;
  roadMajor: string;
  roadMotorway: string;
  casing: string;
  rail: string;

  tramTrack: string;
  metroTrack: string;
  label: string;
  labelMuted: string;
  halo: string;
  waterLabel: string;
}

const LIGHT: Palette = {
  land: '#F3F1EC',
  water: '#A9D8F5',
  park: '#CDEBC0',
  wood: '#D6EDCB',
  residential: '#EFEDE8',
  campus: '#F3E9D2',
  health: '#F8DEDC',
  building: '#E4E2DC',
  buildingTop: '#B9BDC4',
  roadMinor: '#FFFFFF',
  roadMajor: '#FFFFFF',
  roadMotorway: '#F7D98C',
  casing: '#D8D5CE',
  rail: '#B9B6AE',
  tramTrack: '#CDB2EC',
  metroTrack: '#F2BE9A',
  label: '#3A4152',
  labelMuted: '#6B7385',
  halo: '#FFFFFF',
  waterLabel: '#3F7FAE',
};

const DARK: Palette = {
  land: '#141B2B',
  water: '#0B2A4E',
  park: '#16362B',
  wood: '#15322B',
  residential: '#182133',
  campus: '#2A2A2E',
  health: '#35232C',
  building: '#222D42',
  buildingTop: '#35435C',
  roadMinor: '#2E3A52',
  roadMajor: '#3F4D69',
  roadMotorway: '#7A6A3C',
  casing: '#0F1522',
  rail: '#465370',
  tramTrack: '#4E3D78',
  metroTrack: '#6E4630',
  label: '#E4E9F2',
  labelMuted: '#9AA6BC',
  halo: '#0E1422',
  waterLabel: '#6FA8D6',
};

const BRAND_ICON = brandIconExpression();

export const POI_CATEGORIES = {
  education: {
    color: '#C2780A',
    glyph: 'cap',
    classes: {
      school: 'cap',
      college: 'cap',
      university: 'cap',
      prep_school: 'cap',
      kindergarten: 'baby',
      childcare: 'baby',
      library: 'book',
      language_school: 'book',
      driving_school: 'car',
      music_school: 'music',
      dancing_school: 'music',
    },
  },
  grocery: {
    color: '#D97706',
    glyph: 'cart',
    classes: { grocery: 'cart', supermarket: 'cart', convenience: 'basket', bakery: 'croissant', alcohol_shop: 'wine', butcher: 'beef' },
  },
  food: {
    color: '#EA580C',
    glyph: 'utensils',
    classes: { restaurant: 'utensils', fast_food: 'burger', cafe: 'coffee', bar: 'cocktail', beer: 'beer', ice_cream: 'icecream', nightclub: 'music', internet_cafe: 'monitor' },
  },
  shop: {
    color: '#CA8A04',
    glyph: 'bag',
    classes: { shop: 'bag', clothing_store: 'shirt', department_store: 'store', mall: 'store', hardware: 'hammer', furniture: 'sofa', bicycle: 'bike', music: 'music' },
  },
  health: {
    color: '#DC2626',
    glyph: 'hospital',
    classes: { hospital: 'hospital', pharmacy: 'pill', doctors: 'stethoscope', dentist: 'stethoscope', clinic: 'stethoscope', healthcare: 'stethoscope' },
  },
  beauty: { color: '#DB2777', glyph: 'scissors', classes: { hairdresser: 'scissors', tanning_salon: 'sun' } },
  pets: { color: '#A16207', glyph: 'paw', classes: { veterinary: 'paw', dog_park: 'dog', pet_grooming: 'paw', animal_boarding: 'paw', animal_shelter: 'heart' } },
  culture: {
    color: '#7C3AED',
    glyph: 'landmark',
    classes: {
      museum: 'landmark',
      art_gallery: 'palette',
      theatre: 'drama',
      cinema: 'film',
      attraction: 'camera',
      monument: 'landmark',
      memorial: 'landmark',
      castle: 'castle',
      place_of_worship: 'church',
      town_hall: 'landmark',
      planetarium: 'star',
    },
  },
  fun: {
    color: '#C026D3',
    glyph: 'ticket',
    classes: {
      events_venue: 'ticket',
      exhibition_centre: 'ticket',
      conference_centre: 'users',
      music_venue: 'mic',
      studio: 'mic',
      karaoke_box: 'mic',
      casino: 'dice',
      gambling: 'dice',
      adult_gaming_centre: 'dice',
      amusement_arcade: 'gamepad',
      escape_game: 'key',
      bowling_alley: 'target',
      trampoline_park: 'ferris',
      stripclub: 'cocktail',
      hackerspace: 'monitor',
    },
  },
  lodging: { color: '#4F46E5', glyph: 'bed', classes: { lodging: 'bed', hotel: 'bed', apartment: 'bed' } },
  nature: {
    color: '#16A34A',
    glyph: 'trees',
    classes: {
      park: 'trees',
      garden: 'flower',
      swimming: 'waves',
      water_park: 'waves',
      stadium: 'trophy',
      sports_centre: 'dumbbell',
      sports_hall: 'dumbbell',
      fitness: 'dumbbell',
      fitness_centre: 'dumbbell',
      fitness_station: 'dumbbell',
      yoga: 'dumbbell',
      dance: 'music',
      sauna: 'droplets',
      horse_riding: 'trophy',
      pitch: 'goal',
      golf: 'flag',
      campsite: 'tent',
      playground: 'ferris',
      zoo: 'paw',
      theme_park: 'ferris',
    },
  },
  car: {
    color: '#334155',
    glyph: 'car',
    classes: { car: 'car', car_repair: 'wrench', car_wash: 'car', motorcycle: 'car', car_rental: 'car', boat_rental: 'sailboat', vehicle_inspection: 'wrench' },
  },
  office: { color: '#64748B', glyph: 'briefcase', classes: { office: 'briefcase', coworking_space: 'briefcase' } },
  craft: { color: '#9A3412', glyph: 'hammer', classes: { craft: 'hammer' } },
  service: {
    color: '#475569',
    glyph: 'star',
    classes: {
      bank: 'banknote',
      atm: 'banknote',
      bureau_de_change: 'banknote',
      money_transfer: 'banknote',
      payment_centre: 'banknote',
      post: 'mail',
      fuel: 'fuel',
      police: 'shield',
      fire_station: 'flame',
      toilets: 'toilet',
      laundry: 'washing',
      dry_cleaning: 'washing',
      social_facility: 'handshake',
      social_centre: 'users',
      lost_property_office: 'tag',
      public_bath: 'waves',
    },
  },
} as const satisfies Record<string, { color: string; glyph: PoiGlyph; classes: Record<string, PoiGlyph> }>;

export type PoiCategory = keyof typeof POI_CATEGORIES;

const SHOP_GLYPHS: Record<string, PoiGlyph> = {
  clothes: 'shirt',
  boutique: 'shirt',
  fashion: 'shirt',
  fashion_accessories: 'bag',
  leather: 'bag',
  shoes: 'shoe',
  shoe_repair: 'shoe',
  florist: 'flower',
  garden_centre: 'sprout',
  electronics: 'monitor',
  computer: 'monitor',
  hifi: 'monitor',
  radiotechnics: 'monitor',
  mobile_phone: 'phone',
  sports: 'dumbbell',
  outdoor: 'tent',
  fishing: 'anchor',
  hunting: 'target',
  boat: 'sailboat',
  jewelry: 'gem',
  gold_buyer: 'gem',
  watches: 'gem',
  optician: 'glasses',
  gift: 'gift',
  souvenir: 'gift',
  souvenirs: 'gift',
  party: 'gift',
  pet: 'paw',
  pet_grooming: 'paw',
  second_hand: 'recycle',
  charity: 'recycle',
  pawnbroker: 'tag',
  auction: 'tag',
  books: 'book',
  stationery: 'book',
  toys: 'toy',
  games: 'dice',
  video_games: 'gamepad',
  collector: 'star',
  beauty: 'sparkles',
  cosmetics: 'sparkles',
  perfumery: 'sparkles',
  nails: 'sparkles',
  barbershop: 'scissors',
  hairdresser: 'scissors',
  hairdresser_supply: 'scissors',
  piercing: 'gem',
  tattoo: 'brush',
  kiosk: 'newspaper',
  newsagent: 'newspaper',
  convenience: 'basket',
  supermarket: 'cart',
  grocery: 'cart',
  food: 'cart',
  ethnic: 'cart',
  variety_store: 'store',
  general: 'store',
  department_store: 'store',
  bakery: 'croissant',
  pastry: 'croissant',
  confectionery: 'croissant',
  alcohol: 'wine',
  wine: 'wine',
  beverages: 'wine',
  furniture: 'sofa',
  interior_decoration: 'sofa',
  upholstery: 'armchair',
  kitchen: 'utensils',
  cookware: 'utensils',
  houseware: 'utensils',
  lighting: 'lamp',
  lamps: 'lamp',
  hardware: 'hammer',
  doityourself: 'hammer',
  paint: 'brush',
  craft: 'brush',
  frame: 'brush',
  pottery: 'brush',
  art: 'palette',
  design: 'palette',
  sewing: 'scissors',
  fabric: 'scissors',
  yarn: 'scissors',
  household_linen: 'sofa',
  curtain: 'sofa',
  window_blind: 'sofa',
  bathroom_furnishing: 'droplets',
  travel_agency: 'plane',
  car: 'car',
  car_parts: 'wrench',
  car_repair: 'wrench',
  tyres: 'wrench',
  bicycle: 'bike',
  photo: 'camera',
  camera: 'camera',
  locksmith: 'key',
  locks: 'key',
  laundry: 'washing',
  dry_cleaning: 'washing',
  musical_instrument: 'music',
  music: 'music',
  chemist: 'pill',
  medical_supply: 'pill',
  nutrition_supplements: 'pill',
  herbalist: 'sprout',
  health_food: 'sprout',
  greengrocer: 'sprout',
  farm: 'sprout',
  butcher: 'beef',
  seafood: 'beef',
  cheese: 'basket',
  coffee: 'coffee',
  tea: 'coffee',
  'e-cigarette': 'cigarette',
  tobacco: 'cigarette',
  funeral_directors: 'flower',
  storage_rental: 'parcel',
  baby_goods: 'baby',
  esoteric: 'star',
  religion: 'church',
  trophy: 'trophy',
  erotic: 'heart',
};
const HEALTH_GLYPHS: Record<string, PoiGlyph> = {
  physiotherapist: 'pulse',
  rehabilitation: 'pulse',
  psychotherapist: 'brain',
  psychologist: 'brain',
  counselling: 'handshake',
  laboratory: 'flask',
  sample_collection: 'flask',
  blood_donation: 'droplet',
  optometrist: 'glasses',
  speech_therapist: 'mic',
  alternative: 'sprout',
  dentist: 'stethoscope',
  podiatrist: 'shoe',
  nurse: 'stethoscope',
  midwife: 'baby',
};
const CRAFT_GLYPHS: Record<string, PoiGlyph> = {
  photographer: 'camera',
  photographic_laboratory: 'camera',
  tailor: 'scissors',
  dressmaker: 'scissors',
  upholsterer: 'armchair',
  shoemaker: 'shoe',
  electronics_repair: 'phone',
  goldsmith: 'gem',
  jeweller: 'gem',
  watchmaker: 'gem',
  clockmaker: 'gem',
  cleaning: 'sparkles',
  caterer: 'utensils',
  confectionery: 'croissant',
  bakery: 'croissant',
  brewery: 'beer',
  winery: 'wine',
  distillery: 'wine',
  key_cutter: 'key',
  locksmith: 'key',
  bookbinder: 'book',
  musical_instrument: 'music',
  handicraft: 'brush',
  painter: 'brush',
  glaziery: 'lamp',
  window_construction: 'lamp',
  electrician: 'lamp',
  plumber: 'droplets',
  hvac: 'snowflake',
  carpenter: 'hammer',
  joiner: 'hammer',
  roofer: 'hammer',
  builder: 'hammer',
  car_repair: 'wrench',
  hairdresser: 'scissors',
  beekeeper: 'sprout',
  gardener: 'sprout',
};

const only = (glyphs: PoiGlyph[]) => Object.fromEntries(Object.entries(SHOP_GLYPHS).filter(([, glyph]) => glyphs.includes(glyph)));
const SUBCLASS_GLYPHS: Record<string, Record<string, PoiGlyph>> = {
  shop: SHOP_GLYPHS,
  grocery: only(['cart', 'basket', 'croissant', 'wine', 'sprout', 'beef', 'coffee', 'store']),
  hairdresser: only(['scissors', 'sparkles', 'gem', 'brush']),
  healthcare: HEALTH_GLYPHS,
  craft: CRAFT_GLYPHS,
};

const categoryOfClass = (cls: string) =>
  (Object.entries(POI_CATEGORIES) as [PoiCategory, (typeof POI_CATEGORIES)[PoiCategory]][]).find(([, { classes }]) => cls in classes)?.[0];

export const POI_ICONS: { category: PoiCategory; glyph: PoiGlyph }[] = (() => {
  const seen = new Map<string, { category: PoiCategory; glyph: PoiGlyph }>();
  const add = (category: PoiCategory, glyph: PoiGlyph) => seen.set(`${category}|${glyph}`, { category, glyph });
  for (const [category, { glyph, classes }] of Object.entries(POI_CATEGORIES) as [PoiCategory, (typeof POI_CATEGORIES)[PoiCategory]][]) {
    add(category, glyph);
    for (const value of Object.values(classes) as PoiGlyph[]) add(category, value);
  }
  for (const [cls, glyphs] of Object.entries(SUBCLASS_GLYPHS)) {
    const category = categoryOfClass(cls);
    if (category) for (const glyph of Object.values(glyphs)) add(category, glyph);
  }
  return [...seen.values()];
})();

export const poiIconId = (category: PoiCategory, glyph: PoiGlyph) => `poi|${category}|${glyph}`;

export function poiGlyphOf(cls: string, subclass = ''): PoiGlyph | null {
  const category = categoryOfClass(cls);
  if (!category) return null;
  return SUBCLASS_GLYPHS[cls]?.[subclass] ?? (POI_CATEGORIES[category].classes as Record<string, PoiGlyph>)[cls] ?? POI_CATEGORIES[category].glyph;
}

function poiMatch(value: (category: PoiCategory) => string, fallback = ''): ExpressionSpecification {
  const expression: unknown[] = ['match', ['get', 'class']];
  for (const [category, { classes }] of Object.entries(POI_CATEGORIES)) {
    expression.push(Object.keys(classes), value(category as PoiCategory));
  }
  expression.push(fallback);
  return expression as ExpressionSpecification;
}

function poiIconExpression(): ExpressionSpecification {
  const expression: unknown[] = ['match', ['get', 'class']];
  for (const [category, { classes }] of Object.entries(POI_CATEGORIES) as [PoiCategory, (typeof POI_CATEGORIES)[PoiCategory]][]) {
    for (const [cls, glyph] of Object.entries(classes) as [string, PoiGlyph][]) {
      const plain = poiIconId(category, glyph);
      const glyphs = SUBCLASS_GLYPHS[cls];
      if (!glyphs) {
        expression.push(cls, plain);
        continue;
      }
      const bySubclass: unknown[] = ['match', ['get', 'subclass']];
      for (const [subclass, picture] of Object.entries(glyphs)) bySubclass.push(subclass, poiIconId(category, picture));
      bySubclass.push(plain);
      expression.push(cls, bySubclass);
    }
  }
  expression.push('');
  return expression as ExpressionSpecification;
}

const NOT_PLACES = ['post_box', 'waste_basket', 'bench', 'vending_machine', 'bicycle_parking', 'parking', 'charging_station'];

const roadClass = (cases: Record<string, number>, fallback: number): ExpressionSpecification => {
  const expression: unknown[] = ['match', ['get', 'class']];
  for (const [name, width] of Object.entries(cases)) expression.push(name, width);
  expression.push(fallback);
  return expression as ExpressionSpecification;
};

const MODELLED_BUILDINGS: [number, number][] = [
  [24.95218, 60.17042],
  [22.27845, 60.45245],
  [22.22862, 60.43534],
  [25.47582, 65.01464],
];
const MODEL_CLEARANCE_M = 30;

const ROADS = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor', 'service', 'track', 'path'];

const roadWidth = (scale: number, extra = 0): ExpressionSpecification => [
  'interpolate',
  ['exponential', 1.6],
  ['zoom'],
  8,
  roadClass({ motorway: 1.2 * scale + extra, trunk: 1 * scale + extra, primary: 0.7 * scale + extra }, 0),
  12,
  roadClass({ motorway: 3 * scale + extra, trunk: 2.6 * scale + extra, primary: 2 * scale + extra, secondary: 1.6 * scale + extra, tertiary: 1.2 * scale + extra, minor: 0.7 * scale + extra }, 0),
  16,
  roadClass({ motorway: 11 * scale + extra, trunk: 10 * scale + extra, primary: 9 * scale + extra, secondary: 8 * scale + extra, tertiary: 7 * scale + extra, minor: 5.5 * scale + extra, service: 3 * scale + extra, track: 2 * scale + extra }, 1.2 * scale + extra),
  20,
  roadClass({ motorway: 44 * scale + extra, trunk: 40 * scale + extra, primary: 36 * scale + extra, secondary: 30 * scale + extra, tertiary: 28 * scale + extra, minor: 22 * scale + extra, service: 12 * scale + extra }, 4 * scale + extra),
];

export function buildStyle(dark: boolean, language: string): StyleSpecification {
  const c = dark ? DARK : LIGHT;
  const fullLabel: ExpressionSpecification = ['coalesce', ['get', `name:${language}`], ['get', 'name:latin'], ['get', 'name']];

  const label: ExpressionSpecification = [
    'let',
    'name',
    fullLabel,
    ['case', ['>', ['index-of', ';', ['var', 'name']], 0], ['slice', ['var', 'name'], 0, ['index-of', ';', ['var', 'name']]], ['var', 'name']],
  ];
  const road = ['in', ['get', 'class'], ['literal', ROADS]] as ExpressionSpecification;
  const height: ExpressionSpecification = ['coalesce', ['get', 'render_height'], 8];
  const standing = [
    'all',
    ['!=', ['get', 'hide_3d'], true],
    ['>', ['distance', { type: 'MultiPoint', coordinates: MODELLED_BUILDINGS }], MODEL_CLEARANCE_M],
  ] as unknown as ExpressionSpecification;

  const facade: ExpressionSpecification = [
    'case',
    ['>=', height, 32],
    'facade-glass',
    ['match', ['%', ['floor', ['*', height, 3]], 3], 0, 'facade-plaster', 1, 'facade-brick', 'facade-stone'],
  ];

  const layers: LayerSpecification[] = [
    { id: 'background', type: 'background', paint: { 'background-color': c.land } },
    {
      id: 'landcover-wood',
      type: 'fill',
      source: 'map',
      'source-layer': 'landcover',
      filter: ['in', ['get', 'class'], ['literal', ['wood', 'grass', 'wetland']]],
      paint: { 'fill-color': c.wood, 'fill-opacity': 0.75 },
    },
    {
      id: 'landuse-residential',
      type: 'fill',
      source: 'map',
      'source-layer': 'landuse',
      filter: ['in', ['get', 'class'], ['literal', ['residential', 'suburb', 'neighbourhood']]],
      paint: { 'fill-color': c.residential },
    },
    {
      id: 'landuse-campus',
      type: 'fill',
      source: 'map',
      'source-layer': 'landuse',
      minzoom: 12,
      filter: ['in', ['get', 'class'], ['literal', ['school', 'university', 'college', 'kindergarten']]],
      paint: { 'fill-color': c.campus },
    },
    {
      id: 'landuse-health',
      type: 'fill',
      source: 'map',
      'source-layer': 'landuse',
      minzoom: 12,
      filter: ['==', ['get', 'class'], 'hospital'],
      paint: { 'fill-color': c.health },
    },
    { id: 'park', type: 'fill', source: 'map', 'source-layer': 'park', paint: { 'fill-color': c.park } },
    { id: 'water', type: 'fill', source: 'map', 'source-layer': 'water', paint: { 'fill-color': c.water } },
    {
      id: 'waterway',
      type: 'line',
      source: 'map',
      'source-layer': 'waterway',
      paint: { 'line-color': c.water, 'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.5, 16, 3] },
    },
    {
      id: 'building-flat',
      type: 'fill',
      source: 'map',
      'source-layer': 'building',
      minzoom: 13.5,
      paint: { 'fill-color': c.building, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 13.5, 0, 14.5, 1] },
    },
    {
      id: 'road-casing',
      type: 'line',
      source: 'map',
      'source-layer': 'transportation',
      minzoom: 11,
      filter: ['all', road, ['!=', ['get', 'brunnel'], 'tunnel']],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': c.casing, 'line-width': roadWidth(1, 1.4) },
    },
    {
      id: 'road',
      type: 'line',
      source: 'map',
      'source-layer': 'transportation',
      filter: road,
      layout: { 'line-cap': 'round', 'line-join': 'round', 'line-sort-key': ['index-of', ['get', 'class'], ['literal', [...ROADS].reverse().join(',')]] },
      paint: {
        'line-color': ['match', ['get', 'class'], ['motorway'], c.roadMotorway, ['trunk', 'primary', 'secondary'], c.roadMajor, c.roadMinor],
        'line-width': roadWidth(1),
      },
    },

    {
      id: 'rail',
      type: 'line',
      source: 'map',
      'source-layer': 'transportation',
      minzoom: 5,
      filter: ['all', ['==', ['get', 'class'], 'rail'], ['!', ['has', 'service']]],
      layout: { 'line-join': 'round' },
      paint: { 'line-color': c.rail, 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.5, 10, 1, 16, 2.4] },
    },
    {
      id: 'rail-sleepers',
      type: 'line',
      source: 'map',
      'source-layer': 'transportation',
      minzoom: 12.5,
      filter: ['all', ['==', ['get', 'class'], 'rail'], ['!', ['has', 'service']], ['!=', ['get', 'brunnel'], 'tunnel']],
      paint: {
        'line-color': c.rail,
        'line-width': ['interpolate', ['linear'], ['zoom'], 12.5, 3, 16, 6.5],
        'line-dasharray': [0.18, 2.2],
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 12.5, 0, 13.5, 0.9],
      },
    },

    {
      id: 'rail-service',
      type: 'line',
      source: 'map',
      'source-layer': 'transportation',
      minzoom: 13.5,
      filter: ['all', ['==', ['get', 'class'], 'rail'], ['has', 'service']],
      paint: { 'line-color': c.rail, 'line-width': ['interpolate', ['linear'], ['zoom'], 13.5, 0.5, 17, 1.4], 'line-opacity': 0.7 },
    },

    {
      id: 'tram-track',
      type: 'line',
      source: 'map',
      'source-layer': 'transportation',
      minzoom: 11.5,
      filter: ['all', ['==', ['get', 'class'], 'transit'], ['in', ['get', 'subclass'], ['literal', ['tram', 'light_rail']]]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': c.tramTrack, 'line-width': ['interpolate', ['linear'], ['zoom'], 11.5, 0.8, 16, 2.6] },
    },

    {
      id: 'metro-track',
      type: 'line',
      source: 'map',
      'source-layer': 'transportation',
      minzoom: 10.5,
      filter: ['all', ['==', ['get', 'class'], 'transit'], ['==', ['get', 'subclass'], 'subway'], ['!=', ['get', 'brunnel'], 'tunnel']],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': c.metroTrack, 'line-width': ['interpolate', ['linear'], ['zoom'], 10.5, 1, 16, 3] },
    },
    {
      id: 'metro-tunnel',
      type: 'line',
      source: 'map',
      'source-layer': 'transportation',
      minzoom: 10.5,
      filter: ['all', ['==', ['get', 'class'], 'transit'], ['==', ['get', 'subclass'], 'subway'], ['==', ['get', 'brunnel'], 'tunnel']],
      paint: {
        'line-color': c.metroTrack,
        'line-width': ['interpolate', ['linear'], ['zoom'], 10.5, 1, 16, 2.6],
        'line-dasharray': [1.6, 1.2],
        'line-opacity': 0.85,
      },
    },
    {
      id: 'building-walls',
      type: 'fill-extrusion',
      source: 'map',
      'source-layer': 'building',
      minzoom: 14,
      filter: standing,
      layout: { visibility: 'none' },
      paint: {
        'fill-extrusion-pattern': facade,
        'fill-extrusion-height': height,
        'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
        'fill-extrusion-vertical-gradient': true,
      },
    },
    {
      id: 'building-roof',
      type: 'fill-extrusion',
      source: 'map',
      'source-layer': 'building',
      minzoom: 14,
      filter: standing,
      layout: { visibility: 'none' },
      paint: {
        'fill-extrusion-color': ['to-color', ['get', 'colour'], c.buildingTop],
        'fill-extrusion-height': ['+', height, 0.5],
        'fill-extrusion-base': height,
      },
    },
    {
      id: 'water-label',
      type: 'symbol',
      source: 'map',
      'source-layer': 'water_name',
      layout: { 'text-field': label, 'text-font': ['Noto Sans Italic'], 'text-size': 12, 'text-letter-spacing': 0.04 },
      paint: { 'text-color': c.waterLabel, 'text-halo-color': c.halo, 'text-halo-width': 1 },
    },
    {
      id: 'road-label',
      type: 'symbol',
      source: 'map',
      'source-layer': 'transportation_name',
      minzoom: 13,
      layout: {
        'text-field': label,
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 13, 10, 17, 13],
        'symbol-placement': 'line',
        'text-rotation-alignment': 'map',
      },
      paint: { 'text-color': c.labelMuted, 'text-halo-color': c.halo, 'text-halo-width': 1.4 },
    },
    {
      id: 'house-number',
      type: 'symbol',
      source: 'map',
      'source-layer': 'housenumber',
      minzoom: 17,
      layout: { 'text-field': ['get', 'housenumber'], 'text-font': ['Noto Sans Regular'], 'text-size': 10 },
      paint: { 'text-color': c.labelMuted, 'text-halo-color': c.halo, 'text-halo-width': 1 },
    },
    {
      id: 'poi',
      type: 'symbol',
      source: 'map',
      'source-layer': 'poi',
      minzoom: 14,

      filter: ['all', ['!=', poiMatch((category) => category), ''], ['==', BRAND_ICON, ''], ['!', ['in', ['get', 'subclass'], ['literal', NOT_PLACES]]]],
      layout: {
        'icon-image': poiIconExpression(),

        'icon-size': ['interpolate', ['linear'], ['zoom'], 14, 0.5, 16, 0.68, 18, 0.85],
        'text-field': ['step', ['zoom'], '', 15.5, label],
        'text-font': ['Noto Sans Regular'],
        'text-size': 10.5,
        'text-anchor': 'top',
        'text-offset': [0, 0.9],
        'text-max-width': 8,
        'text-optional': true,
        'symbol-sort-key': ['coalesce', ['get', 'rank'], 100],
      },
      paint: {
        'icon-opacity': 0.85,
        'text-color': poiMatch((category) => POI_CATEGORIES[category].color, c.label),
        'text-opacity': 0.7,
        'text-halo-color': c.halo,
        'text-halo-width': 1.2,
      },
    },
    {
      id: 'poi-extra',
      type: 'symbol',
      source: 'extra-places',
      minzoom: 14,

      filter: ['all', ['!=', poiMatch((category) => category), ''], ['==', BRAND_ICON, ''], ['!', ['in', ['get', 'subclass'], ['literal', NOT_PLACES]]]],
      layout: {
        'icon-image': poiIconExpression(),

        'icon-size': ['interpolate', ['linear'], ['zoom'], 14, 0.5, 16, 0.68, 18, 0.85],
        'text-field': ['step', ['zoom'], '', 15.5, label],
        'text-font': ['Noto Sans Regular'],
        'text-size': 10.5,
        'text-anchor': 'top',
        'text-offset': [0, 0.9],
        'text-max-width': 8,
        'text-optional': true,
        'symbol-sort-key': ['coalesce', ['get', 'rank'], 100],
      },
      paint: {
        'icon-opacity': 0.85,
        'text-color': poiMatch((category) => POI_CATEGORIES[category].color, c.label),
        'text-opacity': 0.7,
        'text-halo-color': c.halo,
        'text-halo-width': 1.2,
      },
    },
    {
      id: 'poi-brands',
      type: 'symbol',
      source: 'map',
      'source-layer': 'poi',
      minzoom: 14,
      filter: ['!=', BRAND_ICON, ''],
      layout: {
        'icon-image': BRAND_ICON,
        'icon-size': ['interpolate', ['linear'], ['zoom'], 14, 0.72, 16, 0.86, 18, 1],
        'text-field': ['step', ['zoom'], '', 16, label],
        'text-font': ['Noto Sans Regular'],
        'text-size': 10.5,
        'text-anchor': 'top',
        'text-offset': [0, 1.2],
        'text-max-width': 8,
        'text-optional': true,
      },
      paint: {
        'text-color': c.label,
        'text-opacity': 0.75,
        'text-halo-color': c.halo,
        'text-halo-width': 1.2,
      },
    },
    {
      id: 'place-label',
      type: 'symbol',
      source: 'map',
      'source-layer': 'place',
      filter: ['in', ['get', 'class'], ['literal', ['city', 'town', 'village', 'suburb', 'neighbourhood', 'quarter']]],
      layout: {
        'text-field': label,
        'text-font': ['Noto Sans Bold'],
        'text-size': [
          'interpolate',
          ['linear'],
          ['zoom'],
          5,
          ['match', ['get', 'class'], 'city', 13, 'town', 10, 9],
          12,
          ['match', ['get', 'class'], 'city', 22, 'town', 17, 'village', 14, 12],
        ],
        'symbol-sort-key': ['coalesce', ['get', 'rank'], 30],
        'text-max-width': 9,
      },
      paint: {
        'text-color': ['match', ['get', 'class'], ['suburb', 'neighbourhood', 'quarter'], c.labelMuted, c.label],
        'text-halo-color': c.halo,
        'text-halo-width': 1.6,
      },
    },
  ];

  return {
    version: 8,
    light: { anchor: 'map', position: [1.3, 200, 40], color: '#FFFFFF', intensity: dark ? 0.3 : 0.42 },
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: {
      map: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' },
      'extra-places': { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
    },
    layers,
  };
}
