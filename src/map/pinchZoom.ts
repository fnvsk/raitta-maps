import type { LngLat, Map as MapLibre } from 'maplibre-gl';

const SENSITIVITY = 1.8;

const ROTATE_THRESHOLD_DEG = 12;
const MAX_GLIDE_LEVELS = 1;
const GLIDE_LOOKAHEAD_MS = 200;
const GLIDE_MS = 320;

export const pinchZoomLevel = (startZoom: number, startDistance: number, distance: number) =>
  startZoom + Math.log2(distance / startDistance) * SENSITIVITY;

interface Fingers {
  x: number;
  y: number;
  distance: number;
  angle: number;
}

interface Pinch {
  startZoom: number;
  startBearing: number;
  startDistance: number;
  startAngle: number;
  anchor: LngLat;
  lastZoom: number;
  lastTime: number;
  velocity: number;
}

export interface PinchZoom {
  isActive: () => boolean;
  remove: () => void;
}

export function installPinchZoom(map: MapLibre, canRotate: () => boolean, onTurn?: () => void): PinchZoom {
  const element = map.getCanvasContainer();
  let pinch: Pinch | null = null;
  let latest: Fingers | null = null;
  let frame = 0;

  const read = (e: TouchEvent): Fingers => {
    const box = element.getBoundingClientRect();
    const [a, b] = [e.touches[0], e.touches[1]];
    return {
      x: (a.clientX + b.clientX) / 2 - box.left,
      y: (a.clientY + b.clientY) / 2 - box.top,
      distance: Math.max(1, Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)),
      angle: (Math.atan2(b.clientY - a.clientY, b.clientX - a.clientX) * 180) / Math.PI,
    };
  };

  const apply = (time: number) => {
    frame = 0;
    if (!pinch || !latest) return;
    const { x, y, distance, angle } = latest;
    const zoom = Math.min(map.getMaxZoom(), Math.max(map.getMinZoom(), pinchZoomLevel(pinch.startZoom, pinch.startDistance, distance)));

    let turned = ((angle - pinch.startAngle + 540) % 360) - 180;
    if (!canRotate() || Math.abs(turned) < ROTATE_THRESHOLD_DEG) turned = 0;
    else onTurn?.();
    map.jumpTo({ zoom, bearing: pinch.startBearing - turned });

    const anchor = map.project(pinch.anchor);
    const center = map.project(map.getCenter());
    map.jumpTo({ center: map.unproject([center.x + anchor.x - x, center.y + anchor.y - y]) });

    const elapsed = time - pinch.lastTime;
    if (elapsed > 0) pinch.velocity = (zoom - pinch.lastZoom) / elapsed;
    pinch.lastZoom = zoom;
    pinch.lastTime = time;
  };

  const onStart = (e: TouchEvent) => {
    if (e.touches.length !== 2 || pinch) return;
    map.stop();
    
    map.dragPan.disable();
    const fingers = read(e);
    pinch = {
      startZoom: map.getZoom(),
      startBearing: map.getBearing(),
      startDistance: fingers.distance,
      startAngle: fingers.angle,
      anchor: map.unproject([fingers.x, fingers.y]),
      lastZoom: map.getZoom(),
      lastTime: performance.now(),
      velocity: 0,
    };
  };

  const onMove = (e: TouchEvent) => {
    if (!pinch || e.touches.length < 2) return;
    e.preventDefault();
    latest = read(e);
    if (!frame) frame = requestAnimationFrame(apply);
  };

  const onEnd = (e: TouchEvent) => {
    if (!pinch || e.touches.length >= 2) return;
    cancelAnimationFrame(frame);
    frame = 0;
    const { velocity, anchor } = pinch;
    pinch = null;
    latest = null;
    map.dragPan.enable();
    const glide = Math.max(-MAX_GLIDE_LEVELS, Math.min(MAX_GLIDE_LEVELS, velocity * GLIDE_LOOKAHEAD_MS));
    map.easeTo(
      { zoom: map.getZoom() + glide, around: anchor, duration: GLIDE_MS, easing: (t) => 1 - (1 - t) ** 3 },
      { originalEvent: e },
    );
  };

  element.addEventListener('touchstart', onStart, { passive: true });
  element.addEventListener('touchmove', onMove, { passive: false });
  element.addEventListener('touchend', onEnd);
  element.addEventListener('touchcancel', onEnd);

  return {
    isActive: () => pinch !== null,
    remove: () => {
      cancelAnimationFrame(frame);
      element.removeEventListener('touchstart', onStart);
      element.removeEventListener('touchmove', onMove);
      element.removeEventListener('touchend', onEnd);
      element.removeEventListener('touchcancel', onEnd);
    },
  };
}
