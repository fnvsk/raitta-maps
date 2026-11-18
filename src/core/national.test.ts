import { describe, expect, it } from 'vitest';
import { addressesFor, dedupePlaces, toPlace } from './geocode';
import { decodeVehiclePosition } from './gtfsrt';
import { geohashCells, parseDigitransit, parseHsl, topicsFor } from './live';
import { parsePrice, toDetails, toStation } from './fuel';
import { inBounds, regionAt, REGIONS, shardOf, type RegionInfo } from './regions';
import { parseTrains, REGION_STATIONS } from './trains';
import { detectPlatform, ticketAppFor, ticketStoreUrl, ticketUrl } from './tickets';

function encodeFeed(lat: number, lon: number, bearing: number, speed: number) {
  const float = (tag: number, value: number) => {
    const b = new Uint8Array(5);
    b[0] = tag;
    new DataView(b.buffer).setFloat32(1, value, true);
    return [...b];
  };
  const position = [...float(0x0d, lat), ...float(0x15, lon), ...float(0x1d, bearing), ...float(0x2d, speed)];
  const vehicle = [0x12, position.length, ...position];
  const entity = [0x0a, 1, 0x41, 0x22, vehicle.length, ...vehicle];

  return new Uint8Array([0x0a, 2, 0x10, 1, 0x12, entity.length, ...entity]);
}

describe('decodeVehiclePosition', () => {
  it('reads the position out of a feed message', () => {
    const decoded = decodeVehiclePosition(encodeFeed(64.95, 25.49, 90, 10))!;
    expect(decoded.lat).toBeCloseTo(64.95, 4);
    expect(decoded.lon).toBeCloseTo(25.49, 4);
    expect(decoded.bearing).toBe(90);
    expect(decoded.speed).toBe(10);
  });

  it('rejects garbage without throwing', () => {
    expect(decodeVehiclePosition(new Uint8Array([0xff, 0xff, 0xff]))).toBeNull();
    expect(decodeVehiclePosition(new Uint8Array())).toBeNull();
  });
});

