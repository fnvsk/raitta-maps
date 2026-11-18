import { AIRPORTS } from './airports';
import { inLanguage, type Landmark } from './landmarks';
import { SIGHTS } from './sights';
import { schemeLayout, type Point, type SchemeNetwork } from './scheme';

export type Side = 'N' | 'S' | 'E' | 'W' | 'NE' | 'NW' | 'SE' | 'SW';
type Dir = Side;

export type PlaceKind = 'airport' | 'train' | 'metro' | 'bus' | 'ferry' | 'hospital' | 'university' | 'stadium';

interface Leg {
  dir: Dir;

  stations: (string | [string, Side])[];
  side?: Side;
}

interface Track {
  from: string;
  at?: [number, number];
  fromSide?: Side;
  legs: Leg[];
}

export interface HandScheme {
  mode: SchemeNetwork['mode'];
  tracks: Track[];

  places?: Record<string, PlaceKind[]>;

  cells?: Record<string, [number, number] | [number, number, Side]>;

  scale?: number;

  water?: Water[];
}

export type Water = { area: [number, number][] } | { river: [number, number][]; width: number };

const STEP: Record<Dir, [number, number]> = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0], NE: [1, -1], NW: [-1, -1], SE: [1, 1], SW: [-1, 1] };

export const HAND_SCHEMES: Record<string, HandScheme> = {
  'tampere:tram': {
    mode: 'tram',
    water: [
      {
        area: [
          [-60, -60], [9, -60], [7.2, -8], [6.3, -4.6], [5.6, -3.4], [4.6, -2.75], [3.4, -2.45], [2.75, -1.95],
          [2.25, -1.95], [1.4, -1.85], [0.4, -2.15], [-0.3, -1.85], [-0.75, -1.45], [-1.35, -1.6], [-1.7, -2.15],
          [-2.4, -2.55], [-2.9, -2.2], [-3.3, -2.3], [-3.8, -2.22], [-4.3, -2.35], [-4.6, -2.45], [-5.4, -2.6],
          [-6.5, -2.55], [-7.4, -2.6], [-8.3, -2.75], [-9.4, -2.6], [-10.3, -2.55], [-11.4, -2.75], [-60, -2.8],
        ],
      },
      {
        area: [
          [-60, -0.35], [-10.5, -0.55], [-8.6, -0.4], [-6.8, -0.5], [-5.2, -0.2], [-3.6, 0.15], [-2.2, 0.55],
          [-1, 0.95], [0.2, 1.25], [1.3, 1.45], [2.2, 1.55], [2.75, 1.7], [2.7, 2.4], [3.2, 3.1], [3.5, 4.3],
          [3.3, 5.6], [3.1, 7.5], [2.6, 10], [2.2, 14], [1.5, 60], [-60, 60],
        ],
      },
      { river: [[2.5, -1.95], [2.55, -1], [2.45, 0], [2.5, 1.6]], width: 0.3 },

      { area: [[8.1, 3.6], [8.9, 3.9], [9.1, 4.7], [8.5, 5.1], [7.9, 4.6]] },
      { area: [[10.7, 11.4], [12, 11.2], [12.6, 12.2], [11.9, 13], [10.8, 12.7]] },
    ],
    tracks: [
      {
        from: 'Pyhällönpuisto',
        at: [-9, -2],
        fromSide: 'S',
        legs: [
          {
            dir: 'E',
            stations: [
              ['Lentävänniemi', 'N'],
              ['Niemenranta', 'S'],
              ['Niemen kartano', 'N'],
              ['Tehdas', 'S'],
              ['Hiedanranta', 'N'],
              ['Santalahti', 'S'],
              ['Tikkutehdas', 'N'],
            ],
          },
          { dir: 'SE', stations: [['Särkänniemi', 'NE'], ['Pyynikintori', 'S']] },
          {
            dir: 'E',
            stations: [
              ['Tuulensuu', 'N'],
              ['Keskustori', 'S'],
              ['Koskipuisto', 'N'],
              ['Rautatieasema', 'S'],
              ['Tulli', 'N'],
              ['Sammonaukio', 'E'],
            ],
          },
          { dir: 'NE', side: 'E', stations: ['Kalevan kirkko', 'Hippos', ['TAYS', 'W']] },
          { dir: 'E', stations: [['Kaupin kampus', 'N']] },
        ],
      },
      { from: 'Koskipuisto', legs: [{ dir: 'S', side: 'E', stations: ['Sorin aukio'] }] },
      {
        from: 'Sammonaukio',
        legs: [
          { dir: 'SE', side: 'E', stations: ['Kaleva', 'Uintikeskus', 'Kalevanrinne', 'Hakametsä'] },
          { dir: 'S', side: 'E', stations: ['Turtola', 'Hallila', 'Pohjois-Hervanta', 'Opiskelija', 'Hervantakeskus', 'Hervannan kampus', 'Etelä-Hervanta', 'Hervantajärvi'] },
        ],
      },
    ],
    places: {
      Rautatieasema: ['train'],
      TAYS: ['hospital'],
      'Kaupin kampus': ['university'],
      'Hervannan kampus': ['university'],
      Hippos: ['stadium'],
    },
  },

  'helsinki:train': {
    mode: 'train',
    water: [
      { area: [[7, 0.7], [0.6, 0.7], [-0.9, -0.2], [-2.6, -1.5], [-6, -2.25], [-12.6, -2.25], [-16.6, 1.4], [-19.5, 2.1], [-60, 2.6], [-60, 60], [60, 60], [60, 1]] },

      { area: [[8.6, -19.6], [10.4, -20.6], [11.2, -19.2], [9.4, -18.5]] },
      { area: [[2.6, -15.3], [3.4, -15.3], [3.5, -17.2], [2.8, -17.6], [2.4, -16.4]] },
    ],
    tracks: [
      {
        from: 'Helsinki',
        at: [0, 0],
        fromSide: 'E',
        legs: [
          { dir: 'N', side: 'E', stations: ['Pasila', 'Käpylä', 'Oulunkylä', 'Pukinmäki', 'Malmi'] },
          { dir: 'NE', side: 'E', stations: ['Tapanila', 'Puistola', 'Tikkurila', 'Hiekkaharju'] },
          { dir: 'N', side: 'E', stations: ['Koivukylä', 'Rekola', 'Korso', 'Savio', ['Kerava', 'W']] },
          { dir: 'N', side: 'W', stations: ['Ainola', 'Järvenpää', 'Saunakallio', 'Jokela', 'Hyvinkää', 'Riihimäki'] },
        ],
      },
      {
        from: 'Kerava',
        legs: [
          { dir: 'NE', side: 'E', stations: ['Haarajoki', 'Mäntsälä', 'Henna'] },
          { dir: 'N', side: 'E', stations: ['Lahti'] },
        ],
      },
      { from: 'Pasila', legs: [{ dir: 'NW', stations: [['Ilmala', 'SW'], ['Huopalahti', 'NE']] }] },
      {
        from: 'Huopalahti',
        legs: [
          {
            dir: 'W',
            stations: [
              ['Valimo', 'S'],
              ['Pitäjänmäki', 'N'],
              ['Mäkkylä', 'S'],
              ['Leppävaara', 'N'],
              ['Kilo', 'S'],
              ['Kera', 'N'],
              ['Kauniainen', 'S'],
              ['Koivuhovi', 'N'],
              ['Tuomarila', 'S'],
              ['Espoo', 'N'],
              ['Kauklahti', 'N'],
            ],
          },
          { dir: 'SW', side: 'E', stations: ['Masala', 'Jorvas', 'Tolsa', 'Kirkkonummi'] },
          { dir: 'W', stations: [['Siuntio', 'N']] },
        ],
      },
      {
        from: 'Huopalahti',
        legs: [
          { dir: 'N', side: 'W', stations: ['Pohjois-Haaga', 'Kannelmäki', 'Malminkartano', 'Myyrmäki', 'Louhela', 'Martinlaakso', 'Vantaankoski'] },
          { dir: 'NE', stations: [['Vehkala', 'NW']] },
          { dir: 'E', stations: [['Kivistö', 'N'], ['Aviapolis', 'S'], ['Lentoasema', 'N']] },
          { dir: 'SE', stations: [['Leinelä', 'SW']] },
        ],
      },
    ],
    places: {
      Helsinki: ['train', 'metro'],
      Pasila: ['train'],
      Tikkurila: ['train'],
      Riihimäki: ['train'],
      Lahti: ['train'],
    },
  },

  'helsinki:tram': {
    mode: 'tram',
    water: [
      {
        area: [
          [-60, -1.6], [-7.6, -1.6], [-7.7, 1.6], [-7.6, 3.7], [-6.1, 4.35], [-4.7, 4.2], [-3.9, 4.8], [-3.9, 6.1],
          [-2.9, 6.85], [-1, 7.05], [0.8, 6.6], [2.1, 5.9], [3.6, 4.95], [3.85, 3.4], [3.65, 1.6], [4.3, 1.45],
          [6.2, 1.5], [7.6, 1.65], [9.4, 1.35], [10.1, 0.6], [10.15, -0.25], [9.4, -0.5], [5.7, -0.45], [5.45, -0.68],
          [9.4, -0.82], [10.55, -1.05], [10.3, -1.7], [9.7, -2.3], [9.7, -3.5], [10.05, -4.3], [10.5, -4.3],
          [10.6, -3.5], [10.6, -2.45], [11.4, -2.45], [11.45, -4.3], [11.78, -4.3], [11.8, -2.3], [12.4, -1.3],
          [13.6, -0.35], [14.6, 0.15], [60, 0], [60, 60], [-60, 60],
        ],
      },
      { area: [[0.55, -4.2], [0.85, -5.25], [1.55, -5.4], [1.8, -4.65], [1.3, -4.1]] },
    ],
    tracks: [],
    cells: {
      'Ylioppilastalo': [0, 0],
      'Lasipalatsi': [0, -2],
      'Kansallismuseo': [0, -3],
      'Hesperian puisto': [0, -4],
      'Ooppera': [0, -5],
      'Ruusulankatu': [-1, -5],
      'Töölön halli': [-1, -6],
      'Kansaneläkelaitos': [-2, -7],
      'Töölöntulli': [-3, -8, 'SW'],
      'Auroran sairaala': [-2, -8],
      'Meilahden sairaala': [-5, -8, 'N'],
      'Meilahdentie': [-6, -8, 'S'],
      'Paciuksenkaari': [-7, -8, 'N'],
      'Munkkin. puistotie': [-8, -8, 'S'],
      'Laajalahden aukio': [-9, -8, 'N'],
      'Tiilimäki': [-10, -8, 'S'],
      'Saunalahdentie': [-11, -8, 'N'],
      'Jalavatie': [-3, -9],
      'Kuusitie': [-3, -10],
      'Tilkka': [-3, -11],
      'Ruskeasuo': [-3, -12],
      'Kytösuontie': [-3, -13],
      'Haapalahdenkatu': [-3, -14],
      'Korppaanmäki': [-3, -15],
      'Eläintarha': [-1, -9],
      'Karjalankatu': [0, -9],
      'Linnanmäki (pohj.)': [1, -9],
      'Alppila': [2, -8],
      'Urheilutalo': [3, -7],
      'Kaupunginpuutarha': [1, -6],
      'Linnanmäki (etelä)': [2, -7],
      'Kaarlenkatu': [3, -6],
      'Karhupuisto': [4, -6],
      'Helsinginkatu': [5, -7],
      'Fleminginkatu': [5, -8],
      'Kallion virastotalo': [4, -5],
      'Hakaniemi': [4, -4],
      'Haapaniemi': [5, -5],
      'Lintulahti': [6, -6],
      'Sörnäinen (M)': [7, -7],
      'Päärautatieasema': [1, -1],
      'Mikonkatu': [2, -1],
      'Aleksanterinkatu': [2, 0],
      'Senaatintori': [3, 0],
      'Kaisaniemenkatu': [2, -2],
      'Rautatientori': [1, -3],
      'Kaisaniemenpuisto': [3, -3],
      'Hakaniemi (M)': [4, -3],
      'Hallituskatu': [4, -1],
      'Kansallisarkisto': [5, -2],
      'Snellmaninkatu': [5, -4],
      'Merihaka': [7, -3],
      'Nihti': [9, -3],
      'Korkeasaari': [11, -3],
      'Kruunuvuori': [12, -3],
      'Hopealaakso': [13, -3],
      'Gunillankallio': [14, -3],
      'Reiherintie': [15, -3],
      'Yliskylänkulma': [16, -3],
      'Yliskylän keskusta': [17, -3],
      'Haakoninlahdenpuisto': [13, -2],
      'Koirasaaret': [13, -1],
      'Sompasaari': [11, -5],
      'Polariksenkatu': [11, -6],
      'Kalasatama/Leonkatu': [11, -7],
      'Vanha talvitie': [11, -10],
      'Sörnäistenkatu': [10, -11],
      'Haukilahdenkatu': [9, -12],
      'Nylanderinpuisto': [6, -12],
      'Lautatarhankatu': [7, -8],
      'Vallilan kirjasto': [6, -9],
      'Hattulantie': [5, -10],
      'Mäkelänrinne': [4, -11],
      'Velodromi': [3, -12, 'NE'],
      'Hauhon puisto': [8, -9],
      'Vallilan varikko': [8, -10],
      'Paavalinkirkko': [8, -11],
      'Kumpulan kampus': [8, -13],
      'Kumtähdenkenttä': [8, -14],
      'Arabiankatu': [9, -15],
      'Arabianranta': [10, -16],
      'Koskelantie': [3, -13],
      'Kimmontie': [3, -14],
      'Käpylänaukio': [3, -15],
      'Metsolantie': [4, -16],
      'Pohjolanaukio': [5, -17],
      'Sturenkatu': [4, -9],
      'Kotkankatu': [3, -10],
      'Pasilan konepaja': [2, -11, 'W'],
      'Jämsänkatu': [2, -12, 'W'],
      'Asemapäällikönkatu': [2, -13, 'SW'],
      'Messukeskus': [1, -14],
      'Pasilan asema': [0, -13],
      'Palkkatilanportti': [-1, -12],
      'Esterinportti': [-1, -14],
      'Maistraatintori': [-2, -13],
      'Eevanmäki': [-1, -15],
      'Uutiskatu': [-1, -16],
      'Ilmalantori': [-1, -17],
      'Simonkatu': [-1, -1],
      'Kampintori': [-2, -1],
      'Ruoholahden villat': [-3, -1],
      'Itämerenkatu': [-4, -1],
      'Ruoholahti (M)': [-5, -1],
      'Kaapelitehdas': [-6, -1],
      'Crusellinsilta': [-6, 0],
      'Saukonkatu': [-6, 1],
      'Kanariankatu': [-6, 2],
      'Tahitinkatu': [-7, 3],
      'Länsilinkki': [-4, 0],
      'Huutokonttori': [-4, 1],
      'Välimerenkatu': [-5, 1],
      'Bunkkerinaukio': [-4, 2],
      'Länsiterminaali 2': [-5, 3],
      'Erottaja': [0, 1],
      'Fredrikinkatu': [0, 2],
      'Iso Roobertinkatu': [0, 3],
      'Viiskulma': [0, 4],
      'Eiran sairaala': [0, 5],
      'Perämiehenkatu': [-1, 6],
      'Telakkakatu': [-2, 6],
      'Kapteeninkatu': [1, 5],
      'Neitsytpolku': [2, 5],
      'Kaivopuisto': [3, 4],
      'Olympiaterminaali': [3, 3, 'E'],
      'Eteläranta': [3, 2],
      'Kauppatori': [3, 1],
      'Aleksant. teatteri': [-1, 2],
      'Hietalahdentori': [-2, 2],
      'Telakanpuistikko': [-3, 3],
      'Munkkisaari': [-3, 4],
      'Eiranranta': [-3, 5, 'W'],
      'Kolmikulma': [1, 1],
      'Johanneksenkirkko': [1, 2],
      'Tarkk´ampujankatu': [1, 3, 'E'],
      'Ritarihuone': [4, 0],
      'Tove Janssonin p.': [5, 0],
      'Kauppiaankatu': [6, 0],
      'Vyökatu': [7, 0],
      'Ulkoministeriö': [8, 0],
      'Merisotilaantori': [9, 0],
      'Katajanokan term.': [7, 1],
      'Keilaniemi (M)': [-13, -5],
      'Otaranta': [-13, -6],
      'Aalto-yliopisto (M)': [-13, -7],
      'Maari': [-13, -8],
      'Lahdenpohja': [-13, -9],
      'Laajalahti': [-13, -10],
      'Linnoitustie': [-13, -11],
      'Alberganesplanadi': [-13, -12],
      'Leppävaaran asema': [-12, -13],
      'Perkkaa': [-11, -14],
      'Vermo': [-10, -15],
      'Ravitie': [-9, -16],
      'Talin siirt.puutarha': [-8, -17],
      'Takomotie': [-7, -18],
      'Kutomotie': [-6, -18],
      'Vihdintie': [-5, -18],
      'Huopalahden asema': [-4, -18],
      'Ilkantie': [-3, -18],
      'Hämeenlinnanväylä': [-2, -18],
      'Pirkkola': [-1, -18],
      'Pirjontie': [0, -18],
      'Maunula': [1, -18],
      'Kustaankartano': [2, -18],
      'Teininpuisto': [3, -18],
      'Oulunkylän keskusta': [4, -18],
      'Oulunkylän asema': [5, -18],
      'Veräjämäki': [6, -18],
      'Viikinmäki': [7, -18],
      'Viikin tiedepuisto': [8, -18],
      'Latokartano': [9, -18],
      'Karhukallio': [10, -17],
      'Kauppamyllyntie': [11, -16],
      'Roihupelto': [12, -15],
      'Itäkeskus (M)': [13, -14],
    },
  },
  'helsinki:metro': {
    mode: 'metro',
    water: [
      { area: [[-60, 1], [5, 0.75], [6.4, 0.1], [8, -1.6], [10, -2.35], [13, -2.4], [17, -2.3], [21, -2.35], [22.6, -1.6], [24.3, 0.15], [27.5, 0.2], [60, 0.5], [60, 60], [-60, 60]] },
      { river: [[10.5, -2.4], [10.5, -4.3]], width: 0.32 },
      { river: [[11.5, -2.4], [11.6, -3.6]], width: 0.28 },
      { river: [[12.5, -2.4], [12.5, -4.2]], width: 0.32 },
      { river: [[19.5, -2.4], [19.5, -4.4]], width: 0.32 },
      { river: [[20.5, -2.4], [20.4, -4]], width: 0.28 },
      { river: [[25.5, -1.9], [25.5, -0.1]], width: 0.3 },
    ],
    tracks: [
      {
        from: 'Kivenlahti',
        at: [0, 0],
        fromSide: 'N',
        legs: [
          { dir: 'E', stations: [['Espoonlahti', 'S'], ['Soukka', 'N'], ['Kaitaa', 'S'], ['Finnoo', 'N'], ['Matinkylä', 'S']] },
          { dir: 'NE', side: 'E', stations: ['Niittykumpu', 'Urheilupuisto', ['Tapiola', 'N']] },
          {
            dir: 'E',
            stations: [
              ['Aalto-yliopisto', 'S'],
              ['Keilaniemi', 'N'],
              ['Koivusaari', 'S'],
              ['Lauttasaari', 'N'],
              ['Ruoholahti', 'S'],
              ['Kamppi', 'N'],
              ['Rautatientori', 'S'],
              ['Helsingin yliopisto', 'N'],
              ['Hakaniemi', 'S'],
              ['Sörnäinen', 'N'],
              ['Kalasatama', 'S'],
              ['Kulosaari', 'N'],
              ['Herttoniemi', 'S'],
              ['Siilitie', 'N'],
              ['Itäkeskus', 'SW'],
            ],
          },
          { dir: 'SE', stations: [['Puotila', 'E'], ['Rastila', 'S']] },
          { dir: 'E', stations: [['Vuosaari', 'S']] },
        ],
      },
      {
        from: 'Itäkeskus',
        legs: [
          { dir: 'NE', stations: [['Myllypuro', 'E'], ['Kontula', 'N']] },
          { dir: 'E', stations: [['Mellunmäki', 'N']] },
        ],
      },
    ],
    places: {
      Rautatientori: ['train'],
      Kamppi: ['bus'],
      Tapiola: ['bus'],
      Matinkylä: ['bus'],
      Itäkeskus: ['bus'],
      'Aalto-yliopisto': ['university'],
      'Helsingin yliopisto': ['university'],
      Urheilupuisto: ['stadium'],
    },
  },
};

