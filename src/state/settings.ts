import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { NO_FILTER, type ChargerFilter } from '@/core/charging';
import type { WalkingPace } from '@/core/raptor';
import { withRecent, type RecentPlace } from '@/core/recent';
import { DEFAULT_REGION } from '@/core/regions';
import type { Language } from '@/i18n';

export type ThemeSetting = 'system' | 'light' | 'dark';
export type Travel = 'car' | 'transit' | 'walk';

export interface MapLayers {
  buses: boolean;
  rail: boolean;
  stops: boolean;
  places: boolean;
  buildings3d: boolean;
}

type Favorites = Record<string, string[]>;

export interface FavoritePlace {
  path: string;
  name: string;
  lat: number;
  lon: number;
  
  kind?: string;
}

export const placeKey = (path: string) => path.split('?')[0];

interface SettingsState {
  onboarded: boolean;
  
  language: Language | null;
  theme: ThemeSetting;
  region: string;
  layers: MapLayers;
  
  favoriteStops: Favorites;
  favoriteLines: Favorites;
  favoritePlaces: FavoritePlace[];
  
  recentPlaces: RecentPlace[];
  saveHistory: boolean;
  walkingPace: WalkingPace;
  
  locationAllowed: boolean;
  
  hiddenLines: Favorites;
  
  chargerFilter: ChargerFilter;
  
  energy: 'fuel' | 'charging';
  
  travel: Travel;
  
  driveVoice: boolean;
  
  noLocation: boolean;
  setOnboarded: () => void;
  setLanguage: (language: Language) => void;
  setTheme: (theme: ThemeSetting) => void;
  setRegion: (region: string) => void;
  toggleLayer: (layer: keyof MapLayers) => void;
  toggleFavoriteStop: (id: string) => void;
  toggleFavoriteLine: (id: string) => void;
  toggleFavoritePlace: (place: FavoritePlace) => void;
  rememberPlace: (place: RecentPlace) => void;
  forgetPlaces: () => void;
  setSaveHistory: (saveHistory: boolean) => void;
  setWalkingPace: (walkingPace: WalkingPace) => void;
  setLocationAllowed: (locationAllowed: boolean) => void;
  setHiddenLines: (region: string, lines: string[]) => void;
  setChargerFilter: (filter: ChargerFilter) => void;
  setEnergy: (energy: 'fuel' | 'charging') => void;
  setTravel: (travel: Travel) => void;
  setDriveVoice: (driveVoice: boolean) => void;
  setNoLocation: (noLocation: boolean) => void;
}

const toggled = (favorites: Favorites, region: string, id: string): Favorites => {
  const list = favorites[region] ?? [];
  return { ...favorites, [region]: list.includes(id) ? list.filter((x) => x !== id) : [...list, id] };
};

const DEFAULT_LAYERS: MapLayers = { buses: true, rail: true, stops: true, places: true, buildings3d: false };

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      onboarded: false,
      language: null,
      theme: 'system',
      region: DEFAULT_REGION,
      layers: DEFAULT_LAYERS,
      favoriteStops: {},
      favoriteLines: {},
      favoritePlaces: [],
      recentPlaces: [],
      saveHistory: true,
      walkingPace: 'normal',
      locationAllowed: false,
      hiddenLines: {},
      chargerFilter: NO_FILTER,
      energy: 'fuel',
      travel: 'transit',
      driveVoice: true,
      noLocation: false,
      setOnboarded: () => set({ onboarded: true }),
      setLanguage: (language) => set({ language }),
      setTheme: (theme) => set({ theme }),
      setRegion: (region) => set({ region }),
      toggleLayer: (layer) => set((s) => ({ layers: { ...s.layers, [layer]: !s.layers[layer] } })),
      toggleFavoriteStop: (id) => set((s) => ({ favoriteStops: toggled(s.favoriteStops, s.region, id) })),
      toggleFavoriteLine: (id) => set((s) => ({ favoriteLines: toggled(s.favoriteLines, s.region, id) })),
      toggleFavoritePlace: (place) =>
        set((s) => {
          const key = placeKey(place.path);
          const kept = s.favoritePlaces.filter((item) => placeKey(item.path) !== key);
          return { favoritePlaces: kept.length < s.favoritePlaces.length ? kept : [place, ...kept] };
        }),
      rememberPlace: (place) => set((s) => (s.saveHistory ? { recentPlaces: withRecent(s.recentPlaces, place) } : s)),
      forgetPlaces: () => set({ recentPlaces: [] }),
      setSaveHistory: (saveHistory) => set((s) => ({ saveHistory, recentPlaces: saveHistory ? s.recentPlaces : [] })),
      setWalkingPace: (walkingPace) => set({ walkingPace }),
      setLocationAllowed: (locationAllowed) => set({ locationAllowed }),
      setHiddenLines: (region, lines) => set((s) => ({ hiddenLines: { ...s.hiddenLines, [region]: lines } })),
      setChargerFilter: (chargerFilter) => set({ chargerFilter }),
      setEnergy: (energy) => set({ energy }),
      setTravel: (travel) => set({ travel }),
      setDriveVoice: (driveVoice) => set({ driveVoice }),
      setNoLocation: (noLocation) => set({ noLocation }),
    }),
    {
      name: 'raita-settings',
      version: 2,
      migrate: (stored, version) => {
        if (version >= 2) return stored as SettingsState;
        
        const old = stored as Omit<SettingsState, 'favoriteStops' | 'favoriteLines'> & {
          favoriteStops?: string[];
          favoriteLines?: string[];
        };
        return {
          ...old,
          region: DEFAULT_REGION,
          layers: DEFAULT_LAYERS,
          favoriteStops: { [DEFAULT_REGION]: old.favoriteStops ?? [] },
          favoriteLines: { [DEFAULT_REGION]: old.favoriteLines ?? [] },
        } as SettingsState;
      },
    },
  ),
);
