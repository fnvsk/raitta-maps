export const MESSAGES = 'https://tie.digitraffic.fi/api/traffic-message/v1/messages';
export const HEADERS = { 'Digitraffic-User': 'RAITTA/1.0 (https://raitta.fi)', 'Accept-Encoding': 'gzip' };
export const SITUATIONS = ['TRAFFIC_ANNOUNCEMENT', 'ROAD_WORK'];

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

const SIMPLIFY_DEG = 0.00014;

const PHRASES = {
  'Tie on suljettu liikenteeltä': 'ROAD_CLOSED',
  'Tie on ajoittain suljettu liikenteeltä': 'INTERMITTENT_SHORT_TERM_CLOSURE',
  'Ajokaista suljettu liikenteeltä': 'SINGLE_LANE_CLOSED',
  'Ajokaistoja suljettu liikenteeltä': 'MULTIPLE_LANES_CLOSED',
  'Toinen ajorata on suljettu liikenteeltä': 'MULTIPLE_LANES_CLOSED',
  'Ajokaistoja on kavennettu': 'NARROW_LANES',
  'Tapahtumapaikalla on käytössä kiertotie': 'DETOUR',
  'Paikalla on kiertotieopastus': 'DETOUR',
  'Liikenne ruuhkautuu': 'QUEUE',
  'Liikenne saattaa ruuhkautua': 'QUEUE',
  'Liikenne on jonoutunut': 'QUEUE',
  'Liikenne pysäytetään ajoittain': 'INTERMITTENT_SHORT_TERM_STOPS',
  'Liikenne ohjataan vuorotellen tapahtumapaikan ohi': 'SINGLE_ALTERNATE_LINE_TRAFFIC',
  'Paikalla tilapäinen liikennevalo-ohjaus': 'TRAFFIC_LIGHTS',
  'Lauttaliikenne keskeytetään huoltotyön ajaksi': 'FERRY_STOPPED',
  'Liikennejärjestelyt ovat muuttuneet': 'CHANGED_ARRANGEMENTS',
};

const SHOWN = new Set([
  'ROAD_CLOSED',
  'INTERMITTENT_SHORT_TERM_CLOSURE',
  'SINGLE_LANE_CLOSED',
  'MULTIPLE_LANES_CLOSED',
  'NARROW_LANES',
  'SINGLE_ALTERNATE_LINE_TRAFFIC',
  'INTERMITTENT_SHORT_TERM_STOPS',
  'INTERMITTENT_STOPS_AND_CLOSURE_EFFECTIVE',
  'TRAFFIC_LIGHTS',
  'DETOUR',
  'DETOUR_LENGTH',
  'SPEED_LIMIT',
  'SLOW_MOVING_MAINTENANCE_VEHICLE',
  'ESTIMATED_DELAY',
  'ESTIMATED_DELAY_DURING_RUSH_HOUR',
  'QUEUE',
  'FERRY_STOPPED',
  'CHANGED_ARRANGEMENTS',
]);
const CLOSED = new Set(['ROAD_CLOSED']);
const ACCIDENTS = new Set(['ACCIDENT_REPORT', 'PRELIMINARY_ACCIDENT_REPORT']);
const GONE = new Set(['ENDED', 'RETRACTED']);

const round = (value) => Math.round(value * 1e5) / 1e5;

function simplify(points) {
  if (points.length < 3) return points;
  const k = Math.cos((points[0][1] * Math.PI) / 180);
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop();
    const [ax, ay] = points[first];
    const [bx, by] = points[last];
    const dx = (bx - ax) * k;
    const dy = by - ay;
    const length = Math.hypot(dx, dy) || 1e-12;
    let farthest = -1;
    let distance = SIMPLIFY_DEG;
    for (let i = first + 1; i < last; i++) {
      const d = Math.abs(((points[i][0] - ax) * k) * dy - (points[i][1] - ay) * dx) / length;
      if (d > distance) [farthest, distance] = [i, d];
    }
    if (farthest > 0) {
      keep[farthest] = 1;
      stack.push([first, farthest], [farthest, last]);
    }
  }
  return points.filter((_, i) => keep[i]).map(([x, y]) => [round(x), round(y)]);
}

