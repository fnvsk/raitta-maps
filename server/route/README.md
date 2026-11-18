# RAITTA car routing server

Valhalla on Finland's OpenStreetMap roads, served at https://route.raitta.fi by the server's
existing nginx. Not part of the Vercel deploy: only `server/api` goes there.

Everything here only adds its own files to the server and never edits anything else on it.

| File | What it does |
|--|--|
| `docker-compose.yml` | Valhalla on 127.0.0.1:8002, 1 GB memory cap |
| `raitta-route.nginx` | Our nginx site: `/route`, `/locate`, `/status`, `/road-events.json`; CORS for RAITTA's origins; 30 req/s per IP |
| `site.sh` | Installs that site (`http` or `tls`), reloads nginx only after `nginx -t` passes |
| `cert.sh` | Let's Encrypt certificate (webroot), then switches the site to HTTPS |
| `update.sh` | Builds a fresh graph in `next/` (1 core, capped memory, stops if the disk nearly fills), swaps it in, rolls back on failure |
| `road-events-job.mjs` | Every 2 min: Fintraffic road events with street notices put on their streets, to `/var/www/raitta-route/road-events.json` |
| `_road-events.mjs` | Copied from `server/api/_road-events.mjs`: the same code the site uses |
| `setup.sh` | 4 GB extra swap, jq, systemd timers, nginx site, first build in the background |

Timers: `raitta-route-update.timer` (1st of the month 03:30, the build takes about 10 minutes),
`raitta-route-events.timer` (every 2 minutes), `raitta-route-cert.timer` (every 30 min until
the certificate exists, then it turns itself off).

Log: `/var/log/raitta-route.log`; the events job logs to `journalctl -u raitta-route-events`.
Check: `curl https://route.raitta.fi/status`.

Install or repair: copy this folder and `server/api/_road-events.mjs` to `/opt/raitta-route`,
then `bash /opt/raitta-route/setup.sh`.
