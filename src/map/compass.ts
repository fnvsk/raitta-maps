let heading: number | null = null;
let listening = 0;
const listeners = new Set<(heading: number) => void>();

interface CompassEvent extends DeviceOrientationEvent {
  webkitCompassHeading?: number;
}

function onOrientation(event: CompassEvent) {
  let value: number | null = null;
  if (typeof event.webkitCompassHeading === 'number') value = event.webkitCompassHeading;
  else if (event.absolute && typeof event.alpha === 'number') value = (360 - event.alpha) % 360;
  if (value === null || Number.isNaN(value)) return;

  const screen = (window.screen.orientation?.angle ?? 0) % 360;
  heading = (value + screen + 360) % 360;
  for (const listener of listeners) listener(heading);
}

export async function askCompass() {
  const request = (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission;
  if (typeof request === 'function') await request().catch(() => 'denied');
}

export function watchCompass(listener: (heading: number) => void) {
  listeners.add(listener);
  if (listening++ === 0) {
    window.addEventListener('deviceorientationabsolute', onOrientation as EventListener);
    window.addEventListener('deviceorientation', onOrientation as EventListener);
  }
  return () => {
    listeners.delete(listener);
    if (--listening === 0) {
      window.removeEventListener('deviceorientationabsolute', onOrientation as EventListener);
      window.removeEventListener('deviceorientation', onOrientation as EventListener);
    }
  };
}

export const compassHeading = () => heading;
