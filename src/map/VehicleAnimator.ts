import type { Map as MapLibre } from 'maplibre-gl';
import type { Vehicle } from '@/core/types';
import { setSource } from './layers';
import { tagId } from './vehicleIcons';

export interface GlidePace {
  glideMs: number;
  
  maxJumpDeg: number;
  
  maxGapMs: number;
  
  along?: (from: [number, number], to: [number, number], vehicle: Vehicle) => [number, number][] | null;
}

export const CITY_PACE: GlidePace = { glideMs: 3_600, maxJumpDeg: 0.01, maxGapMs: 12_000 };

export const TRAIN_PACE: GlidePace = { glideMs: 15_000, maxJumpDeg: 0.05, maxGapMs: 45_000 };

const FRAME_MS = 80;

interface Track {
  vehicle: Vehicle;
  fromLon: number;
  fromLat: number;
  start: number;
  
  path?: [number, number][];
  share?: number[];
}

function sharesOf(path: [number, number][]) {
  const k = Math.cos((path[0][1] * Math.PI) / 180);
  const lengths = [0];
  for (let i = 1; i < path.length; i++) lengths.push(lengths[i - 1] + Math.hypot((path[i][0] - path[i - 1][0]) * k, path[i][1] - path[i - 1][1]));
  const total = lengths[lengths.length - 1];
  return total ? lengths.map((length) => length / total) : null;
}

export class VehicleAnimator {
  private tracks = new Map<string, Track>();
  private raf = 0;
  private lastFrame = 0;
  private lastUpdate = 0;
  private pace = CITY_PACE;
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor(
    private readonly map: MapLibre,
    private readonly paused: () => boolean,
  ) {}

  update(vehicles: Vehicle[], pace: GlidePace = CITY_PACE) {
    const now = performance.now();
    
    const fresh = pace === this.pace && now - this.lastUpdate < pace.maxGapMs;
    this.pace = pace;
    this.lastUpdate = now;
    const next = new Map<string, Track>();
    for (const vehicle of vehicles) {
      const previous = fresh ? this.tracks.get(vehicle.ref) : undefined;
      const [lon, lat] = previous ? this.position(previous, now) : [vehicle.lon, vehicle.lat];
      const jump = Math.max(Math.abs(lon - vehicle.lon), Math.abs(lat - vehicle.lat));
      const glide = previous && jump < pace.maxJumpDeg && !this.reducedMotion;
      const path = glide && pace.along ? pace.along([lon, lat], [vehicle.lon, vehicle.lat], vehicle) : null;
      const share = path && path.length > 2 ? sharesOf(path) : null;
      next.set(vehicle.ref, {
        vehicle,
        fromLon: glide ? lon : vehicle.lon,
        fromLat: glide ? lat : vehicle.lat,
        start: now,
        ...(path && share ? { path, share } : {}),
      });
    }
    this.tracks = next;
    this.draw(now);
    if (!this.raf) this.raf = requestAnimationFrame(this.frame);
  }

  redraw() {
    this.draw(performance.now());
  }

  reset() {
    this.tracks.clear();
    this.lastUpdate = 0;
    setSource(this.map, 'vehicles', { type: 'FeatureCollection', features: [] });
  }

  snapshot() {
    const now = performance.now();
    return [...this.tracks.values()].map((track) => {
      const [lon, lat] = this.position(track, now);
      return { lon, lat, bearing: track.vehicle.bearing, mode: track.vehicle.mode, line: track.vehicle.line };
    });
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private position(track: Track, now: number): [number, number] {
    const t = Math.min(1, (now - track.start) / this.pace.glideMs);
    const { path, share } = track;
    if (path && share) {
      let i = 1;
      while (i < share.length - 1 && share[i] < t) i++;
      const part = (t - share[i - 1]) / (share[i] - share[i - 1] || 1);
      return [path[i - 1][0] + (path[i][0] - path[i - 1][0]) * part, path[i - 1][1] + (path[i][1] - path[i - 1][1]) * part];
    }
    return [
      track.fromLon + (track.vehicle.lon - track.fromLon) * t,
      track.fromLat + (track.vehicle.lat - track.fromLat) * t,
    ];
  }

  private draw(now: number) {
    if (this.map.isZooming() || this.paused()) return;
    this.lastFrame = now;
    const features: GeoJSON.Feature[] = [];
    for (const track of this.tracks.values()) {
      const { ref, line, mode, bearing, direction } = track.vehicle;
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: this.position(track, now) },
        
        properties: { ref, line, mode, bearing, dir: direction ?? -1, tag: tagId(mode, line) },
      });
    }
    setSource(this.map, 'vehicles', { type: 'FeatureCollection', features });
  }

  private frame = (now: number) => {
    if (now - this.lastFrame >= FRAME_MS) this.draw(now);
    let moving = false;
    for (const track of this.tracks.values()) {
      if (now - track.start < this.pace.glideMs) {
        moving = true;
        break;
      }
    }
    if (moving) {
      this.raf = requestAnimationFrame(this.frame);
    } else {
      this.draw(now);
      this.raf = 0;
    }
  };
}