function shapeOf(geometry) {
  if (!geometry) return null;
  if (geometry.type === 'Point') return { point: geometry.coordinates.map(round) };
  if (geometry.type === 'LineString') return { lines: [simplify(geometry.coordinates)] };
  if (geometry.type === 'MultiLineString') return { lines: geometry.coordinates.map(simplify) };
  if (geometry.type === 'GeometryCollection') {
    const parts = geometry.geometries.map(shapeOf).filter(Boolean);
    const lines = parts.flatMap((part) => part.lines ?? []);
    return lines.length ? { lines } : parts[0] ?? null;
  }
  return null;
}

const inForce = (time, now) => {
  const start = time?.startTime ? Date.parse(time.startTime) : -Infinity;
  const end = time?.endTime ? Date.parse(time.endTime) : Infinity;
  return start <= now && now <= end;
};

function withinHours(hours, now) {
  if (!hours?.length) return true;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Helsinki', weekday: 'long', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  const day = parts.weekday.toUpperCase();
  const clock = `${parts.hour}:${parts.minute}:${parts.second}`;
  return hours.some((h) => h.weekday === day && clock >= h.startTime && clock < h.endTime);
}

function placeOf(announcement) {
  const point = announcement.locationDetails?.roadAddressLocation?.primaryPoint;
  const towns = new Set(
    [point?.municipality, announcement.locationDetails?.roadAddressLocation?.secondaryPoint?.municipality].filter(Boolean),
  );
  const first = (announcement.title ?? '').split('. ')[0].trim();
  const named = /^Tie (\d+)(?:, eli ([^,]+))?(?:, (.+))?$/.exec(first);
  if (named) {
    for (const town of (named[3] ?? '').split(', ').filter(Boolean)) towns.add(town);
    return { road: Number(named[1]), name: named[2] ?? point?.roadName, towns: [...towns] };
  }

  const [street, ...rest] = first.split(', ');
  for (const town of rest) towns.add(town);
  return { name: street && !/^Liikennetiedote/.test(street) ? street : point?.roadName, towns: [...towns] };
}

const restrictionOf = (type, restriction) => {
  const out = { t: type };
  if (restriction?.quantity !== undefined) out.v = restriction.quantity;
  if (restriction?.unit) out.u = restriction.unit;
  return out;
};

export function compactEvent(feature, now = Date.now()) {
  const p = feature.properties;
  const announcement = p.announcements?.find((a) => a.language === 'FI') ?? p.announcements?.[0];
  if (!announcement || GONE.has(p.trafficAnnouncementType) || /päättynyt/i.test(announcement.title ?? '')) return null;
  if (!inForce(announcement.timeAndDuration, now)) return null;

  const phases = (announcement.roadWorkPhases ?? []).filter((phase) => inForce(phase.timeAndDuration, now));
  if (p.situationType === 'ROAD_WORK' && !phases.length) return null;
  const working = phases.some((phase) => withinHours(phase.workingHours, now));

  const restrictions = new Map();
  for (const phase of phases) for (const r of phase.restrictions ?? []) if (SHOWN.has(r.type)) restrictions.set(r.type, restrictionOf(r.type, r.restriction));
  for (const feature of announcement.features ?? []) {
    const code = PHRASES[feature.name];
    if (code && !restrictions.has(code)) restrictions.set(code, restrictionOf(code, feature));
  }
  const shape = shapeOf(feature.geometry);
  if (!shape) return null;

  const accident = ACCIDENTS.has(p.trafficAnnouncementType);
  const closed = [...restrictions.keys()].some((code) => CLOSED.has(code));
  const comment = [announcement.comment, ...phases.map((phase) => phase.comment)].filter(Boolean).join('\n').trim();
  const severity = phases.some((phase) => phase.severity === 'HIGHEST') ? 3 : phases.some((phase) => phase.severity === 'HIGH') ? 2 : 1;

  return {
    id: p.situationId,
    kind: accident ? 'accident' : closed ? 'closure' : p.situationType === 'ROAD_WORK' ? 'roadwork' : 'notice',
    ...placeOf(announcement),
    where: announcement.location?.description?.replace(/\n/g, ' ').trim(),
    r: [...restrictions.values()],
    sev: severity,

    ...(p.situationType === 'ROAD_WORK' ? { now: working } : {}),
    start: announcement.timeAndDuration?.startTime,
    end: announcement.timeAndDuration?.endTime,
    ...(comment ? { fi: comment } : {}),
    ...shape,
  };
}

