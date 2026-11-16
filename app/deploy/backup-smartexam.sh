#!/usr/bin/env bash
# Contoh dump harian database `smartexam` yang MENGECUALIKAN bucket GridFS `video` (klip bisa sampai 100 MB tiap berkas dan
# mudah diunggah ulang; menyertakannya membengkakkan cadangan harian dan disk server). Audio, PDF, dan gambar tetap ikut.
# Sesuaikan MONGO_CONTAINER dan tujuan, lalu jalankan dari cron di server. Skrip ini TIDAK dijalankan oleh redeploy-smartexam.sh.
set -euo pipefail
MONGO_CONTAINER="${MONGO_CONTAINER:-ailabs-deploy-mongo-1}"
OUT="${OUT:-/home/ailolabs/backups/smartexam}"
STAMP="$(date +%F)"
mkdir -p "$OUT"
docker exec "$MONGO_CONTAINER" mongodump --db smartexam \
  --excludeCollection=video.files --excludeCollection=video.chunks \
  --archive --gzip > "$OUT/smartexam-$STAMP.archive.gz"
# Simpan 14 hari terakhir.
find "$OUT" -name 'smartexam-*.archive.gz' -mtime +14 -delete