describe('live topics', () => {
  it('names the 0.1 degree cells covering a viewport', () => {
    expect(geohashCells({ west: 24.91, east: 24.99, south: 60.15, north: 60.19 })).toEqual(['60;24/19']);
    expect(geohashCells({ west: 24.95, east: 25.05, south: 60.15, north: 60.19 })).toEqual(['60;24/19', '60;25/10']);
  });

  it('gives up on cells when zoomed far out', () => {
    expect(geohashCells({ west: 20, east: 30, south: 60, north: 65 })).toBeNull();
  });

  it('never subscribes to all of Helsinki', () => {
    const topics = topicsFor({ kind: 'hsl' }, null);
    expect(topics.every((t) => /\/(tram|metro|train|ferry)\/#$/.test(t))).toBe(true);
  });

  it('builds a topic that matches a real Digitransit message', () => {
    const [topic] = topicsFor({ kind: 'digitransit', feed: 'OULU' }, { west: 25.41, east: 25.49, south: 64.91, north: 64.99 });
    const real = '/gtfsrt/vp/OULU///BUS/999/0/Lentoasema/T_T/101047/19:15/6750_1406/64;25/94/59/01/9/3300FC/';
    const matcher = new RegExp(`^${topic.replaceAll('+', '[^/]*').replace('#', '.*')}$`);
    expect(real).toMatch(matcher);
  });

  it('builds a topic that matches a real HSL message', () => {
    const [topic] = topicsFor({ kind: 'hsl' }, { west: 24.91, east: 24.99, south: 60.11, north: 60.19 });
    const real = '/hfp/v2/journey/ongoing/vp/tram/0040/00414/1005T/1/Katajanokan term./20:00/1203425/5/60;24/19/50/49';
    const matcher = new RegExp(`^${topic.replaceAll('+', '[^/]*').replace('#', '.*')}$`);
    expect(real).toMatch(matcher);
  });
});

describe('live messages', () => {
  it('reads line, mode and headsign from a Digitransit topic', () => {
    const topic = '/gtfsrt/vp/OULU///BUS/999/0/Lentoasema/T_T/101047/19:15/6750_1406/64;25/94/59/01/9/3300FC/';
    const vehicle = parseDigitransit(topic, encodeFeed(64.95, 25.49, 90, 10));
    expect(vehicle).toMatchObject({
      ref: 'OULU:6750_1406',
      line: '9',
      mode: 'bus',
      headsign: 'Lentoasema',
      nextStop: '101047',
      delaySec: null,
      speedKmh: 36,
    });
  });

  it('reads an HSL message and flips the delay sign', () => {
    const topic = '/hfp/v2/journey/ongoing/vp/tram/0040/00414/1005T/1/Katajanokan term./20:00/1203425/5/60;24/19/50/49';
    const payload = JSON.stringify({ VP: { desi: '5', veh: 414, oper: 40, lat: 60.15, long: 24.9, hdg: 180, spd: 5, dl: -120 } });
    expect(parseHsl(topic, payload)).toMatchObject({
      ref: 'hsl:40_414',
      line: '5',
      mode: 'tram',
      delaySec: 120,
      speedKmh: 18,
      headsign: 'Katajanokan term.',
    });
  });

  it('skips HSL messages without a position', () => {
    expect(parseHsl('/hfp', JSON.stringify({ VP: { desi: '5', lat: null, long: null } }))).toBeNull();
  });
});

describe('regions', () => {
  const region = (id: string, lat: number, lon: number): RegionInfo => ({
    id,
    center: { lat, lon },
    bbox: [lon - 1, lat - 1, lon + 1, lat + 1],
    stops: 1,
    lines: 1,
    shapeShards: 1,
    timetableShards: 1,
    generatedAt: '',
    validTo: 0,
  });

  it('prefers the closest centre where regions overlap', () => {
    const regions = [region('a', 61, 24), region('b', 61.5, 24.5)];
    expect(regionAt(regions, { lat: 61.4, lon: 24.4 })?.id).toBe('b');
    expect(regionAt(regions, { lat: 69, lon: 27 })).toBeUndefined();
  });

  it('honours a margin', () => {
    expect(inBounds(region('a', 61, 24), { lat: 62.1, lon: 24 })).toBe(false);
    expect(inBounds(region('a', 61, 24), { lat: 62.1, lon: 24 }, 0.2)).toBe(true);
  });

  it('assigns every id a stable shard in range', () => {
    expect(shardOf('0001', 16)).toBe(shardOf('0001', 16));
    for (const id of ['0001', 'HSL:1010102', 'M1', 'IC 966', 'Ääkkönen']) {
      expect(shardOf(id, 7)).toBeGreaterThanOrEqual(0);
      expect(shardOf(id, 7)).toBeLessThan(7);
    }
  });

  it('matches the data script', () => {
    expect(shardOf('01', 10)).toBe(7);
  });
});

describe('tickets', () => {
  it('sends each city to its own app', () => {
    expect(ticketAppFor('helsinki').name).toBe('HSL');
    expect(ticketAppFor('tampere').name).toBe('Nysse Mobiili');
    expect(ticketAppFor('turku').name).toBe('Föli');
    expect(ticketAppFor('oulu').name).toBe('OSL');
    expect(ticketAppFor('kuopio').name).toBe('Vilkku');
    expect(ticketAppFor('jyvaskyla').name).toBe('Waltti Mobile');
  });

  it('detects platforms, including iPads that claim to be Macs', () => {
    expect(detectPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 26_0)')).toBe('ios');
    expect(detectPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X)', 5)).toBe('ios');
    expect(detectPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X)', 0)).toBe('other');
    expect(detectPlatform('Mozilla/5.0 (Linux; Android 15)')).toBe('android');
  });

  it('hands Android the app link, with Google Play as the fallback', () => {
    const url = ticketUrl(ticketAppFor('tampere'), 'android');
    expect(url).toMatch(/^intent:\/\/kauppa\.waltti\.fi\/nysseapp\/#Intent;scheme=https;package=nysse\.fi\.mobiili;/);
    expect(url).toContain('S.browser_fallback_url=https%3A%2F%2Fplay.google.com');
  });

  it('never sends a phone to the app link as a web page', () => {
    for (const region of ['tampere', 'oulu', 'jyvaskyla']) {
      expect(ticketUrl(ticketAppFor(region), 'ios')).not.toContain('waltti.fi');
      expect(ticketUrl(ticketAppFor(region), 'android')).toMatch(/^intent:/);
    }
  });

  it('goes to the store for apps without a public link', () => {
    const app = ticketAppFor('helsinki');
    expect(ticketUrl(app, 'ios')).toBe('itms-apps://apps.apple.com/app/id1340229182');
    expect(ticketUrl(app, 'android')).toBe('https://play.google.com/store/apps/details?id=fi.hsl.app');
    expect(ticketStoreUrl(app, 'ios')).toBe('https://apps.apple.com/fi/app/id1340229182');
  });

  it('uses the website on a computer', () => {
    const app = ticketAppFor('tampere');
    expect(ticketUrl(app, 'other')).toBe(app.web);
  });
});

describe('place search', () => {
  const feature = (properties: object, lat = 61.5, lon = 23.7) => ({
    geometry: { coordinates: [lon, lat] as [number, number] },
    properties,
  });

  it('classifies what people search for', () => {
    expect(toPlace(feature({ name: 'Hämeenkatu', osm_key: 'highway', osm_value: 'residential', city: 'Tampere' }))).toMatchObject({
      kind: 'street',
      detail: 'Tampere',
    });
    expect(toPlace(feature({ name: 'Tampereen yliopisto', osm_key: 'amenity', osm_value: 'university' }))?.kind).toBe('university');
    expect(toPlace(feature({ name: 'Hervannan lukio', osm_key: 'amenity', osm_value: 'school' }))?.kind).toBe('school');
    expect(toPlace(feature({ name: 'K-Citymarket', osm_key: 'shop', osm_value: 'supermarket' }))?.kind).toBe('shop');
    expect(toPlace(feature({ name: 'Näsinneula', osm_key: 'man_made', osm_value: 'tower' }))?.kind).toBe('landmark');
  });

  it('names a bare address from its street and number', () => {
    expect(toPlace(feature({ street: 'Mannerheimintie', housenumber: '10', osm_key: 'building', city: 'Helsinki' }))).toMatchObject({
      name: 'Mannerheimintie 10',
      kind: 'address',
    });
  });

  it('leaves out stops, foreign results and nameless features', () => {
    expect(toPlace(feature({ name: 'Keskustori', osm_value: 'bus_stop' }))).toBeNull();
    expect(toPlace(feature({ name: 'Tallinn', countrycode: 'EE' }))).toBeNull();
    expect(toPlace(feature({ osm_key: 'building' }))).toBeNull();
  });

  it('shows a road split into many segments once per town', () => {
    const road = (id: number, city: string) => toPlace(feature({ osm_id: id, name: 'Hämeenkatu', osm_key: 'highway', city }))!;
    expect(dedupePlaces([road(1, 'Turku'), road(2, 'Turku'), road(3, 'Tampere')])).toHaveLength(2);
  });
});

describe('trains', () => {
  const row = (type: string, stationShortCode: string, scheduledTime: string, extra = {}) => ({
    type,
    stationShortCode,
    scheduledTime,
    commercialStop: true,
    ...extra,
  });
  const train = {
    trainType: 'IC',
    trainNumber: 20,
    timeTableRows: [
      row('DEPARTURE', 'TPE', '2026-11-02T08:00:00.000Z'),
      row('ARRIVAL', 'HKI', '2026-11-02T09:40:00.000Z', { liveEstimateTime: '2026-11-02T09:45:00.000Z' }),
    ],
  };

  it('reads a direct train, preferring live estimates', () => {
    const [option] = parseTrains([train], 'TPE', 'HKI', 0);
    expect(option.name).toBe('IC 20');
    expect(option.arrival - option.departure).toBe(105 * 60_000);
  });

  it('leaves out cancelled, past and wrong-way trains', () => {
    expect(parseTrains([{ ...train, cancelled: true }], 'TPE', 'HKI', 0)).toEqual([]);
    expect(parseTrains([train], 'TPE', 'HKI', Date.parse('2026-11-02T09:00:00Z'))).toEqual([]);
    expect(parseTrains([train], 'HKI', 'TPE', 0)).toEqual([]);
  });

  it('knows a station for every region', () => {
    expect(Object.keys(REGION_STATIONS).sort()).toEqual(REGIONS.map((r) => r.id).sort());
  });
});

describe('station details', () => {
  it('reads either way of tagging contacts, and the fuels on sale', () => {
    const details = toDetails({ brand: 'St1', 'contact:phone': '+358 40 1', website: 'https://st1.fi', 'fuel:diesel': 'yes', 'fuel:octane_95': 'yes', 'fuel:lpg': 'no' });
    expect(details).toEqual({ brand: 'St1', phone: '+358 40 1', website: 'https://st1.fi', openingHours: undefined, fuels: ['95', 'Diesel'] });
  });

  it('records where a station is in OpenStreetMap', () => {
    const station = toStation({ geometry: { coordinates: [23.7, 61.5] }, properties: { osm_type: 'W', osm_id: 7, name: 'Neste' } }, { lat: 61.5, lon: 23.7 });
    expect(station.osm).toBe('way(7)');
  });
});

describe('typed fuel prices', () => {
  it('reads a comma or a point', () => {
    expect(parsePrice('2,249')).toBe(2.249);
    expect(parsePrice(' 2.249 ')).toBe(2.249);
  });

  it('treats an empty field as not reported', () => {
    expect(parsePrice('  ')).toBeUndefined();
  });

  it('refuses what cannot be a price', () => {
    expect(parsePrice('22')).toBeNull();
    expect(parsePrice('0,5')).toBeNull();
    expect(parsePrice('cheap')).toBeNull();
  });
});

describe('fuel stations', () => {
  it('reads a station and measures its distance', () => {
    const near = { lat: 61.5, lon: 23.7 };
    const station = toStation(
      {
        geometry: { coordinates: [23.7, 61.51] },
        properties: { osm_id: 5, name: 'Neste', street: 'Hatanpään valtatie', housenumber: '20', city: 'Tampere' },
      },
      near,
    );
    expect(station).toMatchObject({ id: '5', name: 'Neste', address: 'Hatanpään valtatie 20, Tampere' });
    expect(Math.round(station.meters / 100)).toBe(11);
  });
});

describe('Telegram welcome', () => {
  it('answers in the rider\'s language, and in English otherwise', async () => {
    // @ts-expect-error untyped JS module
    const { textsFor } = await import('../../server/api/telegram.mjs');
    expect(textsFor('fi').open).toBe('Avaa RAITTA');
    expect(textsFor('ru-RU').open).toBe('Открыть RAITTA');
    expect(textsFor('ko').open).toBe('Open RAITTA');
    expect(textsFor(undefined).open).toBe('Open RAITTA');
  });
});

describe('house numbers', () => {
  const bar = {
    geometry: { coordinates: [23.7575, 61.4985] as [number, number] },
    properties: { osm_key: 'amenity', osm_value: 'bar', name: 'Sherlock', street: 'Hämeenkatu', housenumber: '10', city: 'Tampere', countrycode: 'FI' },
  };
  it('puts the typed address first, made from a place at it', () => {
    expect(addressesFor('hameenkatu 10', [bar])).toEqual([
      { id: 'address-Hämeenkatu 10|Tampere', name: 'Hämeenkatu 10', detail: 'Tampere', kind: 'address', lat: 61.4985, lon: 23.7575 },
    ]);
    expect(addressesFor('Hämeenkatu 12', [bar])).toEqual([]);
    expect(addressesFor('Hämeenkatu', [bar])).toEqual([]);
  });
});
