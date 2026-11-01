#!/usr/bin/env bash
# redeploy-smartexam: tarik kode terbaru dari GitHub, bangun, lalu muat ulang PM2.
# Pakai di server:  bash /var/www/smartexam/app/deploy/redeploy-smartexam.sh
# Lingkungan:       APP_DIR (default /var/www/smartexam), PM2_NAME (default smartexam), BRANCH (default main), FORCE=1 untuk membangun ulang tanpa perubahan
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/var/www/smartexam}"
PM2_NAME="${PM2_NAME:-smartexam}"
BRANCH="${BRANCH:-main}"
LOCK="/tmp/redeploy-smartexam.lock"

# Cegah dua deploy berjalan bersamaan.
exec 9>"$LOCK"
flock -n 9 || { echo "Deploy lain sedang berjalan. Batal."; exit 1; }

cd "$APP_DIR"
[ -f app/.env.local ] || { echo "app/.env.local tidak ada. Isi dulu konfigurasi production."; exit 1; }
PREV="$(git rev-parse --short HEAD)"
echo "==> Versi sekarang: $PREV"

echo "==> git pull ($BRANCH)"
git fetch --quiet origin "$BRANCH"
git merge --ff-only "origin/$BRANCH"   # menolak bila ada perubahan lokal yang bentrok; tidak menimpa apa pun
NEW="$(git rev-parse --short HEAD)"

cd app
if [ "$PREV" = "$NEW" ] && [ -d .next ] && [ "${FORCE:-0}" != "1" ]; then
  echo "==> Tidak ada perubahan ($NEW). Pakai FORCE=1 untuk membangun ulang."
else
  # npm ci menghapus node_modules yang sedang dipakai server, jadi hanya bila package-lock berubah.
  if [ "$PREV" != "$NEW" ] && git diff --name-only "$PREV" "$NEW" | grep -q '^app/package-lock.json$'; then
    echo "==> npm ci"; npm ci
  fi
  echo "==> npm run build"; npm run build
fi

echo "==> pm2 reload $PM2_NAME"
pm2 reload "$PM2_NAME" --update-env || pm2 start ecosystem.config.cjs --env production
pm2 save
echo "==> Selesai. Versi: $NEW. Cek: curl -fsS http://127.0.0.1:4100/api/health"
