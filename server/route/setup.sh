#!/usr/bin/env bash
set -euo pipefail

DIR=/opt/raitta-route
cd "$DIR"
chmod +x update.sh site.sh cert.sh
test -f _road-events.mjs || { echo "Copy server/api/_road-events.mjs here first" >&2; exit 1; }

echo "== Extra swap: building the graph needs more memory than the server has"
if ! swapon --show | grep -q /swapfile-raitta; then
  fallocate -l 4G /swapfile-raitta
  chmod 600 /swapfile-raitta
  mkswap /swapfile-raitta > /dev/null
  swapon /swapfile-raitta
  grep -q '^/swapfile-raitta' /etc/fstab || echo '/swapfile-raitta none swap sw 0 0' >> /etc/fstab
fi

command -v jq > /dev/null || { apt-get update -q && apt-get install -yq jq; }

unit() { cat > "/etc/systemd/system/$1"; }

echo "== Monthly graph refresh, 1st of the month at 03:30"
unit raitta-route-update.service << 'UNIT'
[Unit]
Description=RAITTA routing: rebuild the road graph of Finland
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/opt/raitta-route/update.sh
TimeoutStartSec=8h
Nice=10
StandardOutput=append:/var/log/raitta-route.log
StandardError=append:/var/log/raitta-route.log
UNIT
unit raitta-route-update.timer << 'UNIT'
[Unit]
Description=RAITTA routing: monthly road graph refresh

[Timer]
OnCalendar=*-*-01 03:30:00
Persistent=true

[Install]
WantedBy=timers.target
UNIT

echo "== HTTPS for route.raitta.fi, retried every 30 minutes until the certificate is issued"
unit raitta-route-cert.service << 'UNIT'
[Unit]
Description=RAITTA routing: HTTPS certificate for route.raitta.fi

[Service]
Type=oneshot
ExecStart=/opt/raitta-route/cert.sh
StandardOutput=append:/var/log/raitta-route.log
StandardError=append:/var/log/raitta-route.log
UNIT
unit raitta-route-cert.timer << 'UNIT'
[Unit]
Description=RAITTA routing: retry the HTTPS certificate

[Timer]
OnCalendar=*:0/30

[Install]
WantedBy=timers.target
UNIT

echo "== Road events put on their streets, every two minutes"
unit raitta-route-events.service << 'UNIT'
[Unit]
Description=RAITTA routing: road events with their streets
After=docker.service network-online.target

[Service]
Type=oneshot
Environment=ROUTE_URL=http://127.0.0.1:8002
WorkingDirectory=/opt/raitta-route
ExecStart=/usr/bin/node /opt/raitta-route/road-events-job.mjs
TimeoutStartSec=110
Nice=5
UNIT
unit raitta-route-events.timer << 'UNIT'
[Unit]
Description=RAITTA routing: refresh road events

[Timer]
OnCalendar=*:0/2
AccuracySec=10s

[Install]
WantedBy=timers.target
UNIT
systemctl daemon-reload
systemctl enable --now raitta-route-update.timer
systemctl enable --now raitta-route-events.timer

if [ -f /etc/letsencrypt/live/route.raitta.fi/fullchain.pem ]; then
  ./site.sh tls
else
  ./site.sh http
  systemctl enable --now raitta-route-cert.timer
fi

docker pull -q ghcr.io/valhalla/valhalla-scripted:3.9.1

if [ -s custom_files/valhalla_tiles.tar ]; then
  docker compose up -d
  echo "== Done: the graph already exists, routing is up"
elif [[ "$(systemctl is-active raitta-route-update.service)" =~ ^(active|activating)$ ]]; then
  echo "== The first graph is still being built: tail -f /var/log/raitta-route.log"
else
  echo "== Building the first graph in the background (an hour or more)"
  echo "   Follow it with: tail -f /var/log/raitta-route.log"
  systemctl start --no-block raitta-route-update.service
fi
