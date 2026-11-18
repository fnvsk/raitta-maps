import { create } from 'zustand';
import type { Journey } from '@/core/raptor';
import type { LatLon } from '@/core/types';
import { cancelTripAlerts } from '@/trip/alerts';

export interface ActiveTrip {
  journey: Journey;
  origin: LatLon;
  destination: LatLon;
  destinationName: string;

  dayStart: number;
}

interface TripState {
  trip: ActiveTrip | null;

  step: number;

  passed: number[];
  start: (trip: ActiveTrip) => void;
  setStep: (step: number) => void;
  setPassed: (leg: number, index: number) => void;
  stop: () => void;
}

export const useTrip = create<TripState>((set) => ({
  trip: null,
  step: 0,
  passed: [],
  start: (trip) => set({ trip, step: 0, passed: trip.journey.legs.map(() => 0) }),
  setStep: (step) => set({ step }),
  setPassed: (leg, index) => set((s) => ({ passed: s.passed.map((value, i) => (i === leg ? Math.max(value, index) : value)) })),
  stop: () => {
    void cancelTripAlerts();
    set({ trip: null, step: 0, passed: [] });
  },
}));
