#!/usr/bin/env bash
# Cài môi trường dựng video trong phiên cloud của Claude. Chạy 1 lần sau khi clone repo:
#   bash cloud/setup.sh
# Tạo .work/cloud/{public,model,bin}: phông chữ + SFX offline, model nhận giọng nói, bộ lọc ồn.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; W="$ROOT/.work/cloud"
mkdir -p "$W/public/fonts" "$W/public/sfx" "$W/model" "$W/bin"
cd "$ROOT"
[ -d node_modules/remotion ] || npm install --no-audit --no-fund
cp -n cloud/fonts/* "$W/public/fonts/"; cp -n assets/sfx/* "$W/public/sfx/"

# 1) Bộ lọc ồn DeepFilterNet (binary tĩnh, tải từ GitHub release)
if [ ! -x "$W/bin/deep-filter" ]; then
  curl -fsSL -o "$W/bin/deep-filter" "https://github.com/Rikorose/DeepFilterNet/releases/download/v0.5.6/deep-filter-0.5.6-x86_64-unknown-linux-musl" && chmod +x "$W/bin/deep-filter" || echo "!! Không tải được deep-filter"
fi

# 2) faster-whisper + model medium
python3 -c "import faster_whisper" 2>/dev/null || pip install -q --break-system-packages faster-whisper || pip install -q faster-whisper
if [ ! -s "$W/model/model.bin" ]; then
  echo "Lấy model nhận giọng nói (1,5GB)…"
  # a) nhánh 'models' của chính repo này (model chia mảnh <100MB) — đường chắc nhất trong phiên cloud
  if git ls-remote --exit-code --heads origin models >/dev/null 2>&1; then
    rm -rf "$W/model-src"; git clone -q --depth 1 --single-branch --branch models "$(git remote get-url origin)" "$W/model-src" \
      && cat "$W/model-src"/faster-whisper-medium/model.bin.part-* > "$W/model/model.bin" \
      && cp "$W/model-src"/faster-whisper-medium/{config.json,tokenizer.json,vocabulary.txt} "$W/model/" && rm -rf "$W/model-src"
  fi
  # b) HuggingFace (nhiều phiên cloud bị chặn)
  if [ ! -s "$W/model/model.bin" ]; then
    for f in config.json tokenizer.json vocabulary.txt model.bin; do curl -fsSL -o "$W/model/$f" "https://huggingface.co/Systran/faster-whisper-medium/resolve/main/$f" || { rm -f "$W/model/$f"; break; }; done
  fi
  [ -s "$W/model/model.bin" ] || echo "!! Chưa có model. Cách khác: nhờ người dùng gửi thư mục model faster-whisper-medium (4 file) rồi chép vào $W/model/"
fi
echo "Trình duyệt dựng hình: $(find /opt/pw-browsers -name headless_shell -type f 2>/dev/null | sort | tail -1 || true)"
echo "SETUP_DONE  public=$W/public  model=$W/model"
