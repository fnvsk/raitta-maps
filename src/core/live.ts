import { decodeVehiclePosition } from './gtfsrt';
import type { RealtimeSource } from './regions';
import type { Mode, Vehicle } from './types';

const HSL_BROKER = 'wss://mqtt.hsl.fi:443';
const DIGITRANSIT_BROKER = 'wss://mqtt.digitransit.fi:443';
const HSL_BASE = '/hfp/v2/journey/ongoing/vp';

const MAX_CELLS = 16;
const STALE_MS = 60_000;

const MIN_MOVE_M = 8;

export interface Bounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export function geohashCells(bounds: Bounds): string[] | null {
  const west = Math.floor(bounds.west * 10);
  const east = Math.floor(bounds.east * 10);
  const south = Math.floor(bounds.south * 10);
  const north = Math.floor(bounds.north * 10);
  if ((east - west + 1) * (north - south + 1) > MAX_CELLS) return null;
  const cells: string[] = [];
  for (let lat = south; lat <= north; lat++) {
    for (let lon = west; lon <= east; lon++) {
      cells.push(`${Math.floor(lat / 10)};${Math.floor(lon / 10)}/${lat % 10}${lon % 10}`);
    }
  }
  return cells;
}

export function topicsFor(source: RealtimeSource, bounds: Bounds | null): string[] {
  const cells = bounds ? geohashCells(bounds) : null;
  if (source.kind === 'hsl') {
    if (cells) return cells.map((cell) => `${HSL_BASE}/+/+/+/+/+/+/+/+/+/${cell}/#`);
    
    return ['tram', 'metro', 'train', 'ferry'].map((mode) => `${HSL_BASE}/${mode}/#`);
  }
  if (source.kind === 'digitransit') {
    const base = `/gtfsrt/vp/${source.feed}`;
    return cells ? cells.map((cell) => `${base}/+/+/+/+/+/+/+/+/+/+/${cell}/#`) : [`${base}/#`];
  }
  return [];
}

const TOPIC_MODES: Record<string, Mode> = {
  BUS: 'bus',
  TRAM: 'tram',
  RAIL: 'train',
  SUBWAY: 'metro',
  FERRY: 'ferry',
  bus: 'bus',
  ubus: 'bus',
  robot: 'bus',
  tram: 'tram',
  train: 'train',
  metro: 'metro',
  ferry: 'ferry',
};

function parseDirection(part: string, first = 0) {
  const direction = Number(part) - first;
  return direction === 0 || direction === 1 ? direction : undefined;
}

export function parseDigitransit(topic: string, payload: Uint8Array): Vehicle | null {
  const parts = topic.split('/');
  
  const position = decodeVehiclePosition(payload);
  if (!position || parts.length < 19) return null;
  return {
    ref: `${parts[3]}:${parts[13]}`,
    line: parts[parts.length - 3] || parts[7],
    mode: TOPIC_MODES[parts[6]] ?? 'bus',
    lat: position.lat,
    lon: position.lon,
    bearing: position.bearing,
    speedKmh: position.speed * 3.6,
    delaySec: null,
    destinationStop: '',
    direction: parseDirection(parts[8]),
    headsign: parts[9],
    nextStop: parts[11],
    trip: parts[10] || undefined,
    onward: [],
  };
}

interface HslPosition {
  desi?: string;
  veh?: number;
  oper?: number;
  lat?: number | null;
  long?: number | null;
  hdg?: number | null;
  spd?: number | null;
  dl?: number | null;
}

export function parseHsl(topic: string, payload: string): Vehicle | null {
  const vp = (JSON.parse(payload) as { VP?: HslPosition }).VP;
  if (!vp?.desi || vp.lat == null || vp.long == null) return null;
  const parts = topic.split('/');
  
  return {
    ref: `hsl:${vp.oper}_${vp.veh}`,
    line: vp.desi,
    mode: TOPIC_MODES[parts[6]] ?? 'bus',
    lat: vp.lat,
    lon: vp.long,
    bearing: vp.hdg ?? NaN,
    speedKmh: (vp.spd ?? 0) * 3.6,
    
    delaySec: vp.dl == null ? null : -vp.dl,
    destinationStop: '',
    
    direction: parseDirection(parts[10], 1),
    headsign: parts[11],
    nextStop: parts[13],
    
    trip: parts[12] ? `${parts[9]}|${parts[10]}|${parts[12]}` : undefined,
    onward: [],
  };
}

const COUPLED_M = 400;
const COUPLING: Mode[] = ['metro', 'train', 'tram'];

