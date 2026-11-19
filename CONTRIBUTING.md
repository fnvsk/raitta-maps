# Contributing to RAITTA

Thanks for wanting to help. Ideas, bug reports and fixes are all welcome.

## Ideas and bugs

Open an issue: https://github.com/fnvsk/raitta-maps/issues

For a bug, say what you did, what you expected and what happened instead. Add the city, the
device and the app version (Settings, at the bottom) if you can. A screenshot helps a lot.

For an idea, describe the problem it solves for someone riding a bus or driving, not only
the feature itself.

## Changing the code

1. Fork the repository and clone your fork.
2. Create a branch for your change: `git checkout -b fix-stop-search`.
3. Install and run the app:

   ```bash
   npm install
   npm run data -- --only=tampere
   npm run dev
   ```

   `npm run data` downloads the timetables. `--only` keeps it to one city, which is much
   faster than building all of them.
4. Make the change. Keep it small and about one thing.
5. Check that it still builds and the tests pass:

   ```bash
   npx tsc --noEmit
   npm test
   ```

6. Push the branch to your fork and open a pull request against `main`.

I read every pull request. If it fits the app, I merge it; if something needs changing,
I will say what in the review. Nothing goes into `main` without a review.

## A few rules

- No API keys, tokens or passwords in the code. They live in Vercel's settings and on the
  server only.
- Texts shown to people go into all five languages in `src/i18n/locales/` (fi, en, sv, ru,
  et). If you only know one or two, add those and say so in the pull request.
- New logic in `src/core/` should come with a test next to it.
- Data comes from open sources (Digitransit, Fintraffic, OpenStreetMap). Please don't add
  scraping of sites that don't allow it.

## Where things are

- `src/core/` route search, timetables, driving, places search
- `src/pages/` screens
- `src/map/` everything drawn on the map
- `src/data/hooks.ts` data loading
- `scripts/` builds and data preparation
- `server/route/` the routing server (Valhalla)

The website raitta.fi is a separate repository:
https://github.com/fnvsk/raitta-landing
