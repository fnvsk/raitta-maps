import { dataUrl } from '@/platform';
import type { Map as MapLibre } from 'maplibre-gl';
import { BRANDS } from '@/core/brands';
import type { Mode } from '@/core/types';
import { MODE_COLORS } from './layers';

const RATIO = 3;
const WHITE = '#FFFFFF';
const FONT = '700 12.5px -apple-system, BlinkMacSystemFont, "Inter Variable", "Segoe UI", Roboto, sans-serif';

const MAX_LABEL = 7;

const TAG_MARGIN = 3;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
}

function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

const GLYPHS: Record<Mode, (ctx: CanvasRenderingContext2D, body: string) => void> = {
  bus(ctx, body) {
    roundRect(ctx, 4, 3, 16, 16.5, 3.5, WHITE);
    roundRect(ctx, 6, 5.5, 12, 6.5, 1.4, body);
    dot(ctx, 7.8, 15.5, 1.4, body);
    dot(ctx, 16.2, 15.5, 1.4, body);
    roundRect(ctx, 6, 18.5, 3.2, 3, 1, WHITE);
    roundRect(ctx, 14.8, 18.5, 3.2, 3, 1, WHITE);
  },
  tram(ctx, body) {
    ctx.strokeStyle = WHITE;
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(8.5, 1.5);
    ctx.lineTo(15.5, 1.5);
    ctx.moveTo(12, 1.5);
    ctx.lineTo(12, 5);
    ctx.stroke();
    roundRect(ctx, 5.5, 4.5, 13, 15.5, 5, WHITE);
    roundRect(ctx, 7.5, 7.5, 9, 5.5, 1.6, body);
    dot(ctx, 12, 16.2, 1.6, body);
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(8, 20);
    ctx.lineTo(6.5, 22.5);
    ctx.moveTo(16, 20);
    ctx.lineTo(17.5, 22.5);
    ctx.stroke();
  },

  metro(ctx) {
    ctx.strokeStyle = WHITE;
    ctx.lineWidth = 3.8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(5, 19.5);
    ctx.lineTo(5, 5);
    ctx.lineTo(12, 13.5);
    ctx.lineTo(19, 5);
    ctx.lineTo(19, 19.5);
    ctx.stroke();
  },
  train(ctx, body) {
    ctx.beginPath();
    ctx.moveTo(12, 2);
    ctx.bezierCurveTo(17, 2, 20, 6, 20, 11);
    ctx.lineTo(20, 16);
    ctx.quadraticCurveTo(20, 19.5, 16.5, 19.5);
    ctx.lineTo(7.5, 19.5);
    ctx.quadraticCurveTo(4, 19.5, 4, 16);
    ctx.lineTo(4, 11);
    ctx.bezierCurveTo(4, 6, 7, 2, 12, 2);
    ctx.closePath();
    ctx.fillStyle = WHITE;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(12, 5);
    ctx.bezierCurveTo(15, 5, 17, 7.5, 17.4, 11);
    ctx.lineTo(6.6, 11);
    ctx.bezierCurveTo(7, 7.5, 9, 5, 12, 5);
    ctx.closePath();
    ctx.fillStyle = body;
    ctx.fill();
    dot(ctx, 8, 15.5, 1.4, body);
    dot(ctx, 16, 15.5, 1.4, body);
    roundRect(ctx, 7, 20.5, 10, 1.8, 0.9, WHITE);
  },
  ferry(ctx, body) {
    roundRect(ctx, 8, 3, 8, 6, 1.4, WHITE);
    roundRect(ctx, 6, 7.5, 12, 6, 1.6, WHITE);
    roundRect(ctx, 8, 9.5, 8, 2, 1, body);
    ctx.beginPath();
    ctx.moveTo(2.5, 13);
    ctx.lineTo(21.5, 13);
    ctx.lineTo(18.5, 19.5);
    ctx.lineTo(5.5, 19.5);
    ctx.closePath();
    ctx.fillStyle = WHITE;
    ctx.fill();
    ctx.strokeStyle = WHITE;
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(3, 22);
    ctx.quadraticCurveTo(7.5, 20.2, 12, 22);
    ctx.quadraticCurveTo(16.5, 23.8, 21, 22);
    ctx.stroke();
  },
};

