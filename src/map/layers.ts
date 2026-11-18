import type { ExpressionSpecification, FilterSpecification, GeoJSONSource, Map as MapLibre, SymbolLayerSpecification } from 'maplibre-gl';
import type { Mode } from '@/core/types';
import { POI_CATEGORIES, POI_ICONS, poiIconId } from './style';
import { POI_GLYPH_PATHS } from './poiGlyphs';

export const MODE_COLORS: Record<Mode, string> = {
  bus: '#155EEF',
  tram: '#9333EA',
  metro: '#EA580C',
  train: '#15803D',
  ferry: '#0E7490',
};

const PIN_ZOOM = 11.5;
const LABEL_ZOOM = 12.5;

const STOP_SIGN_ZOOM = 15.4;

export const SIGHT_ZOOMS = { calm: [10.5, 12.6, 14.2], busy: [12.8, 14.8, 16.2] };

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

const ICON_RATIO = 3;

function poiIcon(color: string, glyph: string) {
  const size = 22;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size * ICON_RATIO;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(ICON_RATIO, ICON_RATIO);
  ctx.shadowColor = 'rgba(16, 24, 40, 0.28)';
  ctx.shadowBlur = 2;
  ctx.shadowOffsetY = 0.5;
  ctx.beginPath();
  ctx.arc(11, 11, 9.5, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.translate(4.25, 4.25);
  ctx.scale(0.5625, 0.5625);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke(new Path2D(glyph));
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

function facadeTexture(wall: string, glass: string, lit: string | null) {
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size * ICON_RATIO;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(ICON_RATIO, ICON_RATIO);
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
  ctx.fillRect(0, 13, size, 1);
  ctx.fillRect(0, 29, size, 1);
  for (let row = 0; row < 2; row++) {
    for (let column = 0; column < 2; column++) {
      ctx.fillStyle = lit && (row + column * 3) % 4 === 1 ? lit : glass;
      ctx.fillRect(4 + column * 16, 3 + row * 16, 8, 9);
    }
  }
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

export function addAppLayers(map: MapLibre, dark: boolean) {
  for (const { category, glyph } of POI_ICONS) {
    map.addImage(poiIconId(category, glyph), poiIcon(POI_CATEGORIES[category].color, POI_GLYPH_PATHS[glyph]), { pixelRatio: ICON_RATIO });
  }

  const lit = dark ? '#F6C667' : null;
  const facades = dark
    ? { plaster: '#4A5468', brick: '#5B3F3C', stone: '#3D4658', glass: '#22344F' }
    : { plaster: '#F0E7D5', brick: '#C08A6B', stone: '#D5D7D6', glass: '#A9C4DC' };
  for (const [name, wall] of Object.entries(facades)) {
    const glass = dark ? '#141C2B' : name === 'glass' ? '#7FA5C7' : '#5C7087';
    map.addImage(`facade-${name}`, facadeTexture(wall, glass, lit), { pixelRatio: ICON_RATIO });
  }

  for (const id of ['stops', 'route', 'route-stops', 'vehicles', 'fuel', 'chargers', 'car-routes', 'road-lines', 'road-signs', 'walk-path', 'landmarks', 'favorite-places', 'driver-reports', 'search-pins', 'area-outline', 'car-stops', 'airports', 'place']) {
    map.addSource(id, { type: 'geojson', data: EMPTY });
  }

  const surface = dark ? '#1B2638' : '#FFFFFF';
  const lineColor: ExpressionSpecification = ['get', 'color'];

  map.addLayer({
    id: 'stops-dot',
    type: 'symbol',
    source: 'stops',
    minzoom: 13.5,
    layout: {
      'icon-image': ['step', ['zoom'], ['case', ['==', ['get', 'rank'], 1], 'stop-mini|bus', ['get', 'icon']], STOP_SIGN_ZOOM, ['get', 'icon']],
      'icon-size': ['interpolate', ['linear'], ['zoom'], 13.5, 0.62, 15.5, 0.88, 17, 1.05],

      'icon-allow-overlap': true,
      'symbol-sort-key': ['get', 'rank'],
    },
  });
  map.addLayer({
    id: 'stops-label',
    type: 'symbol',
    source: 'stops',
    minzoom: 15,
    layout: {
      'text-field': ['get', 'name'],
      'text-font': ['Noto Sans Bold'],
      'text-size': 12,
      'text-offset': [0, 1.35],
      'text-anchor': 'top',
      'text-optional': true,
    },
    paint: {
      'text-color': dark ? '#F2F5FA' : '#171923',
      'text-halo-color': dark ? '#101827' : '#FFFFFF',
      'text-halo-width': 1.4,
    },
  });
  map.addLayer({
    id: 'route-casing',
    type: 'line',
    source: 'route',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': surface, 'line-width': 8, 'line-opacity': 0.9 },
  });
  map.addLayer({
    id: 'route-line',
    type: 'line',
    source: 'route',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': lineColor, 'line-width': 4.5 },
  });
  map.addLayer({
    id: 'walk-path-line',
    type: 'line',
    source: 'walk-path',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#2478F2', 'line-width': 6, 'line-dasharray': [0.1, 1.8] },
  });
  map.addLayer({
    id: 'route-stops-dot',
    type: 'circle',
    source: 'route-stops',
    paint: {
      'circle-radius': [
        'interpolate',
        ['linear'],
        ['zoom'],
        11,
        ['case', ['==', ['get', 'pass'], true], 1.6, 3],
        15,
        ['case', ['==', ['get', 'pass'], true], 4, 6.5],
      ],
      'circle-color': surface,
      'circle-stroke-color': lineColor,
      'circle-stroke-width': 2,
    },
  });

  const stopName = {
    type: 'symbol' as const,
    source: 'route-stops',
    layout: {
      'text-field': ['get', 'name'] as ExpressionSpecification,
      'text-font': ['Noto Sans Bold'],
      'text-offset': [0, 1.1] as [number, number],
      'text-anchor': 'top' as const,
      'text-optional': true,
    },
    paint: {
      'text-color': dark ? '#F2F5FA' : '#171923',
      'text-halo-color': dark ? '#101827' : '#FFFFFF',
      'text-halo-width': 1.4,
    },
  };
  map.addLayer({ ...stopName, id: 'route-stops-label', minzoom: 12, filter: ['!=', ['get', 'pass'], true], layout: { ...stopName.layout, 'text-size': 12.5 } });
  map.addLayer({ ...stopName, id: 'route-stops-label-pass', minzoom: 14.5, filter: ['==', ['get', 'pass'], true], layout: { ...stopName.layout, 'text-size': 11 } });
  map.addLayer({
    id: 'stop-selected',
    type: 'circle',
    source: 'stops',
    filter: ['==', ['get', 'id'], ''],
    paint: {
      'circle-radius': 9,
      'circle-color': lineColor,
      'circle-stroke-color': '#FFFFFF',
      'circle-stroke-width': 3,
    },
  });
  map.addLayer({
    id: 'fuel-pins',
    type: 'symbol',
    source: 'fuel',
    layout: { 'icon-image': 'fuel-pin', 'icon-allow-overlap': true },
  });

  const [top, mid, near] = SIGHT_ZOOMS.calm;
  const sightTiers: [string, number, ExpressionSpecification][] = [
    ['landmarks', top, ['<', ['get', 'rank'], 3]],
    ['landmarks-mid', mid, ['all', ['>=', ['get', 'rank'], 3], ['<', ['get', 'rank'], 9]]],
    ['landmarks-near', near, ['>=', ['get', 'rank'], 9]],
  ];
  for (const [id, minzoom, filter] of sightTiers) {
    map.addLayer({
      id,
      type: 'symbol',
      source: 'landmarks',
      minzoom,
      filter,
      layout: {
        'icon-image': ['concat', 'landmark|', ['get', 'id']],
        'icon-anchor': 'bottom',
        'icon-size': ['interpolate', ['linear'], ['zoom'], 10.5, 0.66, 14, 0.86, 17, 1],
        'icon-allow-overlap': true,
        'symbol-sort-key': ['get', 'rank'],
        'symbol-z-order': 'source',
        'text-field': ['step', ['zoom'], '', 15, ['get', 'name']],
        'text-font': ['Noto Sans Bold'],
        'text-size': 11.5,
        'text-anchor': 'top',
        'text-offset': [0, 0.3],
        'text-max-width': 9,
        'text-optional': true,
      },
      paint: {
        'text-color': dark ? '#E9D5A8' : '#7C4A12',
        'text-halo-color': dark ? '#101827' : '#FFFFFF',
        'text-halo-width': 1.4,
      },
    });
  }

  map.addLayer({
    id: 'favorite-places',
    type: 'symbol',
    source: 'favorite-places',
    minzoom: 9,
    layout: {
      'icon-image': 'heart-pin',
      'icon-anchor': 'bottom',
      'icon-allow-overlap': true,
      'icon-size': ['interpolate', ['linear'], ['zoom'], 9, 0.7, 14, 1],
      'text-field': ['step', ['zoom'], '', 13, ['get', 'name']],
      'text-font': ['Noto Sans Bold'],
      'text-size': 11.5,
      'text-anchor': 'top',
      'text-offset': [0, 0.2],
      'text-max-width': 9,
      'text-optional': true,
    },
    paint: {
      'text-color': dark ? '#FDA4AF' : '#BE123C',
      'text-halo-color': dark ? '#101827' : '#FFFFFF',
      'text-halo-width': 1.4,
    },
  });

  map.addLayer({ id: 'area-fill', type: 'fill', source: 'area-outline', paint: { 'fill-color': '#2478F2', 'fill-opacity': dark ? 0.12 : 0.08 } }, 'landmarks');
  map.addLayer({
    id: 'area-line',
    type: 'line',
    source: 'area-outline',
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': '#2478F2', 'line-width': ['interpolate', ['linear'], ['zoom'], 9, 1.6, 15, 3], 'line-dasharray': [2, 1.4] },
  }, 'landmarks');

  const airportLayer = (id: string, filter: FilterSpecification, minzoom: number): SymbolLayerSpecification => ({
    id,
    type: 'symbol',
    source: 'airports',
    minzoom,
    filter,
    layout: {
      'icon-image': 'airport-pin',
      'icon-size': ['interpolate', ['linear'], ['zoom'], 4, 0.7, 10, 1],
      'icon-allow-overlap': true,
      'text-field': ['step', ['zoom'], ['get', 'iata'], 9, ['get', 'name']],
      'text-font': ['Noto Sans Bold'],
      'text-size': 11.5,
      'text-anchor': 'top',
      'text-offset': [0, 1.25],
      'text-optional': true,
    },
    paint: {
      'text-color': dark ? '#7dd3fc' : '#0369a1',
      'text-halo-color': dark ? '#101827' : '#FFFFFF',
      'text-halo-width': 1.4,
    },
  });
  map.addLayer(airportLayer('airports', ['==', ['get', 'major'], true], 4));
  map.addLayer(airportLayer('airports-minor', ['==', ['get', 'major'], false], 6.5));

  map.addLayer({
    id: 'car-stops',
    type: 'circle',
    source: 'car-stops',
    paint: { 'circle-radius': 11, 'circle-color': '#F59E0B', 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 3 },
  });
  map.addLayer({
    id: 'car-stops-number',
    type: 'symbol',
    source: 'car-stops',
    layout: { 'text-field': ['get', 'n'], 'text-font': ['Noto Sans Bold'], 'text-size': 12, 'text-allow-overlap': true, 'text-ignore-placement': true },
    paint: { 'text-color': '#FFFFFF' },
  });

  map.addLayer({
    id: 'search-pins',
    type: 'symbol',
    source: 'search-pins',
    layout: {
      'icon-image': ['get', 'icon'],
      'icon-anchor': 'bottom',
      'icon-size': ['case', ['==', ['get', 'rank'], 0], 1.12, 1],
      'icon-allow-overlap': true,
      'symbol-sort-key': ['get', 'rank'],
      'text-field': ['step', ['zoom'], '', 13.5, ['get', 'name']],
      'text-font': ['Noto Sans Bold'],
      'text-size': 11.5,
      'text-anchor': 'top',
      'text-offset': [0, 0.25],
      'text-max-width': 9,
      'text-optional': true,
    },
    paint: {
      'text-color': dark ? '#93C5FD' : '#1D4ED8',
      'text-halo-color': dark ? '#101827' : '#FFFFFF',
      'text-halo-width': 1.4,
    },
  });

  map.addLayer(
    {
      id: 'place-pin',
      type: 'circle',
      source: 'place',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 16, 17, 30],
        'circle-color': 'rgba(36, 120, 242, 0.3)',
        'circle-stroke-color': '#2478F2',
        'circle-stroke-width': 2.5,
      },
    },
    map.getLayer('poi') ? 'poi' : undefined,
  );

  const round = { 'line-cap': 'round' as const, 'line-join': 'round' as const };
  const picked: FilterSpecification = ['==', ['get', 'selected'], true];
  const other: FilterSpecification = ['==', ['get', 'selected'], false];
  map.addLayer({
    id: 'car-alt-casing',
    type: 'line',
    source: 'car-routes',
    filter: other,
    layout: round,
    paint: { 'line-color': surface, 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 5, 16, 12] },
  });
  map.addLayer({
    id: 'car-alt-line',
    type: 'line',
    source: 'car-routes',
    filter: other,
    layout: round,
    paint: { 'line-color': dark ? '#6B7C99' : '#9AAAC2', 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 3, 16, 8] },
  });
  map.addLayer({
    id: 'car-route-casing',
    type: 'line',
    source: 'car-routes',
    filter: picked,
    layout: round,
    paint: { 'line-color': dark ? '#0A2F73' : '#FFFFFF', 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 6, 16, 14] },
  });
  map.addLayer({
    id: 'car-route-line',
    type: 'line',
    source: 'car-routes',
    filter: picked,
    layout: round,
    paint: { 'line-color': '#2478F2', 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 4, 16, 9] },
  });

  const roadColor: ExpressionSpecification = ['match', ['get', 'kind'], 'closure', '#DC2626', 'accident', '#DC2626', 'notice', '#D97706', '#EA580C'];
  map.addLayer({
    id: 'road-event-casing',
    type: 'line',
    source: 'road-lines',
    minzoom: 9,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': surface, 'line-width': ['interpolate', ['linear'], ['zoom'], 9, 4, 15, 9], 'line-opacity': 0.85 },
  });
  map.addLayer({
    id: 'road-event-line',
    type: 'line',
    source: 'road-lines',
    minzoom: 9,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': roadColor,
      'line-width': ['interpolate', ['linear'], ['zoom'], 9, 2, 15, 5],
      'line-opacity': ['case', ['get', 'idle'], 0.45, 0.95],
      'line-dasharray': ['literal', [2, 1.2]],
    },
  });
  const major: FilterSpecification = ['in', ['get', 'kind'], ['literal', ['closure', 'accident']]];
  const sign = {
    type: 'symbol' as const,
    source: 'road-signs',
    layout: {
      'icon-image': ['concat', 'road-sign|', ['get', 'kind']] as ExpressionSpecification,
      'icon-size': ['interpolate', ['linear'], ['zoom'], 7, 0.65, 12, 0.9, 15, 1] as ExpressionSpecification,
      'symbol-sort-key': ['-', 100, ['get', 'rank']] as ExpressionSpecification,
    },
    paint: { 'icon-opacity': ['case', ['get', 'idle'], 0.6, 1] as ExpressionSpecification },
  };
  map.addLayer({ ...sign, id: 'road-signs-minor', minzoom: 11, filter: ['!', major] });
  map.addLayer({ ...sign, id: 'road-signs', filter: major, layout: { ...sign.layout, 'icon-allow-overlap': true } });
  map.addLayer({
    id: 'road-sign-selected',
    type: 'circle',
    source: 'road-signs',
    filter: ['==', ['get', 'id'], ''],
    paint: { 'circle-radius': 20, 'circle-color': '#DC2626', 'circle-opacity': 0.18 },
  });

  const reportLayer = (id: string, fixed: boolean, minzoom: number): SymbolLayerSpecification => ({
    id,
    type: 'symbol',
    source: 'driver-reports',
    minzoom,
    filter: ['==', ['get', 'fixed'], fixed],
    layout: {
      'icon-image': ['concat', 'report|', ['get', 'kind']],
      'icon-size': ['interpolate', ['linear'], ['zoom'], 9, 0.7, 14, 1],
      'icon-allow-overlap': true,
      'text-field': ['step', ['zoom'], '', 13, ['get', 'limit']],
      'text-font': ['Noto Sans Bold'],
      'text-size': 11,
      'text-offset': [0, 1.35],
      'text-anchor': 'top',
      'text-optional': true,
    },
    paint: {
      'text-color': dark ? '#C4B5FD' : '#5B21B6',
      'text-halo-color': dark ? '#101827' : '#FFFFFF',
      'text-halo-width': 1.4,
    },
  });
  map.addLayer(reportLayer('speed-cameras', true, 11));
  map.addLayer(reportLayer('driver-reports', false, 0));

  map.addLayer({
    id: 'charger-pins',
    type: 'symbol',
    source: 'chargers',
    layout: {
      'icon-image': ['concat', 'charger-pin|', ['get', 'state']],
      'icon-size': ['interpolate', ['linear'], ['zoom'], 9, 0.7, 13, 1],
      'icon-allow-overlap': true,
      'symbol-sort-key': ['get', 'rank'],
      'text-field': ['step', ['zoom'], '', 13.5, ['concat', ['to-string', ['get', 'kw']], ' kW']],
      'text-font': ['Noto Sans Bold'],
      'text-size': 11,
      'text-offset': [0, 1.45],
      'text-anchor': 'top',
      'text-optional': true,
    },
    paint: {
      'text-color': dark ? '#F2F5FA' : '#171923',
      'text-halo-color': dark ? '#101827' : '#FFFFFF',
      'text-halo-width': 1.4,
    },
  });
  map.addLayer({
    id: 'vehicle-selected',
    type: 'circle',
    source: 'vehicles',
    filter: ['==', ['get', 'ref'], ''],
    paint: { 'circle-radius': 25, 'circle-color': '#2478F2', 'circle-opacity': 0.22 },
  });
  map.addLayer({
    id: 'vehicle-heading',
    type: 'symbol',
    source: 'vehicles',
    layout: {
      'icon-image': ['step', ['zoom'], ['concat', 'vehicle-dot|', ['get', 'mode']], PIN_ZOOM, ['concat', 'vehicle-pin|', ['get', 'mode']]],
      'icon-size': ['interpolate', ['linear'], ['zoom'], PIN_ZOOM, 0.8, 15, 1],
      'icon-rotate': ['step', ['zoom'], 0, PIN_ZOOM, ['get', 'bearing']],
      'icon-rotation-alignment': 'map',
      'icon-pitch-alignment': 'viewport',
      'icon-allow-overlap': true,
    },
  });
  map.addLayer({
    id: 'vehicles',
    type: 'symbol',
    source: 'vehicles',
    minzoom: PIN_ZOOM,
    layout: {
      'icon-image': ['concat', 'vehicle-glyph|', ['get', 'mode']],
      'icon-size': ['interpolate', ['linear'], ['zoom'], PIN_ZOOM, 0.8, 15, 1],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
  });

  map.addLayer({
    id: 'vehicle-label',
    type: 'symbol',
    source: 'vehicles',
    minzoom: LABEL_ZOOM,
    layout: {
      'icon-image': ['get', 'tag'],
      'icon-anchor': 'left',

      'icon-offset': [14, 0],
      'icon-padding': 1,
    },
  });
}

