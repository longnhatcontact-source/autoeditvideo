# Âm thanh trong skill auto-edit-video-bds — Claude "nghe" bằng cách nào

> Dành cho Claude ở tài khoản khác. Claude KHÔNG nghe được âm thanh. Mọi việc về âm thanh làm bằng 3 cách gián tiếp:
> (1) chuyển giọng thành chữ có mốc thời gian, (2) đo bằng con số, (3) lọc ồn bằng AI rồi đo lại.
> Phần nào chỉ tai người đánh giá được → luôn nói rõ và nhờ người dùng nghe lại.

## Liên kết
| Thứ | Link |
|---|---|
| Repo (riêng tư, cần được mời) | https://github.com/longnhatcontact-source/autoeditvideo — nhánh `feat/chu-nhan` |
| Lọc ồn | `cloud/denoise.sh` — https://github.com/longnhatcontact-source/autoeditvideo/blob/feat/chu-nhan/cloud/denoise.sh |
| Nhận giọng (Linux/cloud) | `cloud/transcribe.sh` — https://github.com/longnhatcontact-source/autoeditvideo/blob/feat/chu-nhan/cloud/transcribe.sh |
| Nhận giọng (Windows/app) | `cloud/transcribe.py` |
| Từ khoá gợi ý cho whisper | `tu-khoa.txt` (tên dự án, thuật ngữ BĐS) |
| Bảng sửa chữ nghe nhầm | `sua-tu.txt` |
| Tìm khoảng lặng (app) | `lib/media.mjs` (silencedetect) |
| faster-whisper (gốc) | https://github.com/SYSTRAN/faster-whisper |
| DeepFilterNet (gốc, bản v0.5.6) | https://github.com/Rikorose/DeepFilterNet/releases/tag/v0.5.6 |
| Bộ lọc ffmpeg (silencedetect, ebur128, acompressor, alimiter) | https://ffmpeg.org/ffmpeg-filters.html |

## 1. Biết người nói nói gì → faster-whisper
- Lệnh: `cloud/transcribe.sh <video|wav> <raw.json>` (Windows: `python cloud/transcribe.py <video> <raw.json>`).
- Cấu hình: model `medium`, `language="vi"`, `word_timestamps=True`, `vad_filter=True`, `beam_size=5`, `compute_type=int8` (CPU),
  `hotwords` = các dòng trong `tu-khoa.txt`. Âm thanh đưa vào: mono 16 kHz.
- Kết quả `raw.json`: `words[]` gồm `start`, `end` (giây), `word`, `prob` (độ tin cậy 0–1) + `segments[]` (cả câu).
- Claude dùng file này để: đặt tiêu đề/khung chữ đúng lúc nói, cắt câu vấp/lặp, chọn B-roll khớp lời.
- Sửa chữ: áp `sua-tu.txt`, đối chiếu kịch bản. Chữ có `prob` thấp hoặc là **TÊN RIÊNG** (dự án, đường, chủ đầu tư) → tra web
  hoặc hỏi người dùng TRƯỚC khi đưa lên hình (bài học: whisper nghe "Metro Green Street", thật là "Metro Grand Street").
- Model lấy từ nhánh `models` của repo (HuggingFace thường bị chặn trên cloud) — `cloud/setup.sh` tự lo.

## 2. Cắt khoảng lặng → ffmpeg silencedetect
- `ffmpeg -i <video> -af silencedetect=noise=-30dB:d=0.7 -f null -` → in ra các đoạn nhỏ hơn −30 dB dài ≥ 0,7 giây.
- Cắt các đoạn đó (chừa đệm ngắn để không cụt hơi). Hiệu ứng chớp/vệt màu có sẵn ở chỗ nối → cắt đúng lúc im lặng.

## 3. Lọc tiếng ồn (xe máy, ô tô, gió) → DeepFilterNet + ffmpeg
Lệnh: `cloud/denoise.sh <video> <ra.wav>`. Chuỗi xử lý:
1. Tách tiếng: mono 48 kHz, `highpass=f=90` (bỏ ù tần thấp).
2. DeepFilterNet v0.5.6: `deep-filter --pf -D` (AI tách giọng người khỏi tiếng nền).
3. Hậu kỳ: `highpass=f=100` → `acompressor` (threshold −24 dB, ratio 2.5) → `volume=15dB` → `alimiter` (limit 0.87).
4. Đo độ to: `ebur128` → mục tiêu khoảng **−15 LUFS** (mức to cho TikTok). Lệch thì chỉnh `volume=`.

**KHÔNG làm** (đã thử, người dùng chê):
- `dynaudnorm` / `loudnorm` sau khi lọc → kéo tiếng nền lên lại.
- gate / rnnoise + gate → lúc nói vẫn nghe tiếng xe, âm thanh phập phồng.

## 4. Kiểm tra bằng số (thay cho tai)
| Đo gì | Cách đo | Đạt khi |
|---|---|---|
| Ồn nền sau lọc | `volumedetect` / `astats` trên đoạn chưa nói | ≤ −60 dB |
| Giọng sau lọc | so mức đoạn đang nói trước/sau lọc | gần như giữ nguyên |
| Độ to tổng | `ebur128` | ≈ −15 LUFS |
| Khoảng lặng | `silencedetect=noise=-30dB:d=0.7` | đã cắt hết đoạn thừa |
| SFX khung chữ | mức tiếng so với giọng | nghe rõ, không lấn giọng (bộ `assets/sfx/nr-*.mp3`, đã cân sẵn) |

## 5. Hiệu ứng âm thanh (SFX)
- Chỉ đặt ở **khung chữ nhấn** (`calloutSfx: 1`, mỗi mẫu đã gắn sẵn tiếng trong `templateSounds`). Không đặt ở tiêu đề mở đầu,
  chuyển cảnh (`sfx: []`). Không dùng tiếng meme/hài.
- Video không lời người dùng tự ghép nhạc (vd video Vin Olympic): tắt hết (`calloutSfx: 0`, không chèn âm thanh).

## 6. Giới hạn — luôn báo người dùng nghe lại
Claude không đánh giá được: giọng sau lọc có méo/rè/"robot" không · SFX có hay, có hợp không · nhịp cắt có tự nhiên,
có cụt hơi không · nhạc nền có hợp không. Khi gửi video luôn ghi: "Âm thanh em chỉ đo bằng số, anh nghe lại giúp em."
Phản hồi bằng tai của người dùng (vd "vẫn nghe tiếng xe máy", "SFX nghe chán") → ghi vào mục "Phản hồi" trong `cloud/skill/SKILL.md`.
