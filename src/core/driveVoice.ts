import type { CarRoute, Maneuver, RouteProgress } from './driving';

export type Cue = 'far' | 'near';

export interface Announcement {
  key: string;
  cue: Cue;
  maneuver: Maneuver;

  distance: number;
}

const MOTORWAY_MS = 22;
const MAIN_ROAD_MS = 14;

const NEAR_SECONDS = 7;
const NEAR_MIN_M = 70;

const GAP_M = 120;

export const farDistance = (speed: number) => (speed >= MOTORWAY_MS ? 1500 : speed >= MAIN_ROAD_MS ? 600 : 300);
export const nearDistance = (speed: number) => Math.max(NEAR_MIN_M, speed * NEAR_SECONDS);

export function roundForVoice(metres: number) {
  if (metres >= 1000) return Math.round(metres / 100) * 100;
  if (metres >= 300) return Math.round(metres / 50) * 50;
  return Math.max(50, Math.round(metres / 50) * 50);
}

export function nextAnnouncement(route: CarRoute, progress: RouteProgress, speed: number, said: Set<string>): Announcement | null {
  const index = progress.next;
  const maneuver = route.maneuvers[index];
  if (!maneuver) return null;
  const near = nearDistance(speed);
  const far = farDistance(speed);
  const nearKey = `${index}:near`;
  const farKey = `${index}:far`;
  if (progress.toNext <= near && !said.has(nearKey)) {
    return { key: nearKey, cue: 'near', maneuver, distance: roundForVoice(progress.toNext) };
  }
  if (progress.toNext <= far && progress.toNext > near + GAP_M && !said.has(farKey) && !said.has(nearKey)) {
    return { key: farKey, cue: 'far', maneuver, distance: roundForVoice(progress.toNext) };
  }
  return null;
}

export const lowerFirst = (text: string) => text.charAt(0).toLocaleLowerCase() + text.slice(1);
