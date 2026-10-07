#!/usr/bin/env bash
# Chromium headless trong phiên cloud KHÔNG đọc được H.264/HEVC → video nguồn phải là VP9 webm đặt trong public.
# Dùng: cloud/to-webm.sh <video.mp4> <tên.webm> [tiếng.wav]   (tiếng.wav: âm thanh đã lọc ồn, nếu có)
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; OUT="${BDS_PUBLIC:-$ROOT/.work/cloud/public}/$2"
if [ -n "$3" ]; then A=(-i "$3" -map 0:v -map 1:a -shortest); else A=(); fi
ffmpeg -y -v error -i "$1" "${A[@]}" -c:v libvpx-vp9 -crf 24 -b:v 0 -deadline realtime -cpu-used 6 -row-mt 1 -c:a libopus -b:a 160k "$OUT"
echo "$OUT"