function drawingCells(hand: HandScheme) {
  const cells = new Map<string, Point>();
  const sides = new Map<string, Side>();
  for (const track of hand.tracks) {
    let at = track.at ?? cells.get(track.from);
    if (!at) continue;
    if (track.at) {
      cells.set(track.from, at);
      if (track.fromSide) sides.set(track.from, track.fromSide);
    }
    for (const leg of track.legs) {
      const [dx, dy] = STEP[leg.dir];
      leg.stations.forEach((entry, i) => {
        const [name, side] = typeof entry === 'string' ? [entry, undefined] : entry;
        at = [at![0] + dx, at![1] + dy];
        cells.set(name, at);
        sides.set(name, side ?? leg.side ?? (leg.dir === 'E' || leg.dir === 'W' ? (i % 2 ? 'N' : 'S') : 'E'));
      });
    }
  }
  for (const [name, [x, y, side]] of Object.entries(hand.cells ?? {})) {
    cells.set(name, [x, y]);
    if (side) sides.set(name, side);
  }
  return { cells, sides };
}

export function handLayout(hand: HandScheme, network: SchemeNetwork, step: number): { pos: Record<string, Point>; sides: Record<string, Side> } | null {
  if (hand.mode !== network.mode) return null;
  const { cells, sides } = drawingCells(hand);
  const byName = new Map(network.stations.map((s) => [s.name, s.id]));
  const pos: Record<string, Point> = {};
  const idSides: Record<string, Side> = {};
  let known = 0;
  for (const [name, cell] of cells) {
    const id = byName.get(name);
    if (!id) continue;
    known++;
    pos[id] = [cell[0] * step * (hand.scale ?? 1), cell[1] * step * (hand.scale ?? 1)];
    idSides[id] = sides.get(name)!;
  }

  if (known < cells.size * 0.75 || known < network.stations.length * 0.75) return null;

  for (let pass = 0; pass < 4 && network.stations.some((s) => !pos[s.id]); pass++) {
    for (const line of network.lines) {
      for (const run of network.runs[line] ?? []) {
        for (let i = 0; i < run.length; i++) {
          if (pos[run[i]]) continue;
          let a = i - 1;
          while (a >= 0 && !pos[run[a]]) a--;
          let b = i + 1;
          while (b < run.length && !pos[run[b]]) b++;
          if (a >= 0 && b < run.length) {
            const t = (i - a) / (b - a);
            pos[run[i]] = [pos[run[a]][0] + (pos[run[b]][0] - pos[run[a]][0]) * t, pos[run[a]][1] + (pos[run[b]][1] - pos[run[a]][1]) * t];
          } else if (a >= 1 && pos[run[a - 1]]) {
            const d: Point = [pos[run[a]][0] - pos[run[a - 1]][0], pos[run[a]][1] - pos[run[a - 1]][1]];
            pos[run[i]] = [pos[run[a]][0] + d[0] * (i - a), pos[run[a]][1] + d[1] * (i - a)];
          } else if (b < run.length - 1 && pos[run[b + 1]]) {
            const d: Point = [pos[run[b]][0] - pos[run[b + 1]][0], pos[run[b]][1] - pos[run[b + 1]][1]];
            pos[run[i]] = [pos[run[b]][0] + d[0] * (b - i), pos[run[b]][1] + d[1] * (b - i)];
          }
        }
      }
    }
  }
  if (network.stations.some((s) => !pos[s.id])) return null;
  return { pos, sides: idSides };
}