export function mergeCoupled(vehicles: Vehicle[]): Vehicle[] {
  const out: Vehicle[] = [];
  const groups = new Map<string, Vehicle[]>();
  for (const vehicle of vehicles) {
    if (!vehicle.trip || !COUPLING.includes(vehicle.mode)) {
      out.push(vehicle);
      continue;
    }
    const key = `${vehicle.mode}|${vehicle.line}|${vehicle.trip}`;
    groups.set(key, [...(groups.get(key) ?? []), vehicle]);
  }
  for (const units of groups.values()) {
    units.sort((a, b) => a.ref.localeCompare(b.ref));
    const trains: Vehicle[][] = [];
    for (const unit of units) {
      const near = trains.find((train) => metresBetween(train[0], unit) < COUPLED_M);
      if (near) near.push(unit);
      else trains.push([unit]);
    }
    for (const train of trains) {
      const lat = train.reduce((sum, unit) => sum + unit.lat, 0) / train.length;
      const lon = train.reduce((sum, unit) => sum + unit.lon, 0) / train.length;
      out.push({ ...train[0], lat, lon });
    }
  }
  return out;
}

const metresBetween = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) =>
  Math.hypot((a.lat - b.lat) * 111_320, (a.lon - b.lon) * 111_320 * Math.cos((a.lat * Math.PI) / 180));

function headingBetween(from: { lat: number; lon: number }, to: { lat: number; lon: number }) {
  const north = (to.lat - from.lat) * 111_320;
  const east = (to.lon - from.lon) * 111_320 * Math.cos((to.lat * Math.PI) / 180);
  if (Math.hypot(north, east) < MIN_MOVE_M) return null;
  return ((Math.atan2(east, north) * 180) / Math.PI + 360) % 360;
}

export function lineTopics(source: RealtimeSource, routes: string[]): string[] {
  if (source.kind === 'hsl') return routes.map((route) => `${HSL_BASE}/+/+/+/${route}/#`);
  
  if (source.kind === 'digitransit') return [`/gtfsrt/vp/${source.feed}/#`];
  return [];
}

type Client = Awaited<ReturnType<typeof import('mqtt')['connectAsync']>>;

export class LiveFeed {
  private client: Client | null = null;
  
  private vehicles = new Map<string, { vehicle: Vehicle; seen: number; from: { lat: number; lon: number } }>();
  private topics = new Set<string>();
  private bounds: Bounds | null = null;
  private lineRoutes: string[] | null = null;
  private stopped = false;

  constructor(
    readonly regionId: string,
    private readonly source: RealtimeSource,
  ) {}

  async start() {
    this.stopped = false;
    const mqtt = await import('mqtt');
    
    const connect = mqtt.connect ?? mqtt.default.connect;
    if (this.stopped) return;
    const client = connect(this.source.kind === 'hsl' ? HSL_BROKER : DIGITRANSIT_BROKER, {
      reconnectPeriod: 5_000,
      connectTimeout: 10_000,
    }) as unknown as Client;
    this.client = client;
    client.on('connect', () => {
      this.topics.clear();
      this.syncTopics();
    });
    client.on('message', (topic, payload) => this.receive(topic, payload));
  }

  stop() {
    this.stopped = true;
    this.client?.end(true);
    this.client = null;
    
    this.vehicles.clear();
  }

  setViewport(bounds: Bounds) {
    this.bounds = bounds;
    this.syncTopics();
  }

  setLine(routes: string[] | null) {
    this.lineRoutes = routes;
    this.syncTopics();
  }

  snapshot(): Vehicle[] {
    const cutoff = Date.now() - STALE_MS;
    const out: Vehicle[] = [];
    for (const [ref, entry] of this.vehicles) {
      if (entry.seen < cutoff) this.vehicles.delete(ref);
      else out.push(entry.vehicle);
    }
    return mergeCoupled(out);
  }

  private receive(topic: string, payload: Uint8Array) {
    try {
      const vehicle =
        this.source.kind === 'hsl'
          ? parseHsl(topic, new TextDecoder().decode(payload))
          : parseDigitransit(topic, payload);
      if (!vehicle) return;
      const previous = this.vehicles.get(vehicle.ref);
      let from = previous?.from ?? vehicle;
      
      if (!Number.isFinite(vehicle.bearing)) {
        const heading = headingBetween(from, vehicle);
        if (heading !== null) from = vehicle;
        vehicle.bearing = heading ?? previous?.vehicle.bearing ?? 0;
      }
      this.vehicles.set(vehicle.ref, { vehicle, seen: Date.now(), from: { lat: from.lat, lon: from.lon } });
    } catch {
    }
  }

  private syncTopics() {
    const client = this.client;
    if (!client?.connected) return;
    const wanted = new Set([...topicsFor(this.source, this.bounds), ...(this.lineRoutes ? lineTopics(this.source, this.lineRoutes) : [])]);
    const added = [...wanted].filter((t) => !this.topics.has(t));
    const removed = [...this.topics].filter((t) => !wanted.has(t));
    if (added.length) void client.subscribeAsync(added);
    if (removed.length) void client.unsubscribeAsync(removed);
    this.topics = wanted;
  }
}
