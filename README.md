# RAITTA

Move with the city. Real-time public transport across Finland: a web app (maps.raitta.fi),
an installable iPhone/Android PWA and a Telegram Mini App, with live vehicles, departures,
trip planning and a custom map, in Finnish, English, Swedish, Russian and Estonian.

The landing site (raitta.fi) lives in its own repository, raitta-landing.

## Run it

Requires Node 22 or newer.

```bash
npm install
```

```bash
npm run data
```

```bash
npm run dev
```

`npm run data` downloads every region's timetable feed and builds `public/data`. It takes
a few minutes and uses up to 8 GB of memory for Helsinki. Output is gzipped and sharded to
fit free hosting limits. To build part of it, use `npm run data -- --only=oulu,kuopio`.

| Command | Purpose |
| --- | --- |
| `npm run build` | Create the site in `dist`: landing at `/`, app at `/app/` |
| `npm run preview` | Serve `dist` the way production does |
| `npm run telegram -- <https url>/app/` | Connect the bot's menu button to the deployed app |
| `npm test` | Run the unit tests |
| `npm run icons` | Regenerate app icons from the logo |

## Coverage

19 regions: Helsinki, Tampere, Turku, Oulu, Jyväskylä, Kuopio, Lahti, Pori, Joensuu,
Lappeenranta, Hämeenlinna, Vaasa, Rovaniemi, Kotka, Kouvola, Mikkeli, Salo, Kajaani and
Raasepori. The map itself covers all of Finland. Add a region in `src/core/regions.json`.

| Capability | Tampere | Helsinki | Other regions |
| --- | --- | --- | --- |
| Timetables, lines, trip planner | Yes | Yes | Yes |
| Live vehicle positions | Yes | Yes | Yes, where the feed publishes them |
| Schedule delay on vehicles | Yes | Yes | No |
| Live departure predictions | Yes | No | No |

## How it fits together

There is no backend. Everything is static files plus public feeds called from the browser.

- **Timetables** come from GTFS feeds, preprocessed by `scripts/build-data.mjs` into one
  small file per stop, because no open API offers "departures from this stop" cheaply.
- **Live vehicles** come from ITS Factory polling in Tampere and MQTT streams elsewhere
  (`src/core/live.ts`). Streams subscribe only to the map's 0.1° cells, which keeps mobile
  data use reasonable; Helsinki alone publishes about 800 messages a second.
- **The map** is RAITA's own style (`src/map/style.ts`) over OpenStreetMap vector tiles
  from OpenFreeMap, with place icons and 3D buildings.
- **3D city mode** (Layers menu) adds textured buildings from real footprints and heights,
  live vehicle models, and hand-built landmark models (`src/map/models3d.ts`). Three.js
  loads only when this mode is on. Buildings are generic; only the listed landmarks have
  their own shape.
- **Journey planning** runs RAPTOR in the browser on every real trip time
  (`src/core/raptor.ts`), with up to three changes and walks between nearby stops, so a bus
  connects to a tram whatever the stops are called. Walking routes follow real footpaths.
- **Search** covers stops and lines locally, and streets, schools, shops and landmarks
  through Photon.
- **Tickets** open each region's official app (`src/core/tickets.ts`). RAITA sells nothing.
- `src/core` has no DOM or React code, so the Android app can reuse it.

## Android APK

The APK wraps the deployed site, so it needs the public https address first.

1. Deploy the site, then enter `https://your-domain/app/` at [PWABuilder](https://www.pwabuilder.com) and generate the Android package with the package ID `fi.raita.app`.
2. Copy its APK to `landing/raita.apk` and its `assetlinks.json` to `landing/assetlinks.json`.
3. Run `npm run build` and deploy again. The download button turns on by itself.

Keep the generated signing key and passwords safe and out of the repository. Every future
update must be signed with the same key, or phones will refuse to install it.

## Before going to production

- **Rebuild data on a schedule.** Timetables are a snapshot. Run `npm run data` and deploy
  at least weekly. HSL's feed only reaches a few weeks ahead.
- **Check the data terms.** The Digitransit broker accepted anonymous connections when
  this was built, but its documentation says its APIs need registration. Register, and
  confirm attribution and terms for ITS Factory, HSL, Föli, Waltti and Digitransit.
- **Host place search.** The public Photon server rate-limits heavy use. Run your own
  instance or use a paid geocoder. Search text is sent to this service.
- **Deploy the built site.** Data cannot be rebuilt on a free host, so upload `dist`:
  `npx vercel deploy dist --prod`. Run `npm run data` and `npm run build` first.
- **Register for a Digitransit key** to add live departure predictions across Finland.
- **Host walking routes.** Footpaths come from the public FOSSGIS router, which suits
  light use only.
- **Keep the bot token secret.** It belongs in `.env.local` only and never in `VITE_` variables.
- **Test on a real iPhone and Android device.** Install flow, safe areas, Android intents
  and blur performance need physical devices.

## Credits

Transit data: ITS Factory, HSL, Föli, Waltti and Digitransit open data. Map: OpenFreeMap,
OpenMapTiles and OpenStreetMap contributors. Place search: Photon. RAITA is independent
and not affiliated with any transport authority.

## Contributing

Ideas, bug reports and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).
