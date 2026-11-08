#!/usr/bin/env bash
# One-time VM setup (Ubuntu 22.04/24.04, e.g. Oracle Cloud Always Free). Run as the normal sudo user:
#   GEO_REPO_URL=git@github.com:YOU/REPO.git bash bootstrap.sh
# Re-run it after each prompt; every step is skipped if already done.
# Optional: PROD_HOST=geo.example.com STAGING_HOST=staging.example.com (default: free sslip.io names)
# Optional: GEO_ADMIN_EMAIL=you@company.com
set -euo pipefail

REPO="${GEO_REPO_URL:?set GEO_REPO_URL, e.g. git@github.com:YOU/REPO.git}"
ADMIN_EMAIL="${GEO_ADMIN_EMAIL:-admin@example.com}"
ME="$(id -un)"

echo "==> Base tools (minimal Ubuntu images lack some of these)"
sudo apt-get update -qq
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq curl git openssl openssh-client ca-certificates cron iptables >/dev/null

echo "==> Docker"
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sudo sh
fi
sudo usermod -aG docker "$ME"
D="sudo docker"

echo "==> Firewall (Oracle Ubuntu images block 80/443 by default)"
for p in 80 443; do
  sudo iptables -C INPUT -p tcp --dport "$p" -m state --state NEW -j ACCEPT 2>/dev/null \
    || sudo iptables -I INPUT 6 -p tcp --dport "$p" -m state --state NEW -j ACCEPT
done
sudo apt-get install -y -qq iptables-persistent >/dev/null 2>&1 || true
sudo netfilter-persistent save >/dev/null 2>&1 || true

echo "==> Swap (protects small VMs during the image build)"
if [ ! -f /swapfile ] && [ "$(free -m | awk '/Mem:/{print $2}')" -lt 3000 ]; then
  sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile >/dev/null && sudo swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

echo "==> Folders"
sudo mkdir -p /opt/geo/{staging,prod}/data /opt/geo/caddy /opt/geo/backups
sudo chown -R "$ME":"$ME" /opt/geo
sudo chown 1000:1000 /opt/geo/staging/data /opt/geo/prod/data   # container user "node"
$D network inspect geo-edge >/dev/null 2>&1 || $D network create geo-edge >/dev/null

echo "==> Read-only deploy key for GitHub"
KEY="$HOME/.ssh/geo_deploy"
mkdir -p "$HOME/.ssh" && chmod 700 "$HOME/.ssh"
if [ ! -f "$KEY" ]; then
  ssh-keygen -t ed25519 -N '' -C "geo-vm-deploy" -f "$KEY" >/dev/null
  grep -q 'Host github.com' "$HOME/.ssh/config" 2>/dev/null || cat >> "$HOME/.ssh/config" <<EOF
Host github.com
  IdentityFile $KEY
  IdentitiesOnly yes
  StrictHostKeyChecking accept-new
EOF
  chmod 600 "$HOME/.ssh/config"
fi
if ! ssh -o BatchMode=yes -T git@github.com 2>&1 | grep -qi 'successfully authenticated\|does not provide shell'; then
  echo
  echo "Add this public key in GitHub: repo > Settings > Deploy keys > Add deploy key"
  echo "(title: geo-vm, leave 'Allow write access' UNCHECKED), then re-run this script:"
  echo
  cat "$KEY.pub"
  exit 0
fi

echo "==> Clone repo for each environment"
for e in staging prod; do
  [ -d "/opt/geo/$e/app/.git" ] || git clone "$REPO" "/opt/geo/$e/app"
done

echo "==> Hostnames"
IP="$(curl -fsS https://api.ipify.org)"; DASH="${IP//./-}"
STAGING_HOST="${STAGING_HOST:-staging.$DASH.sslip.io}"
PROD_HOST="${PROD_HOST:-app.$DASH.sslip.io}"
cat > /opt/geo/edge.env <<EOF
STAGING_HOST=$STAGING_HOST
PROD_HOST=$PROD_HOST
EOF

echo "==> .env files (only created if missing)"
make_env() { # env host
  local f="/opt/geo/$1/.env"; [ -f "$f" ] && return 0
  local pw; pw="$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-24)"
  umask 077
  cat > "$f" <<EOF
GEO_AUTH_MODE=users
GEO_SUPERADMIN_EMAIL=$ADMIN_EMAIL
GEO_SUPERADMIN_PASSWORD=$pw
GEO_DATA_OWNER=admin
GEO_ALLOWED_ORIGINS=https://$2
GEO_PUBLIC_URL=https://$2
GEO_TRUST_PROXY=true
NODE_ENV=production
GEO_MAIL_MODE=off
# OPENAI_API_KEY=
# GEMINI_API_KEY=
# ANTHROPIC_API_KEY=
# PERPLEXITY_API_KEY=
EOF
  echo "  created $f   (Super Admin: $ADMIN_EMAIL / $pw)"
}
make_env staging "$STAGING_HOST"
make_env prod "$PROD_HOST"

echo "==> Start the HTTPS front door"
( cd /opt/geo/prod/app && $D compose -p geo-edge --env-file /opt/geo/edge.env -f deploy/edge/compose.yaml up -d )

echo "==> Nightly prod backup (03:15)"
CRON="15 3 * * * bash /opt/geo/prod/app/deploy/backup.sh prod >> /opt/geo/backups/backup.log 2>&1"
( crontab -l 2>/dev/null | grep -v 'deploy/backup.sh' ; echo "$CRON" ) | crontab -

echo "==> CI login key (the private key is shown once, then deleted)"
if ! grep -q 'geo-ci' "$HOME/.ssh/authorized_keys" 2>/dev/null; then
  T="$(mktemp -d)"; ssh-keygen -t ed25519 -N '' -C geo-ci -f "$T/ci" >/dev/null
  cat "$T/ci.pub" >> "$HOME/.ssh/authorized_keys"; chmod 600 "$HOME/.ssh/authorized_keys"
  echo "Copy this into the GitHub secret VM_SSH_KEY:"; echo; cat "$T/ci"; echo
  shred -u "$T/ci" 2>/dev/null || rm -f "$T/ci"; rm -rf "$T"
fi

cat <<EOF

Done. Next:
  VM_HOST (secret)   = $IP
  VM_USER (secret)   = $ME
  STAGING_URL (var)  = https://$STAGING_HOST
  PROD_URL (var)     = https://$PROD_HOST
Push to main to deploy staging; push a tag like v0.1.0 to deploy production.
EOF
