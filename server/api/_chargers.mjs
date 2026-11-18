export const AFIR = 'https://afir.digitraffic.fi/api/charging-network/v1';
export const AFIR_HEADERS = { 'Digitraffic-User': 'RAITTA/1.0 (https://raitta.fi)', 'Accept-Encoding': 'gzip' };

const DEFAULT_VAT = 25.5;
const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
const COMPONENTS = { ENERGY: 'E', TIME: 'T', PARKING_TIME: 'P', CONGESTION_TIME: 'C', FLAT: 'F' };
const PARKING = { PARKING_LOT: 'lot', ON_STREET: 'street', ALONG_MOTORWAY: 'motorway', PARKING_GARAGE: 'garage', UNDERGROUND_GARAGE: 'garage', ON_DRIVEWAY: 'driveway' };
const STATUS = { AVAILABLE: 'A', CHARGING: 'C', BLOCKED: 'B', RESERVED: 'R', OUTOFORDER: 'O', INOPERATIVE: 'O', PLANNED: 'P', REMOVED: 'O', UNKNOWN: 'U' };

function plug({ standard, format }) {
  if (standard === 'IEC_62196_T2_COMBO') return 'ccs';
  if (standard === 'IEC_62196_T2') return format === 'CABLE' ? 't2c' : 't2';
  if (standard === 'CHADEMO') return 'chademo';
  if (standard === 'DOMESTIC_F') return 'schuko';
  if (standard === 'MCS') return 'mcs';
  return 'other';
}

const round = (value, digits) => Math.round(value * 10 ** digits) / 10 ** digits;

function compactTariff(tariff) {
  const vatIncluded = tariff.taxIncluded === 'YES';
  const elements = tariff.elements.map(({ priceComponents, restrictions: r }) => {
    const element = {
      c: priceComponents
        .filter((p) => COMPONENTS[p.type])
        .map((p) => [COMPONENTS[p.type], round(vatIncluded ? p.price : p.price * (1 + (p.vat ?? DEFAULT_VAT) / 100), 4)]),
    };
    if (r) {
      const limits = {};
      if (r.startTime) limits.st = r.startTime;
      if (r.endTime) limits.et = r.endTime;
      if (r.dayOfWeek?.length && r.dayOfWeek.length < 7) limits.dw = r.dayOfWeek.map((day) => DAYS.indexOf(day));
      if (r.minDuration) limits.minD = Math.round(r.minDuration / 60);
      if (r.maxDuration) limits.maxD = Math.round(r.maxDuration / 60);
      if (r.minPower) limits.minP = r.minPower;
      if (r.maxPower) limits.maxP = r.maxPower;
      if (r.reservation) limits.rsv = 1;
      if (Object.keys(limits).length) element.r = limits;
    }
    return element;
  });
  const out = { e: elements };
  const alt = Object.fromEntries((tariff.tariffAltText ?? []).filter((t) => t.text?.trim()).map((t) => [t.language, t.text.trim()]));
  if (Object.keys(alt).length) out.alt = alt;
  if (tariff.tariffAltUrl) out.url = tariff.tariffAltUrl;
  return out;
}

const text = (list) => (list ?? []).find((entry) => entry.text?.trim())?.text.trim();

export function compactChargers(locations, tariffs) {
  const operators = [];
  const operatorIndex = new Map();
  const tariffList = [];
  const tariffIndex = new Map();
  const known = new Map(tariffs.map((tariff) => [tariff.id, tariff]));

  const operatorOf = (operator) => {
    const key = operator?.id ?? '?';
    if (!operatorIndex.has(key)) {
      operatorIndex.set(key, operators.length);
      const details = operator?.details ?? {};
      operators.push({ name: details.name ?? key, ...(details.website ? { web: details.website } : {}) });
    }
    return operatorIndex.get(key);
  };

  const byContent = new Map();
  const tariffOf = (ids) => {
    const id = (ids ?? []).find((candidate) => known.has(candidate));
    if (!id) return -1;
    if (!tariffIndex.has(id)) {
      const compact = compactTariff(known.get(id));
      const key = JSON.stringify(compact);
      if (!byContent.has(key)) {
        byContent.set(key, tariffList.length);
        tariffList.push(compact);
      }
      tariffIndex.set(id, byContent.get(key));
    }
    return tariffIndex.get(id);
  };

  const sites = locations
    .filter((feature) => feature.geometry?.coordinates && feature.properties.evses?.length)
    .map(({ geometry, properties: p }) => {
      const [lon, lat] = geometry.coordinates;
      const address = [p.address?.street, p.address?.city].filter(Boolean).join(', ');
      const site = {
        id: p.id,
        n: (p.name ?? address).trim(),
        o: operatorOf(p.operator),
        a: address,
        x: round(lon, 5),
        y: round(lat, 5),
        e: p.evses.map((evse) => [
          evse.id,
          evse.connectors.map((connector) => [plug(connector), Math.round((connector.maxElectricPower ?? 0) / 100) / 10, tariffOf(connector.tariffIds)]),
        ]),
      };
      if (PARKING[p.parkingType]) site.p = PARKING[p.parkingType];
      const hours = p.openingTimes;
      if (hours && !hours.twentyFourSeven && hours.regularHours?.length) {
        site.h = hours.regularHours.map((h) => [DAYS.indexOf(h.weekday), h.periodBegin, h.periodEnd]);
      }
      if (p.helpPhone) site.ph = p.helpPhone;
      const directions = text(p.directions);
      if (directions) site.d = directions;
      return site;
    });

  return { operators, tariffs: tariffList, sites };
}

export function compactStatuses(statuses) {
  const busy = {};
  for (const { evseId, status } of statuses) {
    const code = STATUS[status] ?? 'U';
    if (code !== 'A') busy[evseId] = code;
  }
  return busy;
}

export async function fetchAfir(path, signal) {
  const res = await fetch(`${AFIR}/${path}`, { headers: AFIR_HEADERS, signal, redirect: 'follow' });
  if (!res.ok) throw new Error(`AFIR ${path}: ${res.status}`);
  return res.json();
}
