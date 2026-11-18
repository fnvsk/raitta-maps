export type Mode = 'bus' | 'tram' | 'metro' | 'train' | 'ferry';

export interface Line {
  id: string;
  name: string;
  mode: Mode;
}

export interface Stop {
  id: string;
  code: string;
  name: string;
  lat: number;
  lon: number;
  zone: string;
  city: string;
  lines: string[];
}

export interface Pattern {
  id: number;
  line: string;
  dir: number;
  headsign: string;
  shape: string;
  stops: string[];
  
  offsets: number[];
  trips: number;
}

export interface Service {
  days: string;
  start: number;
  end: number;
  add: number[];
  remove: number[];
}

export type Services = Record<string, Service>;

export interface TimetableGroup {
  line: string;
  headsign: string;
  services: string[];
  
  times: number[];
}

export interface OnwardCall {
  stopId: string;
  time: number;
  order: number;
}

export interface Vehicle {
  ref: string;
  line: string;
  mode: Mode;
  lat: number;
  lon: number;
  bearing: number;
  speedKmh: number;
  
  delaySec: number | null;
  destinationStop: string;
  
  direction?: number;
  headsign?: string;
  nextStop?: string;
  
  trip?: string;
  
  onward: OnwardCall[];
}

export interface ScheduledDeparture {
  line: string;
  headsign: string;
  time: number;
}

export interface Departure extends ScheduledDeparture {
  scheduled: number;
  live: boolean;
  delaySec: number;
  vehicleRef?: string;
}

export interface LatLon {
  lat: number;
  lon: number;
}