const ROUTE_URL = process.env.ROUTE_URL ?? 'https://route.raitta.fi';
const ROUGH_POINTS = 3;

const MAX_DETOUR = 2.5;
const SNAP_PARALLEL = 3;
const snapped = new Map();

const metres = ([ax, ay], [bx, by]) => Math.hypot((bx - ax) * Math.cos((ay * Math.PI) / 180), by - ay) * 111_320;
const lengthOf = (line) => line.slice(1).reduce((sum, point, i) => sum + metres(line[i], point), 0);

function decodePolyline6(text) {
  const points = [];
  let index = 0;
  let lat = 0;
  let lon = 0;
  while (index < text.length) {
    for (const axis of [0, 1]) {
      let shift = 0;
      let result = 0;
      let byte;
      do {
        byte = text.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (axis === 0) lat += delta;
      else lon += delta;
    }
    points.push([round(lon / 1e6), round(lat / 1e6)]);
  }
  return points;
}

const GOOD_DETOUR = 1.6;
const SLACK_M = 50;

async function pathAlong(line, costing, options, signal) {
  const res = await fetch(`${ROUTE_URL}/route`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      locations: line.map(([lon, lat]) => ({ lon, lat, type: 'break', radius: 15 })),
      costing,
      costing_options: { [costing]: options },
      directions_type: 'none',
    }),
  });

  if (res.status === 400) return null;
  if (!res.ok) throw new Error(`route ${res.status}`);
  const { trip } = await res.json();
  return trip.legs.flatMap((leg, i) => decodePolyline6(leg.shape).slice(i ? 1 : 0));
}

async function streetBetween(line, signal) {
  const key = JSON.stringify(line);
  if (snapped.has(key)) return snapped.get(key);
  const straight = lengthOf(line);
  const free = { ignore_oneways: true, ignore_closures: true, ignore_restrictions: true, ignore_access: true };
  let best = await pathAlong(line, 'auto', free, signal);
  if (!best || lengthOf(best) > straight * GOOD_DETOUR + SLACK_M) {
    const walk = await pathAlong(line, 'pedestrian', {}, signal);
    if (walk && (!best || lengthOf(walk) < lengthOf(best))) best = walk;
  }
  const street = best && lengthOf(best) <= straight * MAX_DETOUR + SLACK_M ? best : null;
  snapped.set(key, street);
  return street;
}

export const snapCache = {
  load: (entries) => entries.forEach(([key, street]) => snapped.set(key, street)),
  entries: () => [...snapped],
};

const isRough = (event) => event.lines?.some((line) => line.length <= ROUGH_POINTS);

export function markRough(events) {
  for (const event of events) if (isRough(event)) event.rough = true;
  return events;
}

export async function snapRoughLines(events, signal) {
  const current = new Set(events.filter(isRough).flatMap((event) => event.lines.map((line) => JSON.stringify(line))));
  for (const key of snapped.keys()) if (!current.has(key)) snapped.delete(key);
  const rough = events.filter(isRough);
  const queue = [...rough];
  let unreachable = false;
  const worker = async () => {
    for (let event = queue.shift(); event; event = queue.shift()) {
      if (unreachable) {
        event.rough = true;
        continue;
      }
      try {
        const lines = [];
        for (const line of event.lines) lines.push(line.length <= ROUGH_POINTS ? await streetBetween(line, signal) : line);
        if (lines.every(Boolean)) event.lines = lines;
        else event.rough = true;
      } catch {
        unreachable = true;
        event.rough = true;
      }
    }
  };
  await Promise.all(Array.from({ length: SNAP_PARALLEL }, worker));
  return events;
}

export async function fetchSituation(type, signal) {
  const params = new URLSearchParams({ inactiveHours: '0', includeAreaGeometry: 'false', situationType: type });
  const res = await fetch(`${MESSAGES}?${params}`, { headers: HEADERS, signal });
  if (!res.ok) throw new Error(`Traffic messages ${type}: ${res.status}`);
  return (await res.json()).features ?? [];
}
