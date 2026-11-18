import type { Journey, Network } from './raptor';
import { legStops } from './trip';

const TICKET_ZONE = /^([A-Z]|\d{1,2}|FÖLI)$/;

export function journeyZones(network: Network, journey: Journey): string | null {
  const zones = new Set<string>();
  for (const leg of journey.legs) {
    for (const { stop } of legStops(network, leg)) {
      const zone = network.stops[stop].zone;
      if (TICKET_ZONE.test(zone)) zones.add(zone);
    }
  }
  if (!zones.size) return null;
  const list = [...zones];
  if (list.every((zone) => /^[A-Z]$/.test(zone))) {
    const codes = list.map((zone) => zone.charCodeAt(0));
    const [low, high] = [Math.min(...codes), Math.max(...codes)];
    return Array.from({ length: high - low + 1 }, (_, i) => String.fromCharCode(low + i)).join('');
  }
  if (list.every((zone) => /^\d+$/.test(zone))) {
    const numbers = list.map(Number);
    const [low, high] = [Math.min(...numbers), Math.max(...numbers)];
    return low === high ? String(low) : `${low}–${high}`;
  }
  return list.sort().join(', ');
}
