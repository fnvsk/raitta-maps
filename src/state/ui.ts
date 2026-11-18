import type { AreaOutline } from '@/core/areas';
import { create } from 'zustand';
import type { Bounds } from '@/core/live';
import type { SiteState } from '@/core/charging';
import type { FuelStation } from '@/core/fuel';
import type { JourneyShape } from '@/core/journeyPath';
import type { StationPoint } from '@/core/longTrains';
import type { LatLon, Vehicle } from '@/core/types';

export type Snap = 'mini' | 'peek' | 'half' | 'full';

export interface MapFocus {
  stopId?: string;
  line?: string;

  patternId?: number;
  vehicleRef?: string;

  fuel?: FuelStation[];

  chargers?: ChargerPin[];

  place?: LatLon;

  carRoutes?: { paths: [number, number][][]; selected: number };

  carWalks?: [number, number][][];

  carStops?: LatLon[];

  drive?: boolean;

  roadEvents?: boolean;
  roadEventId?: string;

  walkPath?: [number, number][];

  journey?: JourneyShape;

  trains?: Vehicle[];
  stations?: StationPoint[];
}

export interface ChargerPin extends LatLon {
  id: string;
  state: SiteState;

  kw: number;
}

export interface FlyTarget extends LatLon {
  zoom: number;
}

export interface DriveCamera extends LatLon {
  bearing: number;
  zoom: number;
}

interface UiState {
  snap: Snap;

  sheetInset: number;
  focus: MapFocus;
  location: LatLon | null;
  locating: boolean;
  locationError: 'denied' | 'unavailable' | null;

  recenter: number;
  flyTarget: FlyTarget | null;
  viewport: Bounds | null;

  follow: boolean;

  headingUp: boolean;

  cityChosen: boolean;

  carPick: number;

  mapBearing: number;

  north: number;

  mapPress: (LatLon & { x: number; y: number }) | null;

  routeEnd: { role: 'from' | 'to'; name: string; point: LatLon } | null;

  trainQuery: string;
  driveCamera: DriveCamera | null;

  fitTarget: { bounds: [number, number, number, number]; key: number } | null;
  setSnap: (snap: Snap) => void;
  setSheetInset: (px: number) => void;
  setFocus: (focus: MapFocus) => void;
  setLocation: (location: LatLon | null) => void;
  setLocating: (locating: boolean) => void;
  setLocationError: (error: UiState['locationError']) => void;
  requestRecenter: () => void;
  flyTo: (target: FlyTarget) => void;
  setViewport: (viewport: Bounds) => void;
  setFollow: (follow: boolean) => void;
  setHeadingUp: (headingUp: boolean) => void;
  setCityChosen: () => void;
  setCarPick: (index: number) => void;
  setMapBearing: (bearing: number) => void;
  requestNorth: () => void;
  setMapPress: (press: UiState['mapPress']) => void;
  setRouteEnd: (end: UiState['routeEnd']) => void;
  setTrainQuery: (query: string) => void;
  setDriveCamera: (camera: DriveCamera | null) => void;
  fitTo: (bounds: [number, number, number, number]) => void;

  areaOutline: AreaOutline | null;
  setAreaOutline: (area: AreaOutline | null) => void;

  searchPins: SearchPin[] | null;
  setSearchPins: (pins: SearchPin[] | null) => void;

  pickedPin: { id: string; key: number } | null;
  pickPin: (id: string) => void;
}

export interface SearchPin {
  id: string;
  name: string;
  lat: number;
  lon: number;

  icon?: string;
}

export const useUi = create<UiState>((set) => ({
  snap: 'peek',
  sheetInset: 0,
  focus: {},
  location: null,
  locating: false,
  locationError: null,
  recenter: 0,
  flyTarget: null,
  viewport: null,
  follow: false,
  headingUp: false,
  cityChosen: false,
  carPick: 0,
  mapBearing: 0,
  north: 0,
  mapPress: null,
  routeEnd: null,
  trainQuery: '',
  driveCamera: null,
  fitTarget: null,
  setSnap: (snap) => set({ snap }),
  setSheetInset: (sheetInset) => set({ sheetInset }),
  setFocus: (focus) => set({ focus }),
  setLocation: (location) => set({ location, locationError: null }),
  setLocating: (locating) => set({ locating }),
  setLocationError: (locationError) => set({ locationError, locating: false }),
  requestRecenter: () => set((s) => ({ recenter: s.recenter + 1 })),
  flyTo: (flyTarget) => set({ flyTarget }),
  setViewport: (viewport) => set({ viewport }),
  setFollow: (follow) => set({ follow }),
  setHeadingUp: (headingUp) => set({ headingUp }),
  setCityChosen: () => set({ cityChosen: true }),
  setCarPick: (carPick) => set({ carPick }),
  setMapBearing: (mapBearing) => set({ mapBearing }),
  requestNorth: () => set((s) => ({ north: s.north + 1 })),
  setMapPress: (mapPress) => set({ mapPress }),
  setRouteEnd: (routeEnd) => set({ routeEnd }),
  setTrainQuery: (trainQuery) => set({ trainQuery }),
  setDriveCamera: (driveCamera) => set({ driveCamera }),
  fitTo: (bounds) => set((s) => ({ fitTarget: { bounds, key: (s.fitTarget?.key ?? 0) + 1 } })),
  areaOutline: null,
  setAreaOutline: (areaOutline) => set({ areaOutline }),
  searchPins: null,
  setSearchPins: (searchPins) => set({ searchPins }),
  pickedPin: null,
  pickPin: (id) => set((s) => ({ pickedPin: { id, key: (s.pickedPin?.key ?? 0) + 1 } })),
}));