export interface SchemeLayout {
  pos: Record<string, Point>;

  sides: Record<string, Side>;

  kinds: Record<string, PlaceKind[]>;

  water: { areas: Point[][]; rivers: { path: Point[]; width: number }[] };
}

export const SCHEME_STEP = 78;

const AIRPORT_M = 1500;

const metres = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) =>
  Math.hypot((a.lat - b.lat) * 111_320, (a.lon - b.lon) * 111_320 * Math.cos((a.lat * Math.PI) / 180));

function kindsByName(name: string, mode: SchemeNetwork['mode']): PlaceKind[] {
  const out: PlaceKind[] = [];
  if (mode !== 'metro' && /\(M\)$/.test(name)) out.push('metro');
  if (mode !== 'train' && /(^|\s)(rautatieasema|päärautatieasema|rautatientori)$|\S+n asema$/i.test(name)) out.push('train');
  if (/sairaala$/i.test(name)) out.push('hospital');
  if (/kampus$|yliopisto/i.test(name)) out.push('university');
  if (/terminaali|term\.$/i.test(name)) out.push('ferry');
  return out;
}

export function schemeFor(network: SchemeNetwork): SchemeLayout {
  let layout: Pick<SchemeLayout, 'pos' | 'sides'> | null = null;
  let places: Record<string, PlaceKind[]> = {};
  let water: SchemeLayout['water'] = { areas: [], rivers: [] };
  for (const hand of Object.values(HAND_SCHEMES)) {
    layout = handLayout(hand, network, SCHEME_STEP);
    if (layout) {
      places = hand.places ?? {};
      const unit = SCHEME_STEP * (hand.scale ?? 1);
      const at = (p: [number, number]): Point => [p[0] * unit, p[1] * unit];
      water = {
        areas: (hand.water ?? []).flatMap((w) => ('area' in w ? [w.area.map(at)] : [])),
        rivers: (hand.water ?? []).flatMap((w) => ('river' in w ? [{ path: w.river.map(at), width: w.width * unit }] : [])),
      };
      break;
    }
  }
  layout ??= { pos: schemeLayout(network, SCHEME_STEP), sides: {} };
  const kinds: Record<string, PlaceKind[]> = {};
  for (const station of network.stations) {
    const list = [...(places[station.name] ?? []), ...kindsByName(station.name, network.mode)];
    if (list.length) kinds[station.id] = [...new Set(list)];
  }

  for (const airport of AIRPORTS) {
    let best: string | null = null;
    let far = AIRPORT_M;
    for (const station of network.stations) {
      const d = metres(airport, station);
      if (d < far) {
        far = d;
        best = station.id;
      }
    }
    if (best && !kinds[best]?.includes('airport')) kinds[best] = ['airport', ...(kinds[best] ?? [])];
  }
  return { ...layout, kinds, water };
}