function canvasFor(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(width * RATIO);
  canvas.height = Math.ceil(height * RATIO);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(RATIO, RATIO);
  return ctx;
}

const pixels = (ctx: CanvasRenderingContext2D) => ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);

function softShadow(ctx: CanvasRenderingContext2D) {
  ctx.shadowColor = 'rgba(16, 24, 40, 0.3)';
  ctx.shadowBlur = 2.5;
  ctx.shadowOffsetY = 1;
}

function pin(mode: Mode) {
  const size = 40;
  const c = size / 2;
  const ctx = canvasFor(size, size);
  const shape = (radius: number, tip: number) => {
    ctx.beginPath();
    ctx.arc(c, c, radius, Math.PI * 1.5 + 0.75, Math.PI * 1.5 - 0.75);
    ctx.lineTo(c, c - tip);
    ctx.closePath();
  };
  ctx.save();
  softShadow(ctx);
  shape(12.5, 18.5);
  ctx.fillStyle = WHITE;
  ctx.fill();
  ctx.restore();
  shape(11, 16);
  ctx.fillStyle = MODE_COLORS[mode];
  ctx.fill();
  return pixels(ctx);
}

function glyph(mode: Mode) {
  const size = 15;
  const ctx = canvasFor(size, size);
  ctx.scale(size / 24, size / 24);
  GLYPHS[mode](ctx, MODE_COLORS[mode]);
  return pixels(ctx);
}

function tag(mode: Mode, line: string) {
  const label = line.length > MAX_LABEL ? line.slice(0, MAX_LABEL) : line;
  const measure = canvasFor(1, 1);
  measure.font = FONT;
  const height = 20;
  const width = Math.ceil(measure.measureText(label).width) + 13;
  const ctx = canvasFor(width + TAG_MARGIN * 2, height + TAG_MARGIN * 2);
  ctx.save();
  softShadow(ctx);
  roundRect(ctx, TAG_MARGIN, TAG_MARGIN, width, height, 6, MODE_COLORS[mode]);
  ctx.restore();
  ctx.font = FONT;
  ctx.fillStyle = WHITE;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, TAG_MARGIN + width / 2, TAG_MARGIN + height / 2 + 0.5);
  return pixels(ctx);
}

function miniDot(mode: Mode) {
  const size = 14;
  const ctx = canvasFor(size, size);
  dot(ctx, 7, 7, 5.5, WHITE);
  dot(ctx, 7, 7, 4.2, MODE_COLORS[mode]);
  return pixels(ctx);
}

function stopMini(mode: Mode) {
  const size = 14;
  const ctx = canvasFor(size, size);
  dot(ctx, 7, 7, 5, WHITE);
  dot(ctx, 7, 7, 3.4, MODE_COLORS[mode]);
  return pixels(ctx);
}

function stopSign(mode: Mode) {
  const size = 32;
  const ctx = canvasFor(size, size);
  ctx.save();
  softShadow(ctx);

  if (mode === 'metro') dot(ctx, 16, 16, 13.5, WHITE);
  else roundRect(ctx, 3, 3, 26, 26, 8.5, WHITE);
  ctx.restore();
  if (mode === 'metro') dot(ctx, 16, 16, 11.5, MODE_COLORS[mode]);
  else roundRect(ctx, 5, 5, 22, 22, 7, MODE_COLORS[mode]);
  ctx.translate(7, 7);
  ctx.scale(18 / 24, 18 / 24);
  GLYPHS[mode](ctx, MODE_COLORS[mode]);
  return pixels(ctx);
}

function fuelPin() {
  const size = 32;
  const ctx = canvasFor(size, size);
  ctx.save();
  softShadow(ctx);
  dot(ctx, 16, 16, 13, WHITE);
  ctx.restore();
  dot(ctx, 16, 16, 11.5, '#EA580C');

  roundRect(ctx, 10.5, 9.5, 8, 13, 1.5, WHITE);
  roundRect(ctx, 12, 11, 5, 4, 0.8, '#EA580C');
  ctx.strokeStyle = WHITE;
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(18.5, 13);
  ctx.lineTo(21, 15);
  ctx.lineTo(21, 19.5);
  ctx.stroke();
  return pixels(ctx);
}

