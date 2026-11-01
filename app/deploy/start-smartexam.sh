#!/usr/bin/env bash
# Dipanggil PM2. MongoDB di server ini berupa kontainer Docker tanpa port ke host, jadi IP kontainernya dicari saat start
# (IP bisa berubah bila kontainer dibuat ulang). Hanya database "smartexam" yang dipakai; database lain tidak disentuh.
# Bila Mongo ada di tempat lain, hapus pembungkus ini dan isi MONGODB_URI di .env.local.
set -Eeuo pipefail
cd "$(dirname "$0")/.."
CONTAINER="${MONGO_CONTAINER:-ailabs-deploy-mongo-1}"
IP="$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$CONTAINER" 2>/dev/null || true)"
if [ -n "$IP" ]; then export MONGODB_URI="mongodb://${IP}:27017/${MONGO_DB:-smartexam}"; fi
echo "[smartexam] MongoDB: ${MONGODB_URI:-<dari .env.local>}" | sed -E 's#//[^@/]*@#//***@#'
exec node node_modules/next/dist/bin/next start -p "${PORT:-4100}"
