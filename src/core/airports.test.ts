import { describe, expect, it } from 'vitest';
import { parseFinavia } from './airports';

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<flights xmlns="http://www.finavia.fi/FlightsService.xsd"><arr><header><timestamp>2026-11-08T20:29:00Z</timestamp></header><body>
<flight><h_apt>HEL</h_apt><fltnr>SK1706</fltnr><sdt>2026-11-08T08:30:00Z</sdt><route_1>CPH</route_1><route_2/><route_n_1>Copenhagen</route_n_1><route_n_2/><route_n_fi_1>Kööpenhamina</route_n_fi_1><gate>16</gate><prm>LAN</prm><prt>Landed</prt><prt_f>Laskeutunut</prt_f><prt_s>Landat</prt_s><est_d>2026-11-08T08:17:00Z</est_d><act_d>2026-11-08T08:17:00Z</act_d><bltarea>2A</bltarea></flight>
<flight><h_apt>HEL</h_apt><fltnr>AY421</fltnr><sdt>2026-11-08T07:10:00Z</sdt><route_1>KTT</route_1><route_2>IVL</route_2><route_n_1>Kittilä</route_n_1><route_n_2>Ivalo</route_n_2><prm/><prt/><est_d/><act_d/></flight>
<flight><h_apt>HEL</h_apt><fltnr>AY1000</fltnr><sdt>2026-11-08T09:00:00Z</sdt><route_1>ARN</route_1><route_n_1>Stockholm &amp; more</route_n_1><prm>CNL</prm><prt>Cancelled</prt></flight>
</body></arr></flights>`;

describe('Finavia flights', () => {
  it('reads each flight, soonest first, in the reader’s language', () => {
    const { updated, flights } = parseFinavia(XML, 'fi');
    expect(updated).toBe(Date.parse('2026-11-08T20:29:00Z'));
    expect(flights.map((f) => f.number)).toEqual(['AY 421', 'SK 1706', 'AY 1000']);
    const [stops, landed, cancelled] = flights;
    expect(stops).toMatchObject({ place: 'Kittilä – Ivalo', placeCode: undefined, expected: undefined, state: undefined });
    expect(landed).toMatchObject({ place: 'Kööpenhamina', placeCode: 'CPH', gate: '16', belt: '2A', state: 'landed', status: 'Laskeutunut', expected: Date.parse('2026-11-08T08:17:00Z') });
    expect(cancelled).toMatchObject({ place: 'Stockholm & more', state: 'cancelled' });
  });

  it('names places in English for other readers', () => {
    expect(parseFinavia(XML, 'ru').flights[1]).toMatchObject({ place: 'Copenhagen', status: 'Landed' });
  });
});
