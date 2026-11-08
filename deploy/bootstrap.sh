#!/usr/bin/env bash
# One-time setup of a small x86 or ARM Ubuntu VM (tested target: Oracle Always Free E2.1.Micro, 1 GB RAM).
# Run as the normal sudo user (ubuntu). Safe to re-run; finished steps are skipped.
#   GEO_ADMIN_EMAIL=you@company.com bash bootstrap.sh
# Optional: PROD_HOST=geo.example.com   (default: free <ip-with-dashes>.sslip.io)
set -euo pipefail

ADMIN_EMAIL="${GEO_ADMIN_EMAIL:-admin@example.com}"
ME="$(id -un)"

echo "==> Base tools"
sudo apt-get update -qq
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq curl openssl ca-certificates cron iptables iptables-persistent >/dev/null

echo "==> Swap (1 GB RAM needs it for Docker pulls and app spikes)"
if ! swapon --show | grep -q /swapfile; then
  if [ ! -f /swapfile ]; then
    sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile >/dev/null
  fi
  sudo swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

echo "==> Docker"
command -v docker >/dev/null || curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$ME"

echo "==> Firewall (Oracle Ubuntu images block 80/443 by default)"
for p in 80 443; do
  sudo iptables -C INPUT -p tcp --dport "$p" -m state --state NEW -j ACCEPT 2>/dev/null \
    || sudo iptables -I INPUT 6 -p tcp --dport "$p" -m state --state NEW -j ACCEPT
done
sudo netfilter-persistent save >/dev/null 2>&1 || true

echo "==> Folders"
sudo mkdir -p /opt/geo/data /opt/geo/caddy /opt/geo/backups
sudo chown -R "$ME":"$ME" /opt/geo
sudo chown 1000:1000 /opt/geo/data   # the container runs as user "node" (uid 1000)

echo "==> Hostname"
IP="$(curl -fsS https://api.ipify.org)"
PROD_HOST="${PROD_HOST:-app.${IP//./-}.sslip.io}"
echo "PROD_HOST=$PROD_HOST" > /opt/geo/host.env
cat > /opt/geo/Caddyfile <<'EOF'
{$PROD_HOST} {
  reverse_proxy app:8080
}
EOF

echo "==> .env (only created if missing)"
if [ ! -f /opt/geo/.env ]; then
  PW="$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-24)"
  ( umask 077; cat > /opt/geo/.env <<EOF
GEO_AUTH_MODE=users
GEO_SUPERADMIN_EMAIL=$ADMIN_EMAIL
GEO_SUPERADMIN_PASSWORD=$PW
GEO_DATA_OWNER=admin
GEO_ALLOWED_ORIGINS=https://$PROD_HOST
GEO_PUBLIC_URL=https://$PROD_HOST
GEO_TRUST_PROXY=true
NODE_ENV=production
GEO_MAIL_MODE=off
# OPENAI_API_KEY=
# GEMINI_API_KEY=
# ANTHROPIC_API_KEY=
# PERPLEXITY_API_KEY=
EOF
  )
  echo "  Super Admin: $ADMIN_EMAIL"
  echo "  Password:    $PW      (also stored in /opt/geo/.env)"
fi

echo "==> Nightly backup (03:15)"
cat > /opt/geo/backup.sh <<'EOF'
#!/usr/bin/env bash
# Consistent copy of the SQLite database while the app runs; keeps 14 days.
set -euo pipefail
OUT=/opt/geo/backups; name="geo-$(date -u +%Y%m%dT%H%M%SZ).sqlite"
cid="$(docker ps -q --filter label=com.docker.compose.project=geo --filter label=com.docker.compose.service=app | head -n1)"
[ -n "$cid" ] || { echo "app is not running" >&2; exit 1; }
docker exec "$cid" node -e "const {DatabaseSync}=require('node:sqlite');const d=new DatabaseSync('/app/data/geo.sqlite');d.exec(\"VACUUM INTO '/app/data/$name'\");d.close();"
docker exec "$cid" gzip -9 "/app/data/$name"
docker cp "$cid:/app/data/$name.gz" "$OUT/$name.gz"
docker exec "$cid" rm -f "/app/data/$name.gz"
find "$OUT" -name 'geo-*.sqlite.gz' -mtime +14 -delete
echo "ok $OUT/$name.gz"
EOF
chmod +x /opt/geo/backup.sh
( crontab -l 2>/dev/null | grep -v '/opt/geo/backup.sh'; echo "15 3 * * * /opt/geo/backup.sh >> /opt/geo/backups/backup.log 2>&1" ) | crontab -
sudo systemctl enable --now cron >/dev/null 2>&1 || true

echo "==> CI login key (the private key is shown once, then deleted)"
if ! grep -q 'geo-ci' "$HOME/.ssh/authorized_keys" 2>/dev/null; then
  T="$(mktemp -d)"; ssh-keygen -t ed25519 -N '' -C geo-ci -f "$T/ci" >/dev/null
  cat "$T/ci.pub" >> "$HOME/.ssh/authorized_keys"; chmod 600 "$HOME/.ssh/authorized_keys"
  echo "Copy EVERYTHING below into the GitHub secret VM_SSH_KEY:"; echo; cat "$T/ci"; echo
  shred -u "$T/ci" 2>/dev/null || rm -f "$T/ci"; rm -rf "$T"
fi

cat <<EOF

Done. In GitHub (Settings > Secrets and variables > Actions) add:
  secret   VM_HOST     = $IP
  secret   VM_USER     = $ME
  secret   VM_SSH_KEY  = (the private key printed above)
  variable PROD_URL    = https://$PROD_HOST
Then push a tag such as v0.1.0 to deploy.
EOF