const CHARGER_COLORS: Record<string, string> = { free: '#16A34A', busy: '#D97706', down: '#64748B', unknown: '#0D9488' };

function chargerPin(state: string) {
  const size = 32;
  const ctx = canvasFor(size, size);
  ctx.save();
  softShadow(ctx);
  dot(ctx, 16, 16, 13, WHITE);
  ctx.restore();
  dot(ctx, 16, 16, 11.5, CHARGER_COLORS[state] ?? CHARGER_COLORS.unknown);
  ctx.fillStyle = WHITE;
  ctx.beginPath();
  ctx.moveTo(17.6, 8.5);
  ctx.lineTo(11, 17.4);
  ctx.lineTo(15.4, 17.4);
  ctx.lineTo(14.4, 23.5);
  ctx.lineTo(21, 14.6);
  ctx.lineTo(16.6, 14.6);
  ctx.closePath();
  ctx.fill();
  return pixels(ctx);
}

function searchPin() {
  const w = 26;
  const h = 34;
  const ctx = canvasFor(w, h);
  const c = w / 2;
  const drop = (r: number, tip: number, fill: string) => {
    ctx.beginPath();
    ctx.arc(c, c, r, Math.PI * 0.8, Math.PI * 2.2);
    ctx.lineTo(c, tip);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  };
  ctx.save();
  softShadow(ctx);
  drop(11, h - 2, WHITE);
  ctx.restore();
  drop(9.3, h - 4.5, '#2478F2');
  dot(ctx, c, c, 3.4, WHITE);
  return pixels(ctx);
}

