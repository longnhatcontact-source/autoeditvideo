#!/usr/bin/env bash
# Lọc tiếng ồn (xe máy, ô tô, gió) cho video quay ngoài trời bằng DeepFilterNet, rồi chuẩn âm lượng ~-15 LUFS.
# Dùng: denoise.sh <video-hoặc-audio> <ra.wav>
# KHÔNG dùng dynaudnorm/loudnorm sau khi lọc (kéo tiếng nền lên lại). KHÔNG dùng gate (nghe phập phồng).
set -e
IN="$1"; OUT="$2"; D="$(mktemp -d)"
DF="${DEEP_FILTER:-$D/deep-filter}"
if [ ! -x "$DF" ]; then
  curl -sSL -o "$DF" "https://github.com/Rikorose/DeepFilterNet/releases/download/v0.5.6/deep-filter-0.5.6-x86_64-unknown-linux-musl"
  chmod +x "$DF"
fi
ffmpeg -y -v error -i "$IN" -vn -ac 1 -ar 48000 -af "highpass=f=90" -c:a pcm_s16le "$D/src.wav"
"$DF" --pf -D -o "$D/out" "$D/src.wav"
ffmpeg -y -v error -i "$D/out/src.wav" -af "highpass=f=100,acompressor=threshold=-24dB:ratio=2.5:attack=8:release=160:makeup=1,volume=15dB,alimiter=limit=0.87:attack=3:release=60:level=disabled" -ar 48000 -ac 2 "$OUT"
ffmpeg -v info -i "$OUT" -af ebur128 -f null - 2>&1 | grep " I:" | tail -1   # mong ~-15 LUFS; lệch thì chỉnh volume=
