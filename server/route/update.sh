#!/usr/bin/env bash
set -euo pipefail

DIR=/opt/raitta-route
IMAGE=ghcr.io/valhalla/valhalla-scripted:3.9.1
PBF=https://download.geofabrik.de/europe/finland-latest.osm.pbf
cd "$DIR"

log() { echo "$(date '+%F %T') $*"; }

log "Building the road graph in $DIR/next"
rm -rf next prev
mkdir next

MIN_FREE_KB=1572864
(
  while sleep 20; do
    if [ "$(df --output=avail -k / | tail -1)" -lt "$MIN_FREE_KB" ]; then
      log "Disk almost full: stopping the graph build"
      docker stop raitta-route-build > /dev/null 2>&1 || true
    fi
  done
) &
guard=$!
trap 'kill $guard 2> /dev/null || true' EXIT

docker run --rm --name raitta-route-build \
  --cpus 1 --cpu-shares 256 --memory 1200m --memory-swap 5g \
  -v "$DIR/next:/custom_files" \
  -e tile_urls="$PBF" \
  -e serve_tiles=False \
  -e server_threads=1 \
  -e build_elevation=False \
  -e build_admins=True \
  -e build_time_zones=True \
  "$IMAGE" build_tiles

test -s next/valhalla_tiles.tar || { log "No graph was built; the service keeps the old one"; exit 1; }

jq '.service_limits.max_exclude_polygons_length = 200000
  | .service_limits.max_exclude_locations = 200
  | .service_limits.max_exclude_polygons_vertices = 3000
  | .service_limits.pedestrian.max_distance = 1300000
  | .mjolnir.max_cache_size = 268435456' \
  next/valhalla.json > next/valhalla.json.new && mv next/valhalla.json.new next/valhalla.json
rm -rf next/*.osm.pbf next/valhalla_tiles
log "Graph size: $(du -sh next | cut -f1)"

log "Swapping in the new graph"
docker compose stop valhalla 2> /dev/null || true
if [ -d custom_files ]; then mv custom_files prev; fi
mv next custom_files
docker compose up -d

for _ in $(seq 1 60); do
  if curl -fsS http://127.0.0.1:8002/status > /dev/null 2>&1; then
    rm -rf prev
    log "Routing is up on the new graph"
    exit 0
  fi
  sleep 5
done

log "The new graph did not start; going back to the old one"
if [ -d prev ]; then
  docker compose stop valhalla || true
  rm -rf custom_files
  mv prev custom_files
  docker compose up -d
fi
exit 1