function airportPin() {
  const size = 32;
  const ctx = canvasFor(size, size);
  ctx.save();
  softShadow(ctx);
  dot(ctx, 16, 16, 13, WHITE);
  ctx.restore();
  dot(ctx, 16, 16, 11.5, '#0284C7');
  ctx.save();
  ctx.translate(16, 16);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = WHITE;
  ctx.beginPath();

  ctx.roundRect(-1.6, -8, 3.2, 15, 1.6);
  ctx.moveTo(-8, 1.5);
  ctx.lineTo(0, -2.5);
  ctx.lineTo(8, 1.5);
  ctx.lineTo(8, 3);
  ctx.lineTo(0, 0.5);
  ctx.lineTo(-8, 3);
  ctx.closePath();
  ctx.moveTo(-3.5, 7);
  ctx.lineTo(0, 5);
  ctx.lineTo(3.5, 7);
  ctx.lineTo(3.5, 8);
  ctx.lineTo(-3.5, 8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  return pixels(ctx);
}

function heartPin() {
  const w = 30;
  const h = 38;
  const ctx = canvasFor(w, h);
  const c = w / 2;
  const drop = (r: number, tip: number, fill: string) => {
    ctx.beginPath();
    ctx.arc(c, c, r, Math.PI * 0.8, Math.PI * 2.2);
    ctx.lineTo(c, tip);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  };
  ctx.save();
  softShadow(ctx);
  drop(13, h - 2, WHITE);
  ctx.restore();
  drop(11, h - 5, '#E11D48');
  ctx.fillStyle = WHITE;
  ctx.beginPath();
  ctx.moveTo(c, 20.5);
  ctx.bezierCurveTo(c - 7.5, 15.5, c - 6, 9, c - 2.6, 9.4);
  ctx.bezierCurveTo(c - 1.2, 9.6, c, 10.8, c, 12);
  ctx.bezierCurveTo(c, 10.8, c + 1.2, 9.6, c + 2.6, 9.4);
  ctx.bezierCurveTo(c + 6, 9, c + 7.5, 15.5, c, 20.5);
  ctx.fill();
  return pixels(ctx);
}

export const REPORT_COLORS: Record<string, string> = { camera: '#7C3AED', police: '#1D4ED8', accident: '#DC2626', hazard: '#D97706' };

function reportPin(kind: string) {
  const size = 32;
  const ctx = canvasFor(size, size);
  ctx.save();
  softShadow(ctx);
  dot(ctx, 16, 16, 13, WHITE);
  ctx.restore();
  const color = REPORT_COLORS[kind] ?? REPORT_COLORS.hazard;
  dot(ctx, 16, 16, 11.5, color);
  ctx.fillStyle = WHITE;
  if (kind === 'camera') {
    roundRect(ctx, 8.5, 11.5, 15, 10, 2.5, WHITE);
    roundRect(ctx, 12.5, 9.5, 5, 3, 1, WHITE);
    dot(ctx, 16, 16.5, 3.4, color);
    dot(ctx, 16, 16.5, 1.6, WHITE);
  } else if (kind === 'police') {
    ctx.beginPath();
    ctx.moveTo(16, 7.5);
    ctx.lineTo(23, 10);
    ctx.quadraticCurveTo(23, 20.5, 16, 24.5);
    ctx.quadraticCurveTo(9, 20.5, 9, 10);
    ctx.closePath();
    ctx.fill();
    roundRect(ctx, 14.9, 11.5, 2.2, 7.5, 1, color);
    roundRect(ctx, 12.3, 14.1, 7.4, 2.2, 1, color);
  } else if (kind === 'accident') {
    ctx.save();
    ctx.translate(12.5, 17);
    ctx.rotate(-0.45);
    roundRect(ctx, -4.5, -3.5, 9, 7, 2, WHITE);
    ctx.restore();
    ctx.save();
    ctx.translate(19.5, 15);
    ctx.rotate(0.45);
    roundRect(ctx, -4.5, -3.5, 9, 7, 2, WHITE);
    ctx.restore();
    dot(ctx, 16, 9, 1.3, WHITE);
    dot(ctx, 12.5, 10.2, 1, WHITE);
    dot(ctx, 19.5, 10.2, 1, WHITE);
  } else {
    roundRect(ctx, 14.6, 8.5, 2.8, 10, 1.3, WHITE);
    dot(ctx, 16, 22.3, 1.8, WHITE);
  }
  return pixels(ctx);
}

function roadSign(kind: string) {
  const size = 32;
  const ctx = canvasFor(size, size);
  ctx.save();
  softShadow(ctx);
  if (kind === 'closure' || kind === 'notice') dot(ctx, 16, 16, 13, WHITE);
  else {
    ctx.fillStyle = WHITE;
    ctx.beginPath();
    ctx.moveTo(16, 2.5);
    ctx.lineTo(30, 27.5);
    ctx.lineTo(2, 27.5);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  const color = kind === 'roadwork' ? '#EA580C' : kind === 'notice' ? '#D97706' : '#DC2626';
  if (kind === 'closure') {
    dot(ctx, 16, 16, 11, color);
    roundRect(ctx, 9.5, 14, 13, 4, 1, WHITE);
  } else if (kind === 'notice') {
    dot(ctx, 16, 16, 11, color);
    roundRect(ctx, 14.6, 14.2, 2.8, 8, 1, WHITE);
    dot(ctx, 16, 10.8, 1.7, WHITE);
  } else {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(16, 5.5);
    ctx.lineTo(27, 25.5);
    ctx.lineTo(5, 25.5);
    ctx.closePath();
    ctx.fill();
    roundRect(ctx, 14.7, 11.5, 2.6, 7.5, 1, WHITE);
    dot(ctx, 16, 22, 1.6, WHITE);
  }
  return pixels(ctx);
}

const drawnIcons = new Map<string, Promise<ImageData | null>>();
function addWhenDrawn(map: MapLibre, id: string, draw: () => Promise<ImageData | null>) {
  let icon = drawnIcons.get(id);
  if (!icon) {
    icon = draw().catch(() => null);
    drawnIcons.set(id, icon);
  }
  void icon.then((image) => {
    if (image && !map.hasImage(id)) map.addImage(id, image, { pixelRatio: RATIO });
  });
}

const CARD_W = 44;
const CARD_H = 49;

async function landmarkIcon(wikidata: string): Promise<ImageData | null> {
  try {
    const res = await fetch(dataUrl(`landmarks/${wikidata}.webp`));
    if (!res.ok) return null;
    const photo = await createImageBitmap(await res.blob());
    const ctx = canvasFor(CARD_W, CARD_H);
    const side = 38;
    const x = (CARD_W - side) / 2;
    const y = 2;
    const mid = CARD_W / 2;
    ctx.save();
    softShadow(ctx);
    ctx.beginPath();
    ctx.roundRect(x, y, side, side, 10);
    ctx.moveTo(mid - 6, y + side - 1);
    ctx.lineTo(mid, y + side + 7);
    ctx.lineTo(mid + 6, y + side - 1);
    ctx.closePath();
    ctx.fillStyle = WHITE;
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x + 3, y + 3, side - 6, side - 6, 7.5);
    ctx.clip();
    ctx.drawImage(photo, x + 3, y + 3, side - 6, side - 6);
    ctx.restore();
    return pixels(ctx);
  } catch {
    return null;
  }
}

const logos = new Map<string, Promise<{ image: ImageBitmap; bounds: { x: number; y: number; w: number; h: number } } | null>>();
function brandLogo(brandId: string) {
  let logo = logos.get(brandId);
  if (!logo) {
    logo = fetch(dataUrl(`brands/${brandId}.webp`))
      .then((res) => (res.ok ? res.blob() : Promise.reject(new Error(String(res.status)))))
      .then((blob) => createImageBitmap(blob))
      .then((image) => ({ image, bounds: opaqueBounds(image) }))
      .catch(() => null);
    logos.set(brandId, logo);
  }
  return logo;
}
const BADGE_H = 24;

async function brandBadge(brandId: string): Promise<ImageData | null> {
  const brand = BRANDS.find((item) => item.id === brandId);
  if (!brand) return null;
  const pad = 3;
  try {
    const loaded = brand.icon ? await brandLogo(brand.id) : null;
    const logo = loaded?.image ?? null;
    let width: number;
    let draw: (ctx: CanvasRenderingContext2D, x: number, y: number, w: number) => void;
    if (logo) {
      const bounds = loaded!.bounds;
      const aspect = bounds.w / Math.max(1, bounds.h);
      const inner = BADGE_H - 7;
      const logoW = Math.min(52, Math.max(inner, inner * aspect));
      const logoH = Math.min(inner, logoW / Math.max(aspect, 0.01));
      width = Math.max(BADGE_H, logoW + 9);
      draw = (ctx, x, y, w) => {
        roundRect(ctx, x, y, w, BADGE_H, BADGE_H / 2 > w / 2 - 1 ? w / 2 : 8, WHITE);
        ctx.drawImage(logo!, bounds.x, bounds.y, bounds.w, bounds.h, x + (w - logoW) / 2, y + (BADGE_H - logoH) / 2, logoW, logoH);
      };
    } else {
      const measure = canvasFor(1, 1);
      measure.font = BADGE_FONT;
      width = Math.max(BADGE_H, Math.ceil(measure.measureText(brand.short).width) + 12);
      draw = (ctx, x, y, w) => {
        roundRect(ctx, x, y, w, BADGE_H, w === BADGE_H ? BADGE_H / 2 : 8, WHITE);
        roundRect(ctx, x + 2, y + 2, w - 4, BADGE_H - 4, w === BADGE_H ? (BADGE_H - 4) / 2 : 6.5, brand.color);
        ctx.font = BADGE_FONT;
        ctx.fillStyle = WHITE;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(brand.short, x + w / 2, y + BADGE_H / 2 + 0.5);
      };
    }
    const ctx = canvasFor(width + pad * 2, BADGE_H + pad * 2);
    ctx.save();
    softShadow(ctx);
    roundRect(ctx, pad, pad, width, BADGE_H, 8, WHITE);
    ctx.restore();
    draw(ctx, pad, pad, width);
    return pixels(ctx);
  } catch {
    return null;
  }
}

const PIN_KIND_COLORS: Record<string, string> = {
  shop: '#059669',
  food: '#EA580C',
  school: '#D97706',
  university: '#6366F1',
  landmark: '#7C3AED',
  place: '#0284C7',
  street: '#64748B',
  address: '#2478F2',

  atmin: '#059669',
  atm: '#475569',
};

async function resultPin(what: string, nearest: boolean): Promise<ImageData | null> {
  const brand = what.startsWith('kind:') ? undefined : BRANDS.find((item) => item.id === what);
  const h = 30;
  const pad = 4;
  const tail = 7;
  const loaded = brand?.icon ? await brandLogo(brand.id) : null;
  const logo = loaded?.image ?? null;
  const bounds = loaded?.bounds ?? null;
  const aspect = bounds ? bounds.w / Math.max(1, bounds.h) : 1;
  const inner = h - 10;
  const logoW = bounds ? Math.min(54, Math.max(inner, inner * aspect)) : 0;
  const logoH = bounds ? Math.min(inner, logoW / Math.max(aspect, 0.01)) : 0;
  let width = h;
  if (bounds) width = Math.max(h, logoW + 11);
  else if (brand) {
    const measure = canvasFor(1, 1);
    measure.font = BADGE_FONT;
    width = Math.max(h, Math.ceil(measure.measureText(brand.short).width) + 14);
  }
  const ctx = canvasFor(width + pad * 2, h + tail + pad * 2);
  const x = pad;
  const y = pad;
  const mid = x + width / 2;
  const shape = (grow: number) => {
    ctx.beginPath();
    ctx.roundRect(x - grow, y - grow, width + grow * 2, h + grow * 2, 11 + grow);
    ctx.moveTo(mid - 6 - grow, y + h - 1);
    ctx.lineTo(mid, y + h + tail + grow * 1.4);
    ctx.lineTo(mid + 6 + grow, y + h - 1);
    ctx.closePath();
  };
  ctx.save();
  softShadow(ctx);
  shape(0);
  ctx.fillStyle = nearest ? '#2478F2' : WHITE;
  ctx.fill();
  ctx.restore();
  if (nearest) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x + 2.2, y + 2.2, width - 4.4, h - 4.4, 9);
    ctx.fillStyle = WHITE;
    ctx.fill();
    ctx.restore();
  }
  if (logo && bounds) {
    ctx.drawImage(logo, bounds.x, bounds.y, bounds.w, bounds.h, mid - logoW / 2, y + (h - logoH) / 2, logoW, logoH);
  } else if (brand) {
    roundRect(ctx, x + 3, y + 3, width - 6, h - 6, 8.5, brand.color);
    ctx.font = BADGE_FONT;
    ctx.fillStyle = WHITE;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(brand.short, mid, y + h / 2 + 0.5);
  } else {
    const color = PIN_KIND_COLORS[what.slice(5)] ?? PIN_KIND_COLORS.place;
    dot(ctx, mid, y + h / 2, 10, color);
    dot(ctx, mid, y + h / 2, 3.6, WHITE);
  }
  return pixels(ctx);
}

