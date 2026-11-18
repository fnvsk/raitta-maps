import { describe, expect, it } from 'vitest';
import { mergeCoupled, parseHsl } from './live';

const unit = (veh: number, lat: number, start = '10:02') =>
  parseHsl(
    `/hfp/v2/journey/ongoing/vp/metro/0050/0${veh}/31M1/1/Vuosaari/${start}/1020602/4/60;24/19/54/63`,
    JSON.stringify({ VP: { desi: 'M1', veh, oper: 50, lat, long: 24.95, hdg: 90, spd: 10, dl: 0 } }),
  )!;

describe('coupled metro units', () => {
  it('shows a two-unit train once, in its middle', () => {
    const merged = mergeCoupled([unit(115, 60.17), unit(116, 60.1704)]);
    expect(merged).toHaveLength(1);
    expect(merged[0].lat).toBeCloseTo(60.1702, 5);
  });

  it('keeps different trains apart', () => {
    expect(mergeCoupled([unit(115, 60.17), unit(116, 60.17, '10:06')])).toHaveLength(2);
    expect(mergeCoupled([unit(115, 60.17), unit(116, 60.2)])).toHaveLength(2);
  });
});
