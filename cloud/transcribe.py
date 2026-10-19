# -*- coding: utf-8 -*-
"""Nhận giọng nói tiếng Việt -> JSON từng chữ có mốc thời gian (giống cloud/transcribe.sh, chạy được cả Windows).
Dùng: python cloud/transcribe.py <video|wav> <ra.json> [medium | thư-mục-model]
Model: thư mục .work/cloud/model nếu có; nếu không, tên model ('medium') tải/đọc ở F:/Tools/whisper-models (Windows)."""
import json, os, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src, out = sys.argv[1], sys.argv[2]
model = sys.argv[3] if len(sys.argv) > 3 else "medium"
local = os.path.join(ROOT, ".work", "cloud", "model")
if model == "medium" and os.path.isfile(os.path.join(local, "model.bin")):
    model = local

tmp = tempfile.mkdtemp()
wav = os.path.join(tmp, "a.wav")
subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", src, "-vn", "-ac", "1", "-ar", "16000", wav], check=True)

vocab_file = os.path.join(ROOT, "tu-khoa.txt")
vocab = []
if os.path.isfile(vocab_file):
    with open(vocab_file, encoding="utf-8") as f:
        vocab = [l.strip() for l in f if l.strip() and not l.startswith("#")]

from faster_whisper import WhisperModel

kw = {} if os.path.isdir(model) else {"download_root": "F:/Tools/whisper-models" if os.name == "nt" else None}
m = WhisperModel(model, device="cpu", compute_type="int8", cpu_threads=min(os.cpu_count() or 4, 8), **kw)
segs, info = m.transcribe(wav, language="vi", word_timestamps=True, vad_filter=True, beam_size=5, **({"hotwords": ", ".join(vocab)} if vocab else {}))
words, ss = [], []
for s in segs:
    if info.duration:
        print("@@P %.3f" % (s.end / info.duration), flush=True)
    ss.append({"start": s.start, "end": s.end, "text": s.text.strip()})
    for w in s.words or []:
        if (w.word or "").strip():
            words.append({"start": w.start, "end": w.end, "word": w.word.strip(), "prob": w.probability})
with open(out, "w", encoding="utf-8") as f:
    json.dump({"duration": info.duration, "language": info.language, "words": words, "segments": ss}, f, ensure_ascii=False)
os.remove(wav)
print("words:", len(words))
