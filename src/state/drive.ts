import { create } from 'zustand';
import type { CarRoute } from '@/core/driving';
import type { LatLon } from '@/core/types';

export interface ActiveDrive {
  route: CarRoute;
  destination: LatLon;
  destinationName: string;
  startedAt: number;
  
  via?: LatLon[];
}

interface DriveState {
  drive: ActiveDrive | null;
  
  rerouting: boolean;
  arrived: boolean;
  start: (drive: Omit<ActiveDrive, 'startedAt'>) => void;
  
  reroute: (route: CarRoute) => void;
  setRerouting: (rerouting: boolean) => void;
  setArrived: () => void;
  
  passVia: () => void;
  stop: () => void;
}

export const useDrive = create<DriveState>((set) => ({
  drive: null,
  rerouting: false,
  arrived: false,
  start: (drive) => set({ drive: { ...drive, startedAt: Date.now() }, rerouting: false, arrived: false }),
  reroute: (route) => set((s) => (s.drive ? { drive: { ...s.drive, route }, rerouting: false } : s)),
  setRerouting: (rerouting) => set({ rerouting }),
  setArrived: () => set({ arrived: true }),
  passVia: () => set((s) => (s.drive?.via?.length ? { drive: { ...s.drive, via: s.drive.via.slice(1) } } : s)),
  stop: () => set({ drive: null, rerouting: false, arrived: false }),
}));
