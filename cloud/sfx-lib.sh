#!/usr/bin/env bash
# Lấy thư viện 872 SFX (nhánh sfx-lib của repo) vào .work/cloud/public/sfx/lib — dùng trong props: sounds:[{id:"lib/<nhóm>/<tên>.mp3",…}]
# Dùng: bash cloud/sfx-lib.sh   (chạy lại để cập nhật)
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; DST="$ROOT/.work/cloud/public/sfx/lib"; T="$(mktemp -d)"
git clone -q --depth 1 --single-branch --branch sfx-lib "$(git -C "$ROOT" remote get-url origin)" "$T/lib"
mkdir -p "$DST" && cp -r "$T/lib/." "$DST/" && rm -rf "$DST/.git" "$T"
python3 -c "import json;d=json.load(open('$DST/index.json'));print('SFX_LIB_OK',d['count'],'tiếng',d['groups'])"