const BADGE_FONT = '800 11px -apple-system, BlinkMacSystemFont, "Inter Variable", "Segoe UI", Roboto, sans-serif';

function opaqueBounds(image: ImageBitmap) {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(image, 0, 0);
  const { data } = ctx.getImageData(0, 0, image.width, image.height);
  let x0 = image.width;
  let y0 = image.height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      if (data[(y * image.width + x) * 4 + 3] > 16) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? { x: 0, y: 0, w: image.width, h: image.height } : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

export const tagId = (mode: Mode, line: string) => `vehicle-tag|${mode}|${line}`;

export function provideVehicleIcon(map: MapLibre, id: string) {
  if (map.hasImage(id)) return;
  const [kind, mode, ...line] = id.split('|') as [string, Mode, ...string[]];
  const add = (image: ImageData) => map.addImage(id, image, { pixelRatio: RATIO });
  if (kind === 'vehicle-tag') add(tag(mode, line.join('|')));
  else if (kind === 'vehicle-pin') add(pin(mode));
  else if (kind === 'vehicle-glyph') add(glyph(mode));
  else if (kind === 'vehicle-dot') add(miniDot(mode));
  else if (kind === 'stop') add(stopSign(mode));
  else if (kind === 'stop-mini') add(stopMini(mode));
  else if (kind === 'fuel-pin') add(fuelPin());
  else if (kind === 'charger-pin') add(chargerPin(mode));
  else if (kind === 'road-sign') add(roadSign(mode));
  else if (kind === 'heart-pin') add(heartPin());
  else if (kind === 'airport-pin') add(airportPin());
  else if (kind === 'search-pin') add(searchPin());
  else if (kind === 'brand') addWhenDrawn(map, id, () => brandBadge(mode));
  else if (kind === 'result-pin') addWhenDrawn(map, id, () => resultPin(mode, line[0] === 'near'));
  else if (kind === 'report') add(reportPin(mode));
  else if (kind === 'landmark') addWhenDrawn(map, id, () => landmarkIcon(mode));
}
