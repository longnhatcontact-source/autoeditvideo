#!/usr/bin/env bash
# Nhận giọng nói tiếng Việt → JSON từng chữ có mốc thời gian.  Dùng: cloud/transcribe.sh <video|wav> <ra.json>
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; W="$ROOT/.work/cloud"; T="$(mktemp -d)"
ffmpeg -y -v error -i "$1" -vn -ac 1 -ar 16000 "$T/a.wav"
python3 - "$T/a.wav" "$W/model" "$2" "$ROOT/tu-khoa.txt" <<'PY'
import sys, json
from faster_whisper import WhisperModel
wav, model_dir, out, vocab_file = sys.argv[1:5]
vocab = [l.strip() for l in open(vocab_file, encoding="utf-8") if l.strip() and not l.startswith("#")]
m = WhisperModel(model_dir, device="cpu", compute_type="int8")
segs, info = m.transcribe(wav, language="vi", word_timestamps=True, vad_filter=True, beam_size=5, **({"hotwords": ", ".join(vocab)} if vocab else {}))
words, ss = [], []
for s in segs:
    ss.append({"start": s.start, "end": s.end, "text": s.text.strip()})
    for w in s.words or []:
        if (w.word or "").strip(): words.append({"start": w.start, "end": w.end, "word": w.word.strip(), "prob": w.probability})
json.dump({"duration": info.duration, "language": info.language, "words": words, "segments": ss}, open(out, "w", encoding="utf-8"), ensure_ascii=False)
print("words:", len(words))
PY
