import type { LatLon } from './types';

export interface Landmark extends LatLon {
  id: string;
  name: Record<string, string>;
  about: Record<string, string>;
  
  photo: string;
  
  thumb?: string;
  credit: { author: string; license: string };
  
  wiki?: Record<string, string>;
  
  links?: number;
}

export const inLanguage = (texts: Record<string, string>, language: string) =>
  texts[language] ?? texts.en ?? texts.fi ?? Object.values(texts)[0] ?? '';

const THUMB_WIDTHS = [330, 500, 960, 1280];

export function commonsPhoto(file: string, width: number, thumb?: string) {
  const size = THUMB_WIDTHS.find((w) => w >= width) ?? THUMB_WIDTHS[THUMB_WIDTHS.length - 1];
  const name = file.replaceAll(' ', '_');
  const raster = /\.(jpe?g|png|webp|gif)$/i.test(name);
  if (thumb && (raster || /\.svg$/i.test(name))) {
    const encoded = encodeURIComponent(name);
    return `https://upload.wikimedia.org/wikipedia/commons/thumb/${thumb}/${encoded}/${size}px-${encoded}${raster ? '' : '.png'}`;
  }
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=${size}`;
}

export const sheetPhotoWidth = () => Math.round(Math.min(window.innerWidth, 420) * Math.min(window.devicePixelRatio || 1, 2.5));

const OSM_TYPES = ['', 'node', 'way', 'relation'] as const;

export function osmOfFeature(id: number): { type: 'node' | 'way' | 'relation'; id: number } | null {
  const type = OSM_TYPES[id % 10];
  return type ? { type, id: Math.floor(id / 10) } : null;
}