const SIGHT_M = 450;

export function sightsFor(network: SchemeNetwork, landmarks: Landmark[]): Record<string, Landmark> {
  const out: Record<string, Landmark> = {};
  for (const sight of [...landmarks].sort((a, b) => (b.links ?? 0) - (a.links ?? 0))) {
    let best: string | null = null;
    let far = SIGHT_M;
    for (const station of network.stations) {
      const d = metres(sight, station);
      if (d < far) {
        far = d;
        best = station.id;
      }
    }
    if (best && !out[best]) out[best] = sight;
  }
  return out;
}

const PICTURE_M = 700;

export function picturesFor(network: SchemeNetwork, landmarks: Landmark[], language: string): Record<string, { pic: number; title: string; wikidata?: string }> {
  const byId = new Map(landmarks.map((l) => [l.id, l]));
  const out: Record<string, { pic: number; title: string; wikidata?: string }> = {};
  for (const sight of SIGHTS) {
    const known = sight.wikidata ? byId.get(sight.wikidata) : undefined;
    const at = known ?? (sight.lat !== undefined ? { lat: sight.lat, lon: sight.lon! } : undefined);
    if (!at) continue;
    let best: string | null = null;
    let far = PICTURE_M;
    for (const station of network.stations) {
      const d = metres(at, station);
      if (d < far) {
        far = d;
        best = station.id;
      }
    }
    if (best && !out[best]) out[best] = { pic: sight.pic, title: known ? inLanguage(known.name, language) : inLanguage(sight.name ?? {}, language), wikidata: sight.wikidata };
  }
  return out;
}
