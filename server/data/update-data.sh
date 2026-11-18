#!/usr/bin/env bash
# Rebuilds RAITTA's timetables from every region's GTFS feed, and the average fuel prices, and
# publishes them for raitta.fi, which passes /app/data/<region>/… through to this server.
# Run each night by raitta-data.timer. Builds in /opt/raitta-data/public/data and copies only
# a finished build to /var/www/raitta-data/data, so the app never sees half a timetable.
set -euo pipefail

KIT=/opt/raitta-data
LIVE=/var/www/raitta-data/data
cd "$KIT"

# Low priority: the server's other sites come first.
NICE="nice -n 15 ionice -c3"
# Helsinki's feed needs about 2 GB while it is read; the rest comes from swap.
$NICE node --max-old-space-size=2800 scripts/build-data.mjs --force
$NICE node scripts/build-fuel.mjs || echo "fuel prices not updated" >&2

mkdir -p "$LIVE"
# Region folders first, the index last, so the index never names files not yet there.
for dir in public/data/*/; do
  name=$(basename "$dir")
  rsync -a --delete "$dir" "$LIVE/$name/"
done
cp public/data/fuel.json "$LIVE/fuel.json.tmp" && mv "$LIVE/fuel.json.tmp" "$LIVE/fuel.json"
cp public/data/regions.json "$LIVE/regions.json.tmp" && mv "$LIVE/regions.json.tmp" "$LIVE/regions.json"
echo "timetables published $(date -Is)"
