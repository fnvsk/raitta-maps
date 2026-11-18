#!/usr/bin/env bash
set -euo pipefail

SITE=/etc/nginx/sites-available/raitta-route
cd /opt/raitta-route
mkdir -p /var/www/raitta-acme /var/cache/raitta-flights
chown www-data /var/cache/raitta-flights
[ -f /etc/nginx/raitta-finavia.conf ] || echo '# proxy_set_header app_key "…";' > /etc/nginx/raitta-finavia.conf

if [ "${1:-http}" = tls ]; then sed 's/^#TLS \{0,1\}//' raitta-route.nginx > "$SITE"; else cp raitta-route.nginx "$SITE"; fi
ln -sf "$SITE" /etc/nginx/sites-enabled/raitta-route
if nginx -t 2> /tmp/raitta-nginx-test; then
  systemctl reload nginx
else
  cat /tmp/raitta-nginx-test
  rm -f /etc/nginx/sites-enabled/raitta-route
  echo "nginx rejected the RAITTA site; it was removed and nothing else changed" >&2
  exit 1
fi
