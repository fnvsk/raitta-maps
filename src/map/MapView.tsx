import {
  LngLatBounds,
  Map as MapLibre,
  Marker,
  setWorkerUrl,
  type ExpressionSpecification,
  type FilterSpecification,
  type Point,
  type PointLike,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { Mode, Stop, Vehicle } from '@/core/types';
import { useAllShapes, useExtraPlaces, useLandmarks, useRoadReports, useSpeedCameras, useLineIndex, usePatterns, useRail, useRegion, useRoadEvents, useShapes, useStopIndex, useStops, useVehicles } from '@/data/hooks';
import { useSettings } from '@/state/settings';
import { useUi, type DriveCamera } from '@/state/ui';
import { blendBearing } from '@/core/driving';
import { compassHeading, watchCompass } from './compass';
import { useIsDesktop, useResolvedTheme } from '@/theme';
import { addAppLayers, MODE_COLORS, setSource, setWideView, SIGHT_ZOOMS } from './layers';
import { buildStyle } from './style';
import { installPinchZoom } from './pinchZoom';
import { provideVehicleIcon } from './vehicleIcons';
import { railSnapper } from './railSnap';
import { eventRank, signPoint } from '@/core/roadEvents';
import { inLanguage, osmOfFeature } from '@/core/landmarks';
import { fetchAreaOutline } from '@/core/areas';
import { AIRPORTS } from '@/core/airports';
import { CITY_PACE, TRAIN_PACE, VehicleAnimator } from './VehicleAnimator';

setWorkerUrl(workerUrl);

const DESKTOP_PANEL_INSET = 430;
const FOCUS_ZOOM = 15.6;
const FOLLOW_ZOOM = 16;

const HEADING_EASE = 0.18;
const FOLLOW_EASE = 0.12;

const FINLAND_BOUNDS: [number, number, number, number] = [18.5, 58.8, 32.5, 70.6];

const TRAINS_BOUNDS: [number, number, number, number] = [14, 53, 37, 71.5];
const TAP_TOLERANCE_PX = 12;
const INTERACTIVE = ['airports', 'airports-minor', 'search-pins', 'fuel-pins', 'charger-pins', 'road-signs', 'road-signs-minor', 'vehicles', 'favorite-places', 'landmarks', 'landmarks-mid', 'landmarks-near', 'route-stops-dot', 'stops-dot', 'car-alt-line', 'poi-brands', 'poi', 'poi-extra', 'place-label'];

const DETAIL_PAGE = /\/(place|fuel|charging|road|airport|stops|vehicle|trains\/station)\//;
const OSM_LETTERS = { n: 'node', w: 'way', r: 'relation' } as const;

const PLACES_VIEW_DEG = 0.15;
const PINS = ['airports', 'airports-minor', 'search-pins', 'fuel-pins', 'charger-pins', 'road-signs', 'road-signs-minor', 'vehicles', 'favorite-places', 'landmarks', 'landmarks-mid', 'landmarks-near'];
const PITCH_3D = 58;

const CITY_MARGIN_LAT = 0.12;
const CITY_MARGIN_LON = 0.25;

const MIN_ROUTE_VIEW_PX = 120;

const CITY_OFF_LINE_M = 60;
const DRIVE_PITCH = 52;

const GLIDE_MIN_MS = 300;
const GLIDE_MAX_MS = 1600;

function mixCamera(a: DriveCamera, b: DriveCamera, t: number): DriveCamera {
  const turn = ((b.bearing - a.bearing + 540) % 360) - 180;
  return {
    lat: a.lat + (b.lat - a.lat) * t,
    lon: a.lon + (b.lon - a.lon) * t,
    zoom: a.zoom + (b.zoom - a.zoom) * t,
    bearing: (a.bearing + turn * t + 360) % 360,
  };
}

const LONG_PRESS_MS = 600;
const PRESS_SLOP_PX = 10;
const DOUBLE_TAP_MS = 320;
const DOUBLE_TAP_SLOP_PX = 28;

const DRIVE_CAR_LOW = 0.35;

type Padding = { top: number; bottom: number; left: number; right: number };

const MIN_FIT_PX = 140;

function fitWithin(map: MapLibre, bounds: LngLatBounds, padding: Padding, options: { duration: number; maxZoom: number }) {
  const current = map.getPadding();
  const extra = (side: keyof Padding) => Math.max(0, padding[side] - (current[side] ?? 0));
  const pad = { top: extra('top'), bottom: extra('bottom'), left: extra('left'), right: extra('right') };

  const { clientWidth: width, clientHeight: height } = map.getContainer();
  const free = (size: number, a: number, b: number) => (size - a - b < MIN_FIT_PX ? Math.max(0, size - MIN_FIT_PX) / Math.max(1, a + b) : 1);
  const v = free(height - (current.top ?? 0) - (current.bottom ?? 0), pad.top, pad.bottom);
  const h = free(width - (current.left ?? 0) - (current.right ?? 0), pad.left, pad.right);
  map.fitBounds(bounds, { ...options, padding: { top: pad.top * v, bottom: pad.bottom * v, left: pad.left * h, right: pad.right * h } });
}
const FITTED_STATIONS = 6;
const RAIL_MODES: Mode[] = ['tram', 'metro', 'train', 'ferry'];

const MODEL_ZOOM = 14.5;
const MODEL_LAYER = 'raita-models';

export function primaryMode(stop: Stop, lineMode: (line: string) => Mode | undefined): Mode {
  const modes = stop.lines.map(lineMode);
  return RAIL_MODES.find((mode) => modes.includes(mode)) ?? 'bus';
}

export function MapView() {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibre | null>(null);
  const animator = useRef<VehicleAnimator | null>(null);
  const [styleVersion, setStyleVersion] = useState(0);

  const styleReady = useRef(false);
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  const { i18n } = useTranslation();

  const dark = useResolvedTheme() === 'dark';
  const styleKey = `${dark}-${i18n.language}`;
  const themeRef = useRef({ dark, language: i18n.language, key: styleKey });
  const desktop = useIsDesktop();
  const region = useRegion();
  const { data: stops } = useStops();
  const stopIndex = useStopIndex();
  const lineIndex = useLineIndex();
  const { data: patterns } = usePatterns();
  const { data: vehicles } = useVehicles();
  const layers = useSettings((s) => s.layers);
  const hiddenLines = useSettings((s) => s.hiddenLines[region.id]);
  const focus = useUi((s) => s.focus);

  const trainsMode = !!focus.trains;

  const searchShown = useUi((s) => !!s.searchPins?.length);
  const wasTrainsMode = useRef(false);
  const sheetInset = useUi((s) => s.sheetInset);
  const location = useUi((s) => s.location);
  const recenter = useUi((s) => s.recenter);
  const flyTarget = useUi((s) => s.flyTarget);
  const { data: shapes } = useShapes(focus.line);

  const padding = useMemo(
    () =>
      desktop
        ? { top: 60, bottom: 60, left: DESKTOP_PANEL_INSET, right: 60 }
        : { top: 90, bottom: sheetInset + 24, left: 36, right: 36 },
    [desktop, sheetInset],
  );
  const paddingRef = useRef(padding);
  paddingRef.current = padding;

  useEffect(() => {
    const map = new MapLibre({
      container: container.current!,
      style: buildStyle(themeRef.current.dark, themeRef.current.language),
      center: [region.center.lon, region.center.lat],
      zoom: 13.2,
      minZoom: 4,
      maxZoom: 19.5,
      maxBounds: FINLAND_BOUNDS,
      maxPitch: 70,
      attributionControl: { compact: true },
      fadeDuration: 0,
    });
    mapRef.current = map;

    map.touchZoomRotate.disable();
    map.touchPitch.disable();

    const stopFollowing = () => {
      if (useUi.getState().follow) useUi.getState().setFollow(false);
    };
    const pinch = installPinchZoom(map, () => true, stopFollowing);

    map.on('rotate', () => {
      const bearing = Math.round(map.getBearing());
      if (bearing !== useUi.getState().mapBearing) useUi.getState().setMapBearing(bearing);
    });

    map.on('rotatestart', (e) => {
      if (e.originalEvent) stopFollowing();
    });
    animator.current = new VehicleAnimator(map, pinch.isActive);

    if (import.meta.env.DEV) (window as unknown as { raittaMap?: MapLibre }).raittaMap = map;
    map.on('style.load', () => {
      addAppLayers(map, themeRef.current.dark);
      styleReady.current = true;
      setStyleVersion((v) => v + 1);
    });

    map.setMissingStyleImageResolver((id) => provideVehicleIcon(map, id));

    const onVisibility = () => {
      if (document.hidden) animator.current?.reset();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onVisibility);

    const hitTest = (point: Point) => {
      const box: [PointLike, PointLike] = [
        [point.x - TAP_TOLERANCE_PX, point.y - TAP_TOLERANCE_PX],
        [point.x + TAP_TOLERANCE_PX, point.y + TAP_TOLERANCE_PX],
      ];
      const hits = map.queryRenderedFeatures(box, { layers: INTERACTIVE.filter((id) => map.getLayer(id)) });
      return hits.find((f) => PINS.includes(f.layer.id)) ?? hits[0];
    };

    let pressTimer: ReturnType<typeof setTimeout> | null = null;
    let pressStart: { x: number; y: number } | null = null;
    let pressed = false;
    const cancelPress = () => {
      if (pressTimer) clearTimeout(pressTimer);
      pressTimer = null;
      pressStart = null;
    };
    const canvas = map.getCanvasContainer();
    const openMenu = (x: number, y: number) => {
      if (useUi.getState().focus.drive) return;
      const box = canvas.getBoundingClientRect();
      const at = map.unproject([x - box.left, y - box.top]);
      pressed = true;

      setTimeout(() => (pressed = false), 1500);
      useUi.getState().setMapPress({ lat: at.lat, lon: at.lng, x, y });
      navigator.vibrate?.(15);
    };
    canvas.addEventListener('pointerdown', (e) => {
      cancelPress();
      if (!e.isPrimary || e.button !== 0) return;
      pressStart = { x: e.clientX, y: e.clientY };
      pressTimer = setTimeout(() => {
        if (pressStart) openMenu(pressStart.x, pressStart.y);
        cancelPress();
      }, LONG_PRESS_MS);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (pressStart && Math.hypot(e.clientX - pressStart.x, e.clientY - pressStart.y) > PRESS_SLOP_PX) cancelPress();
    });
    for (const type of ['pointerup', 'pointercancel', 'touchstart'] as const)
      canvas.addEventListener(type, (e) => {
        if (type !== 'touchstart' || (e as TouchEvent).touches.length > 1) cancelPress();
      });

    map.doubleClickZoom.disable();
    let lastTap: { x: number; y: number; time: number } | null = null;
    canvas.addEventListener('pointerup', (e) => {
      if (!e.isPrimary || e.button !== 0) return;
      const now = e.timeStamp;
      if (lastTap && now - lastTap.time < DOUBLE_TAP_MS && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < DOUBLE_TAP_SLOP_PX) {
        lastTap = null;
        openMenu(e.clientX, e.clientY);
        return;
      }
      lastTap = { x: e.clientX, y: e.clientY, time: now };
    });
    map.on('contextmenu', (e) => {
      const box = canvas.getBoundingClientRect();
      openMenu(e.point.x + box.left, e.point.y + box.top);
    });

    map.on('click', (e) => {
      if (pressed) {
        pressed = false;
        return;
      }
      const hit = hitTest(e.point);
      if (!hit) {
        if (useUi.getState().areaOutline) useUi.getState().setAreaOutline(null);
        return;
      }
      if (hit.layer.id === 'place-label') {
        const name = String(hit.properties[`name:${themeRef.current.language}`] ?? hit.properties.name ?? '');
        const [lon, lat] = (hit.geometry as GeoJSON.Point).coordinates;
        if (name) {
          void fetchAreaOutline(String(hit.properties.name ?? name), { lat, lon })
            .then((area) => {
              if (!area) return;
              useUi.getState().setAreaOutline({ ...area, name });
              useUi.getState().fitTo(area.bbox);
            })
            .catch(() => {});
        }
        return;
      }
      const openDetail = (path: string) => navigateRef.current(path, { replace: DETAIL_PAGE.test(window.location.pathname) });
      if (hit.layer.id === 'fuel-pins') openDetail(`/fuel/${encodeURIComponent(hit.properties.id)}`);
      else if (hit.layer.id === 'charger-pins') openDetail(`/charging/${encodeURIComponent(hit.properties.id)}`);
      else if (hit.layer.id.startsWith('road-signs')) openDetail(`/road/${encodeURIComponent(hit.properties.id)}`);
      else if (hit.layer.id === 'car-alt-line') useUi.getState().setCarPick(Number(hit.properties.index));
      else if (hit.layer.id.startsWith('airports')) openDetail(`/airport/${hit.properties.iata}`);
      else if (hit.layer.id === 'search-pins') useUi.getState().pickPin(String(hit.properties.id));
      else if (hit.layer.id === 'favorite-places') openDetail(String(hit.properties.path));
      else if (hit.layer.id.startsWith('landmarks')) openDetail(`/place/wd/${hit.properties.id}`);
      else if (hit.layer.id === 'poi-extra') {
        const osm = String(hit.properties.osm ?? '');
        const type = OSM_LETTERS[osm[0] as keyof typeof OSM_LETTERS];
        const at = (hit.geometry as GeoJSON.Point).coordinates;
        if (type) openDetail(`/place/osm/${type}/${osm.slice(1)}?${new URLSearchParams({ name: String(hit.properties.name ?? ''), cls: String(hit.properties.class ?? ''), sub: String(hit.properties.subclass ?? ''), lat: String(at[1]), lon: String(at[0]) })}`);
      }
      else if (hit.layer.id === 'poi' || hit.layer.id === 'poi-brands') {
        const osm = osmOfFeature(Number(hit.id));
        const at = (hit.geometry as GeoJSON.Point).coordinates;
        const name = String(hit.properties[`name:${themeRef.current.language}`] ?? hit.properties.name ?? '');
        if (osm) openDetail(`/place/osm/${osm.type}/${osm.id}?${new URLSearchParams({ name, cls: String(hit.properties.class ?? ''), sub: String(hit.properties.subclass ?? ''), lat: String(at[1]), lon: String(at[0]) })}`);
      }
      else if (hit.layer.id === 'vehicles') {
        const ref = String(hit.properties.ref);
        openDetail(ref.startsWith('train:') ? `/trains/${ref.slice('train:'.length)}` : `/vehicle/${encodeURIComponent(ref)}`);
      } else {
        const id = String(hit.properties.id);
        openDetail(id.startsWith('station:') ? `/trains/station/${id.slice('station:'.length)}` : `/stops/${id}`);
      }
    });
    map.on('mousemove', (e) => {
      map.getCanvas().style.cursor = hitTest(e.point) ? 'pointer' : '';
    });

    const onViewChange = () => {
      if (pinch.isActive()) return;
      const bounds = map.getBounds();
      const ui = useUi.getState();
      ui.setViewport({ west: bounds.getWest(), south: bounds.getSouth(), east: bounds.getEast(), north: bounds.getNorth() });
    };
    map.on('moveend', onViewChange);

    map.on('dragstart', () => {
      if (useUi.getState().follow) useUi.getState().setFollow(false);
    });
    map.on('zoomend', () => animator.current?.redraw());
    map.on('load', onViewChange);

    const resize = new ResizeObserver(() => map.resize());
    resize.observe(container.current!);
    return () => {
      resize.disconnect();
      pinch.remove();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onVisibility);
      animator.current?.dispose();
      map.remove();
      mapRef.current = null;
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const opened = useRef(false);
  const savedCenter = region.info?.center;
  useEffect(() => {
    if (!savedCenter || opened.current) return;
    opened.current = true;

    if (Object.keys(useUi.getState().focus).length) return;
    mapRef.current?.jumpTo({ center: [savedCenter.lon, savedCenter.lat] });
  }, [savedCenter]);

  const bbox = region.info?.bbox;

  const roaming = !!focus.carRoutes || !!focus.walkPath || !!focus.drive || !!focus.journey;
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (trainsMode || roaming) {
      wasTrainsMode.current = true;
      return void map.setMaxBounds(trainsMode ? TRAINS_BOUNDS : FINLAND_BOUNDS);
    }
    if (!bbox) return;
    const [west, south, east, north] = bbox;
    map.setMaxBounds([
      [west - CITY_MARGIN_LON, south - CITY_MARGIN_LAT],
      [east + CITY_MARGIN_LON, north + CITY_MARGIN_LAT],
    ]);

    const back = useUi.getState().flyTarget;
    if (wasTrainsMode.current && back) flyWithin(back.lat, back.lon, back.zoom, 900);
    wasTrainsMode.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bbox?.join(), trainsMode, roaming]);

  useEffect(() => {
    const map = mapRef.current;
    if (map && styleVersion && styleReady.current) setWideView(map, trainsMode);
  }, [trainsMode, styleVersion]);

  useEffect(() => {
    if (themeRef.current.key === styleKey) return;
    themeRef.current = { dark, language: i18n.language, key: styleKey };
    styleReady.current = false;
    mapRef.current?.setStyle(buildStyle(dark, i18n.language), { diff: false });
  }, [styleKey, dark, i18n.language]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleVersion || !styleReady.current) return;
    if (focus.stations) {
      setSource(map, 'stops', {
        type: 'FeatureCollection',
        features: focus.stations.map((station) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [station.lon, station.lat] },
          properties: { id: `station:${station.code}`, name: station.name, color: MODE_COLORS.train, icon: 'stop|train', rank: 0 },
        })),
      });
      return;
    }
    if (!stops || !lineIndex.size) return;
    const lineMode = (line: string) => lineIndex.get(line)?.mode;
    setSource(map, 'stops', {
      type: 'FeatureCollection',
      features: stops.map((s) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
        properties: (() => {
          const mode = primaryMode(s, lineMode);
          return { id: s.id, name: s.name, color: MODE_COLORS[mode], icon: `stop|${mode}`, rank: mode === 'bus' ? 1 : 0 };
        })(),
      })),
    });
  }, [stops, lineIndex, styleVersion, focus.stations]);

  const shownVehicles = focus.trains ?? vehicles;

  const { data: rail } = useRail(trainsMode);
  const trainPace = useMemo(
    () => (rail ? { ...TRAIN_PACE, along: railSnapper(Object.values(rail.segments)) } : TRAIN_PACE),
    [rail],
  );
  const cityShapes = useAllShapes(!trainsMode);
  const cityPace = useMemo(() => {
    if (!cityShapes) return CITY_PACE;
    const byLine = new Map<string, ReturnType<typeof railSnapper> | null>();
    return {
      ...CITY_PACE,
      along: (from: [number, number], to: [number, number], vehicle: Vehicle) => {
        let snap = byLine.get(vehicle.line);
        if (snap === undefined) {
          const shapes = cityShapes[vehicle.line];
          snap = shapes ? railSnapper(Object.values(shapes), CITY_OFF_LINE_M) : null;
          byLine.set(vehicle.line, snap);
        }
        return snap ? snap(from, to) : null;
      },
    };
  }, [cityShapes]);
  useEffect(() => {
    if (shownVehicles && styleVersion && styleReady.current) animator.current?.update(shownVehicles, trainsMode ? trainPace : cityPace);
  }, [shownVehicles, styleVersion, trainsMode, trainPace, cityPace]);

  const linePatterns = useMemo(() => {
    if (!focus.line || !patterns) return [];
    const ofLine = patterns.filter((p) => p.line === focus.line);
    if (focus.patternId === undefined) return ofLine;
    return ofLine.filter((p) => p.id === focus.patternId);
  }, [focus.line, focus.patternId, patterns]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleVersion || !styleReady.current) return;

    const driving = !!focus.fuel || !!focus.chargers || !!focus.roadEvents || !!focus.carRoutes || (!!focus.walkPath && !focus.journey) || searchShown;
    const active = !!focus.line || !!focus.journey || driving;
    const stationsShown = trainsMode && !focus.journey;
    const stopVisibility = stationsShown || (layers.stops && !active && !trainsMode) ? 'visible' : 'none';
    map.setLayoutProperty('stops-dot', 'visibility', stopVisibility);
    map.setLayoutProperty('stops-label', 'visibility', stopVisibility);
    for (const id of ['poi', 'poi-brands', 'poi-extra']) map.setLayoutProperty(id, 'visibility', layers.places && !searchShown ? 'visible' : 'none');

    const vehiclesShown = !driving && !trainsMode && (layers.buses || layers.rail) && !focus.place;
    const zooms = vehiclesShown ? SIGHT_ZOOMS.busy : SIGHT_ZOOMS.calm;
    ['landmarks', 'landmarks-mid', 'landmarks-near'].forEach((id, tier) => map.setLayerZoomRange(id, zooms[tier], 24));

    for (const id of ['poi', 'poi-brands', 'poi-extra']) map.setLayerZoomRange(id, vehiclesShown ? 15.6 : 14, 24);
    const buildingVisibility = layers.buildings3d ? 'visible' : 'none';
    map.setLayoutProperty('building-walls', 'visibility', buildingVisibility);
    map.setLayoutProperty('building-roof', 'visibility', buildingVisibility);

    const hiddenModes = trainsMode ? [] : [...(layers.buses && !driving ? [] : ['bus']), ...(layers.rail && !driving ? [] : RAIL_MODES)];

    const shownLines = focus.journey?.lines ?? (focus.line ? [focus.line] : null);

    const directions = focus.journey?.directions ?? {};
    const onTheWay: FilterSpecification = [
      'any',
      ...(shownLines ?? []).map(
        (line): ExpressionSpecification =>
          directions[line] === undefined
            ? ['==', ['get', 'line'], line]
            : ['all', ['==', ['get', 'line'], line], ['any', ['==', ['get', 'dir'], -1], ['==', ['get', 'dir'], directions[line]]]],
      ),
    ];
    const visibleVehicle: FilterSpecification = [
      'all',
      ['!', ['in', ['get', 'mode'], ['literal', hiddenModes]]],
      shownLines
        ? focus.journey
          ? onTheWay
          : ['in', ['get', 'line'], ['literal', shownLines]]
        : ['!', ['in', ['get', 'line'], ['literal', trainsMode ? [] : (hiddenLines ?? [])]]],
    ];
    for (const layer of ['vehicle-heading', 'vehicles', 'vehicle-label']) map.setFilter(layer, visibleVehicle);

    const dimmed = 1;

    const modelled = layers.buildings3d;
    const pinOpacity = modelled ? (['step', ['zoom'], dimmed, MODEL_ZOOM, 0] as ExpressionSpecification) : dimmed;
    map.setPaintProperty('vehicle-heading', 'icon-opacity', pinOpacity);
    map.setPaintProperty('vehicles', 'icon-opacity', pinOpacity);
    map.setPaintProperty('vehicle-label', 'icon-opacity', dimmed);
    map.setPaintProperty(
      'vehicle-label',
      'icon-translate',
      modelled ? ['step', ['zoom'], ['literal', [0, 0]], MODEL_ZOOM, ['literal', [-34, -36]]] : [0, 0],
    );
    map.setFilter('vehicle-selected', ['==', ['get', 'ref'], focus.vehicleRef ?? '']);
    map.setFilter('stop-selected', ['==', ['get', 'id'], focus.stopId ?? '']);

    setSource(map, 'fuel', {
      type: 'FeatureCollection',
      features: (focus.fuel ?? []).map((station) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [station.lon, station.lat] },
        properties: { id: station.id },
      })),
    });
    const chargers = focus.chargers ?? [];
    setSource(map, 'chargers', {
      type: 'FeatureCollection',
      features: chargers.map((charger, index) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [charger.lon, charger.lat] },

        properties: { id: charger.id, state: charger.state, kw: charger.kw, rank: chargers.length - index },
      })),
    });
  }, [focus, layers, hiddenLines, styleVersion, searchShown]);

  const { data: landmarks } = useLandmarks();
  const favoritePlaces = useSettings((s) => s.favoritePlaces);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleVersion || !styleReady.current) return;
    setSource(map, 'landmarks', {
      type: 'FeatureCollection',
      features: Object.values(landmarks ?? {}).flatMap((city) =>
        city.map((sight, rank) => ({
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [sight.lon, sight.lat] },
          properties: { id: sight.id, name: inLanguage(sight.name, themeRef.current.language), rank },
        })),
      ),
    });

    const placesShown = layers.places && !searchShown;
    for (const id of ['landmarks', 'landmarks-mid', 'landmarks-near', 'favorite-places']) map.setLayoutProperty(id, 'visibility', placesShown ? 'visible' : 'none');
    setSource(map, 'favorite-places', {
      type: 'FeatureCollection',
      features: favoritePlaces.map((place) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [place.lon, place.lat] },
        properties: { path: place.path, name: place.name },
      })),
    });
    setSource(map, 'place', {
      type: 'FeatureCollection',
      features: focus.place ? [{ type: 'Feature', geometry: { type: 'Point', coordinates: [focus.place.lon, focus.place.lat] }, properties: {} }] : [],
    });
  }, [landmarks, favoritePlaces, layers.places, focus.place, styleVersion, i18n.language, searchShown]);

  const { data: roadEvents } = useRoadEvents(!!focus.roadEvents);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleVersion || !styleReady.current) return;
    const events = focus.roadEvents ? (roadEvents?.events ?? []) : [];
    const props = (event: (typeof events)[number]) => ({ id: event.id, kind: event.kind, idle: event.now === false, rank: eventRank(event) });
    setSource(map, 'road-lines', {
      type: 'FeatureCollection',
      features: events
        .filter((event) => event.lines?.length && !event.rough)
        .map((event) => ({ type: 'Feature', geometry: { type: 'MultiLineString', coordinates: event.lines! }, properties: props(event) })),
    });
    setSource(map, 'road-signs', {
      type: 'FeatureCollection',
      features: events.flatMap((event) => {
        const point = signPoint(event);
        return point ? [{ type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: point }, properties: props(event) }] : [];
      }),
    });
    map.setFilter('road-sign-selected', ['==', ['get', 'id'], focus.roadEventId ?? '']);
  }, [roadEvents, focus.roadEvents, focus.roadEventId, styleVersion]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleVersion || !styleReady.current) return;
    setSource(map, 'airports', {
      type: 'FeatureCollection',
      features: AIRPORTS.map((airport) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [airport.lon, airport.lat] },
        properties: { iata: airport.iata, name: airport.name, major: !!airport.major },
      })),
    });
  }, [styleVersion]);

  const carStops = focus.carStops;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleVersion || !styleReady.current) return;
    setSource(map, 'car-stops', {
      type: 'FeatureCollection',
      features: (carStops ?? []).map((stop, index) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [stop.lon, stop.lat] }, properties: { n: String(index + 1) } })),
    });
  }, [carStops, styleVersion]);

  const areaOutline = useUi((s) => s.areaOutline);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleVersion || !styleReady.current) return;
    setSource(map, 'area-outline', {
      type: 'FeatureCollection',
      features: areaOutline ? [{ type: 'Feature', geometry: areaOutline.geometry, properties: {} }] : [],
    });
  }, [areaOutline, styleVersion]);

  const searchPins = useUi((s) => s.searchPins);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleVersion || !styleReady.current) return;
    setSource(map, 'search-pins', {
      type: 'FeatureCollection',
      features: (searchPins ?? []).map((pin, rank) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [pin.lon, pin.lat] },
        properties: { id: pin.id, name: pin.name, rank, icon: pin.icon ?? 'search-pin' },
      })),
    });
  }, [searchPins, styleVersion]);

  const { data: cameras } = useSpeedCameras(!!focus.roadEvents);
  const { data: reports } = useRoadReports(!!focus.roadEvents);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleVersion || !styleReady.current) return;
    const point = (lon: number, lat: number, properties: Record<string, unknown>) => ({ type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [lon, lat] }, properties });
    setSource(map, 'driver-reports', {
      type: 'FeatureCollection',
      features: focus.roadEvents
        ? [
            ...(cameras ?? []).map(([lon, lat, limit]) => point(lon, lat, { kind: 'camera', fixed: true, limit: limit ? String(limit) : '' })),
            ...(reports ?? []).map((report) => point(report.lon, report.lat, { kind: report.kind, fixed: false, limit: '' })),
          ]
        : [],
    });
  }, [cameras, reports, focus.roadEvents, styleVersion]);

  const carRoutes = focus.carRoutes;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleVersion || !styleReady.current) return;
    setSource(map, 'car-routes', {
      type: 'FeatureCollection',

      features: (carRoutes?.paths ?? [])
        .map((coordinates, index) => ({
          type: 'Feature' as const,
          geometry: { type: 'LineString' as const, coordinates },
          properties: { index, selected: index === carRoutes!.selected },
        }))
        .sort((a, b) => Number(a.properties.selected) - Number(b.properties.selected)),
    });
  }, [carRoutes, styleVersion]);

  const walkPath = focus.walkPath;
  const journey = focus.journey;
  const fittedRoute = useRef('');
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleVersion || !styleReady.current) return;
    const walks = [...(journey?.walks ?? (walkPath ? [walkPath] : [])), ...(focus.carWalks ?? [])];
    setSource(map, 'walk-path', {
      type: 'FeatureCollection',
      features: walks.map((coordinates) => ({ type: 'Feature', geometry: { type: 'LineString', coordinates }, properties: {} })),
    });
    const rides = journey?.rides ?? [];
    const stations = (focus.fuel ?? focus.chargers ?? []).slice(0, FITTED_STATIONS).map((s): [number, number] => [s.lon, s.lat]);

    const carPath = focus.drive ? [] : (carRoutes?.paths[carRoutes.selected] ?? []);
    const points = [...walks.flat(), ...rides.flatMap((ride) => ride.path), ...stations, ...carPath];
    const routeKey =
      (carPath.length ? `car:${carRoutes!.selected}:${carPath[0]}:${carPath.length}` : '') ||
      rides.map((ride) => `${ride.line}:${ride.path[0]}`).join('|') ||
      String(walks[0]?.[0] ?? stations[0] ?? '');
    if (!points.length) {
      fittedRoute.current = '';
      return;
    }

    if (routeKey === fittedRoute.current) return;

    if (padding.top + padding.bottom > map.getContainer().clientHeight - MIN_ROUTE_VIEW_PX) return;
    fittedRoute.current = routeKey;
    const bounds = new LngLatBounds();
    for (const point of points) bounds.extend(point);
    fitWithin(map, bounds, padding, { duration: 700, maxZoom: 16.5 });
  }, [walkPath, journey, focus.fuel, focus.chargers, carRoutes, focus.carWalks, focus.drive, padding, styleVersion]);

  const buildings3d = layers.buildings3d;
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (buildings3d) {
      map.touchPitch.enable();
      map.easeTo({ pitch: PITCH_3D, zoom: Math.max(map.getZoom(), 15.5), duration: 700 });
    } else {
      map.touchPitch.disable();
      map.easeTo({ pitch: 0, bearing: 0, duration: 500 });
    }
  }, [buildings3d]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleVersion || !styleReady.current || !buildings3d) return;
    let cancelled = false;
    void import('./models3d').then(({ createModelLayer }) => {
      if (cancelled || map.getLayer(MODEL_LAYER)) return;
      const vehicles = () => {
        const { buses, rail } = useSettings.getState().layers;
        const { focus } = useUi.getState();
        const shown = focus.journey?.lines ?? (focus.line ? [focus.line] : null);
        const settings = useSettings.getState();
        const hidden = settings.hiddenLines[settings.region] ?? [];
        return (animator.current?.snapshot() ?? []).filter(
          (v) => (v.mode === 'bus' ? buses : rail) && (shown ? shown.includes(v.line) : !hidden.includes(v.line)),
        );
      };
      map.addLayer(createModelLayer({ dark: themeRef.current.dark, vehicles }), 'vehicles');
    });
    return () => {
      cancelled = true;
      if (map.getLayer(MODEL_LAYER)) map.removeLayer(MODEL_LAYER);
    };
  }, [buildings3d, styleVersion]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleVersion || !styleReady.current) return;
    const trip = focus.journey;
    if (trip) {
      const rideModes = new Map(trip.rides.map((ride) => [ride.line, ride.mode]));
      const colorOf = (line: string) => MODE_COLORS[rideModes.get(line) ?? lineIndex.get(line)?.mode ?? 'bus'];
      setSource(map, 'route', {
        type: 'FeatureCollection',
        features: trip.rides.map(({ line, path }) => ({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: path },
          properties: { color: colorOf(line) },
        })),
      });
      setSource(map, 'route-stops', {
        type: 'FeatureCollection',
        features: trip.markers.map((stop) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [stop.lon, stop.lat] },
          properties: { id: stop.id, name: stop.name, color: colorOf(stop.line), pass: !!stop.pass },
        })),
      });
      return;
    }

    const line = focus.line;
    const shapeIds = [...new Set(linePatterns.map((p) => p.shape))];
    const drawn = line && shapes ? shapeIds.flatMap((id) => (shapes[id] ? [shapes[id]] : [])) : [];
    const color = MODE_COLORS[(line && lineIndex.get(line)?.mode) || 'bus'];

    const paths = drawn.length
      ? drawn
      : linePatterns.map((p) => p.stops.flatMap((id) => {
          const stop = stopIndex.get(id);
          return stop ? [[stop.lon, stop.lat] as [number, number]] : [];
        }));

    setSource(map, 'route', {
      type: 'FeatureCollection',
      features: paths.map((coordinates) => ({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates },
        properties: { color },
      })),
    });
    const lineStops = [...new Set(linePatterns.flatMap((p) => p.stops))].flatMap((id) => stopIndex.get(id) ?? []);
    setSource(map, 'route-stops', {
      type: 'FeatureCollection',
      features: lineStops.map((s) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
        properties: { id: s.id, name: s.name, color },
      })),
    });

    if (paths.length && !focus.vehicleRef) {
      const bounds = new LngLatBounds();
      for (const path of paths) for (const point of path) bounds.extend(point);
      fitWithin(map, bounds, paddingRef.current, { duration: 600, maxZoom: 15 });
    }
  }, [focus.line, focus.journey, focus.vehicleRef, linePatterns, shapes, stopIndex, lineIndex, styleVersion]);

  const flyWithin = (lat: number, lon: number, zoom: number, duration = 700) =>
    mapRef.current?.flyTo({
      center: [lon, lat],
      zoom,
      padding: paddingRef.current,
      duration,

      pitch: useSettings.getState().layers.buildings3d ? PITCH_3D : 0,
    });

  useEffect(() => {
    const stop = focus.stopId ? stopIndex.get(focus.stopId) : undefined;
    const map = mapRef.current;
    if (map && stop) flyWithin(stop.lat, stop.lon, Math.max(map.getZoom(), FOCUS_ZOOM));
  }, [focus.stopId, stopIndex]);

  const vehicleRef = focus.vehicleRef;
  const selected = vehicles?.find((v) => v.ref === vehicleRef);
  const hasSelected = !!selected;
  useEffect(() => {
    const map = mapRef.current;
    if (map && selected) flyWithin(selected.lat, selected.lon, Math.max(map.getZoom(), 14.5));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleRef, hasSelected]);

  useEffect(() => {
    const { location: here } = useUi.getState();
    if (here && recenter) flyWithin(here.lat, here.lon, 15, 800);
  }, [recenter]);

  useEffect(() => {
    if (flyTarget) flyWithin(flyTarget.lat, flyTarget.lon, flyTarget.zoom, 1400);
  }, [flyTarget]);

  const follow = useUi((s) => s.follow);
  const driveCamera = useUi((s) => s.driveCamera);
  const headingUp = useUi((s) => s.headingUp);
  const headingUpRef = useRef(headingUp);
  headingUpRef.current = headingUp;
  const locationRef = useRef(location);
  locationRef.current = location;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !follow || !location || driveCamera || headingUp) return;
    map.easeTo({ center: [location.lon, location.lat], zoom: Math.max(map.getZoom(), FOLLOW_ZOOM), padding: paddingRef.current, duration: 900 });
  }, [follow, location, driveCamera, headingUp]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !headingUp || driveCamera) return;
    let facing = compassHeading();
    let shown: number | null = null;
    let frame = 0;
    const zoom = Math.max(map.getZoom(), FOLLOW_ZOOM);
    const turnLeft = (from: number, to: number) => Math.abs(((to - from + 540) % 360) - 180);
    const step = () => {
      frame = 0;
      let busy = false;
      if (facing !== null) {
        shown = shown === null ? facing : blendBearing(shown, facing, HEADING_EASE);
        if (turnLeft(shown, facing) > 0.3) busy = true;
        const marker = meMarker.current;
        marker?.getElement().classList.add('me-marker--heading');
        marker?.setRotation(shown);
      }
      const here = locationRef.current;
      if (follow && here) {
        const center = map.getCenter();
        const lon = center.lng + (here.lon - center.lng) * FOLLOW_EASE;
        const lat = center.lat + (here.lat - center.lat) * FOLLOW_EASE;
        if (Math.abs(here.lon - lon) + Math.abs(here.lat - lat) > 1e-6) busy = true;
        const z = map.getZoom() + (zoom - map.getZoom()) * FOLLOW_EASE;
        if (Math.abs(zoom - z) > 0.01) busy = true;
        map.jumpTo({ center: [lon, lat], zoom: z, bearing: shown ?? map.getBearing(), padding: paddingRef.current });
      }
      if (busy) frame = requestAnimationFrame(step);
    };
    const kick = () => {
      if (!frame) frame = requestAnimationFrame(step);
    };
    const stop = watchCompass((heading) => {
      facing = heading;
      kick();
    });
    const unsubscribe = useUi.subscribe((state, previous) => {
      if (state.location !== previous.location) kick();
    });
    kick();
    return () => {
      stop();
      unsubscribe();
      cancelAnimationFrame(frame);
      const marker = meMarker.current;
      marker?.getElement().classList.remove('me-marker--heading');
      if (!useUi.getState().driveCamera) marker?.setRotation(0);
    };
  }, [headingUp, follow, driveCamera]);

  useEffect(() => {
    const map = mapRef.current;
    if (map && !headingUp && !driveCamera && map.getBearing()) map.easeTo({ bearing: 0, duration: 600 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headingUp]);

  const drive = !!focus.drive;
  const glide = useRef<{ from: DriveCamera; to: DriveCamera; start: number; length: number; frame: number; at: number } | null>(null);
  const followRef = useRef(follow);
  followRef.current = follow;
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!driveCamera) {
      if (glide.current) cancelAnimationFrame(glide.current.frame);
      glide.current = null;
      return;
    }
    const now = performance.now();
    const previous = glide.current;
    let from = driveCamera;
    if (previous) {
      cancelAnimationFrame(previous.frame);
      const t = Math.min(1, (now - previous.start) / previous.length);
      from = mixCamera(previous.from, previous.to, t);
    }

    const length = previous ? Math.min(GLIDE_MAX_MS, Math.max(GLIDE_MIN_MS, now - previous.at)) : 0;
    const state = { from, to: driveCamera, start: now, length, frame: 0, at: now };
    glide.current = state;
    const step = () => {
      const t = state.length ? Math.min(1, (performance.now() - state.start) / state.length) : 1;
      const camera = mixCamera(state.from, state.to, t);
      meMarker.current?.setLngLat([camera.lon, camera.lat]).setRotation(camera.bearing);
      if (followRef.current) {
        const view = map.getContainer().clientHeight - paddingRef.current.top - paddingRef.current.bottom;
        map.jumpTo({
          center: [camera.lon, camera.lat],
          zoom: camera.zoom,
          bearing: camera.bearing,
          pitch: DRIVE_PITCH,
          padding: { ...paddingRef.current, top: paddingRef.current.top + view * DRIVE_CAR_LOW },
        });
      }
      if (t < 1) state.frame = requestAnimationFrame(step);
    };
    state.frame = requestAnimationFrame(step);
  }, [driveCamera]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !follow || !driveCamera) return;
    const view = map.getContainer().clientHeight - paddingRef.current.top - paddingRef.current.bottom;
    map.easeTo({
      center: [driveCamera.lon, driveCamera.lat],
      zoom: driveCamera.zoom,
      bearing: driveCamera.bearing,
      pitch: DRIVE_PITCH,
      padding: { ...paddingRef.current, top: paddingRef.current.top + view * DRIVE_CAR_LOW },
      duration: 600,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [follow]);
  useEffect(() => {
    const map = mapRef.current;
    if (map && !drive && !layers.buildings3d && (map.getPitch() || map.getBearing())) map.easeTo({ pitch: 0, bearing: 0, duration: 600 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drive]);

  const north = useUi((s) => s.north);
  useEffect(() => {
    const map = mapRef.current;
    if (map && north) map.easeTo({ bearing: 0, ...(layers.buildings3d ? {} : { pitch: 0 }), duration: 500 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [north]);

  const fitTarget = useUi((s) => s.fitTarget);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !fitTarget) return;
    const [west, south, east, north] = fitTarget.bounds;
    map.easeTo({ pitch: 0, bearing: 0, duration: 0 });
    fitWithin(map, new LngLatBounds([west, south], [east, north]), paddingRef.current, { duration: 800, maxZoom: 16 });
  }, [fitTarget]);

  const viewport = useUi((s) => s.viewport);
  const placesView = layers.places && viewport && viewport.north - viewport.south < PLACES_VIEW_DEG ? viewport : null;
  const extraPlaces = useExtraPlaces(placesView);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getSource('extra-places')) return;
    setSource(map, 'extra-places', {
      type: 'FeatureCollection',
      features: extraPlaces.map(([lon, lat, cls, subclass, name, osm]) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [lon, lat] },
        properties: { class: cls, subclass, name, osm },
      })),
    });
  }, [extraPlaces, styleVersion]);

  const meMarker = useRef<Marker | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !location) return;
    if (!meMarker.current) {
      const element = document.createElement('div');
      element.className = 'me-marker';

      const beam = document.createElement('span');
      beam.className = 'me-beam';
      element.appendChild(beam);
      meMarker.current = new Marker({ element, rotationAlignment: 'map', pitchAlignment: 'map' }).setLngLat([location.lon, location.lat]).addTo(map);
    } else if (!driveCamera) {
      meMarker.current.setLngLat([location.lon, location.lat]);
    }

    meMarker.current.getElement().classList.toggle('me-marker--drive', !!driveCamera);
    if (!driveCamera && !headingUpRef.current) meMarker.current.setRotation(0);
  }, [location, driveCamera]);

  return (
    <div id="map-root" className="absolute inset-0 bg-bg">
      <div ref={container} className="h-full w-full" />
      {areaOutline && <AreaChip name={areaOutline.name} />}
    </div>
  );
}

function AreaChip({ name }: { name: string }) {
  const { t } = useTranslation();
  return (
    <div className="safe-top pointer-events-none absolute inset-x-0 top-[76px] z-10 flex justify-center px-16">
      <div className="pointer-events-auto flex max-w-full items-center gap-2 rounded-full bg-card py-1.5 pr-1.5 pl-4 shadow-lg">
        <span className="size-2.5 shrink-0 rounded-full bg-primary" />
        <span className="truncate text-[15px] font-semibold">{name}</span>
        <button type="button" aria-label={t('common.close')} onClick={() => useUi.getState().setAreaOutline(null)} className="press grid size-8 shrink-0 place-items-center rounded-full bg-raised">
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
