import type { LatLon } from './types';

const MAX_RECENT = 8;

export interface RecentPlace extends LatLon {
  name: string;
  detail: string;
}

const samePlace = (a: RecentPlace, b: RecentPlace) => a.name === b.name && a.lat === b.lat && a.lon === b.lon;

export const withRecent = (recent: RecentPlace[], place: RecentPlace) =>
  [place, ...recent.filter((other) => !samePlace(other, place))].slice(0, MAX_RECENT);