export function setWideView(map: MapLibre, wide: boolean) {
  const pin = wide ? 0 : PIN_ZOOM;
  const size: ExpressionSpecification = wide
    ? ['interpolate', ['linear'], ['zoom'], 5, 0.72, 10, 0.9, 15, 1]
    : ['interpolate', ['linear'], ['zoom'], PIN_ZOOM, 0.8, 15, 1];
  map.setLayoutProperty('vehicle-heading', 'icon-image', ['step', ['zoom'], ['concat', 'vehicle-dot|', ['get', 'mode']], pin, ['concat', 'vehicle-pin|', ['get', 'mode']]]);
  map.setLayoutProperty('vehicle-heading', 'icon-rotate', ['step', ['zoom'], 0, pin, ['get', 'bearing']]);
  map.setLayoutProperty('vehicle-heading', 'icon-size', size);
  map.setLayoutProperty('vehicles', 'icon-size', size);
  map.setLayerZoomRange('vehicles', pin, 24);
  map.setLayerZoomRange('vehicle-label', wide ? 5.5 : LABEL_ZOOM, 24);
  map.setLayerZoomRange('stops-dot', wide ? 6 : 13.5, 24);
  map.setLayerZoomRange('stops-label', wide ? 8 : 15, 24);
  map.setLayoutProperty(
    'stops-dot',
    'icon-size',
    wide
      ? ['interpolate', ['linear'], ['zoom'], 6, 0.42, 10, 0.7, 15, 0.95]
      : ['interpolate', ['linear'], ['zoom'], 13.5, 0.62, 15.5, 0.88, 17, 1.05],
  );
}

export const setSource = (map: MapLibre, id: string, data: GeoJSON.GeoJSON) =>
  (map.getSource(id) as GeoJSONSource | undefined)?.setData(data);
