#!/usr/bin/env bash
set -euo pipefail
cd /opt/raitta-route

if [ ! -f /etc/letsencrypt/live/route.raitta.fi/fullchain.pem ]; then
  certbot certonly --webroot -w /var/www/raitta-acme -d route.raitta.fi \
    --non-interactive --keep-until-expiring --deploy-hook 'systemctl reload nginx'
fi
./site.sh tls
systemctl disable --now raitta-route-cert.timer 2> /dev/null || true
echo "$(date '+%F %T') HTTPS is on for route.raitta.fi"
