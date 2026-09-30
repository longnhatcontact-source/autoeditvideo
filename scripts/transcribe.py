# -*- coding: utf-8 -*-
"""
Phụ đề tiếng Việt (có lẫn tiếng Anh) bằng faster-whisper.
Dùng: python transcribe.py <wav> <model> <out_json> [vocab_txt]
vocab_txt: mỗi dòng 1 từ/cụm hay nói (tên dự án, từ tiếng Anh) để whisper ưu tiên nhận đúng.
"""
import sys
import json

CACHE_DIR = r"F:/Tools/whisper-models"


def main():
    wav_path, model_size, out_json = sys.argv[1], sys.argv[2] or "small", sys.argv[3]
    vocab = []
    if len(sys.argv) > 4:
        with open(sys.argv[4], encoding="utf-8") as f:
            vocab = [l.strip() for l in f if l.strip() and not l.startswith("#")]

    from faster_whisper import WhisperModel

    model = WhisperModel(model_size, device="cpu", compute_type="int8", download_root=CACHE_DIR)

    # chỉ dùng hotwords: thêm initial_prompt làm whisper bỏ sót cả đoạn
    kwargs = {"hotwords": ", ".join(vocab)} if vocab else {}

    segments, info = model.transcribe(
        wav_path,
        language="vi",
        word_timestamps=True,
        vad_filter=True,
        beam_size=5,
        **kwargs,
    )

    words, segs = [], []
    for seg in segments:
        if info.duration:
            print("@@P %.3f" % (seg.end / info.duration), flush=True)
        segs.append({"start": seg.start, "end": seg.end, "text": seg.text.strip()})
        for w in seg.words or []:
            token = (w.word or "").strip()
            if token:
                words.append({"start": w.start, "end": w.end, "word": token,
                              "prob": getattr(w, "probability", None)})

    with open(out_json, "w", encoding="utf-8") as f:
        json.dump({"duration": info.duration, "language": info.language,
                   "words": words, "segments": segs}, f, ensure_ascii=False)
    print(json.dumps({"ok": True, "words": len(words)}))


if __name__ == "__main__":
    main()
