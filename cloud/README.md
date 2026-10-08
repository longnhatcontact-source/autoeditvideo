# Bộ dựng video trong phiên cloud của Claude

Dùng khi Claude (tài khoản bất kỳ) dựng video theo skill `auto-edit-video-bds` mà không có app trên máy.
Mọi thứ cần thiết nằm trong repo này: mã dựng hình (`src/`), 61 mẫu chữ, 20 SFX (`assets/sfx/nr-*.mp3`),
phông chữ offline (`cloud/fonts/`), model nhận giọng nói (nhánh `models`), và các script dưới đây.

## Cài 1 lần
```bash
git clone --single-branch --branch feat/chu-nhan https://github.com/longnhatcontact-source/autoeditvideo && cd autoeditvideo
bash cloud/setup.sh        # npm install, phông + SFX, deep-filter, faster-whisper + model (lấy từ nhánh models)
```

## Quy trình (W = thư mục làm việc của video)
| Bước | Lệnh |
|---|---|
| 1. Cắt lặng/vấp + chỉnh hình (không quá sáng) | ffmpeg — công thức trong skill, ra `cut.mp4` 1080×1920 30fps |
| 2. Lọc ồn | `cloud/denoise.sh video-gốc clean.wav` rồi cắt tiếng theo đúng các đoạn đã giữ |
| 3. Nhận giọng nói | `cloud/transcribe.sh video-gốc W/raw.json` |
| 4. Chèn cảnh bổ trợ (nếu có) | `python3 cloud/broll.py cut.mp4 plan.json cut_br.mp4` |
| 5. Đưa video vào public | `cloud/to-webm.sh cut_br.mp4 ten.webm tieng.wav` |
| 6. Tạo props | xem `cloud/example/make-props.astor1.mjs` (ví dụ thật) + `base-props.json` |
| 7. Soát khung hình | `node cloud/render.mjs stills props.json frames.json W/stills` rồi tự nhìn ảnh |
| 8. Bản nhẹ → duyệt → bản nét | `node cloud/render.mjs video props.json ra.mp4 lite` / `net` |
| 9. Ảnh bìa | `node cloud/render.mjs cover cover.json bia.png` (ảnh nền đặt trong `public/cover/`) |

## Lỗi đã gặp và cách xử lý (đừng mò lại)
- **Chữ ra phông mặc định / render treo ở phông**: phiên cloud không ra được Google Fonts → luôn dựng bằng `cloud/render.mjs` (tự thay `src/load-font.ts` bằng bản offline). Thêm phông mới thì thêm cả vào `cloud/fonts/` + `cloud/load-font.offline.ts`.
- **Video đen / không giải mã được**: Chromium headless không có H.264/HEVC → nguồn phải là VP9 webm (`cloud/to-webm.sh`).
- **ENOSPC (đầy ổ)**: mỗi lần đóng gói Remotion chép cả `public` vào `/tmp/remotion-webpack-bundle-*`; `render.mjs` đã tự dọn, nhớ xoá webm cũ không dùng trong public.
- **Model whisper**: HuggingFace thường bị chặn → `setup.sh` lấy từ nhánh `models` của repo (16 mảnh <100MB, ghép bằng `cat`).
- **Lọc ồn**: không `dynaudnorm`/`loudnorm` sau khi lọc (kéo nền lên), không gate (phập phồng). Dùng DeepFilterNet.
- **Âm thanh sau render có thể vượt 0 dBFS** (SFX cộng giọng): chạy thêm `-af alimiter=limit=0.8:level=disabled` khi xuất file gửi.
- **Video iPhone HDR (HLG)**: phải tone-map về SDR (công thức trong skill), nếu không hình bị cháy sáng.
- **Máy ít nhân**: `render.mjs` tự giới hạn số luồng theo số CPU. Bản nét ~90s mất khoảng 8–10 phút trên máy 2 nhân → chạy nền.
- **File >30MB không gửi được qua chat**: gửi bản 1080p nén (`-b:v 2400k`), bản gốc chép vào thư mục đã kết nối trên máy người dùng. Khi chia mảnh để chép, mảnh đầu của file mp4 bị sửa trên đường truyền → thêm 16 byte đệm vào đầu mảnh rồi `tail -c +17` khi ghép, và so mã sha256.
- **Google Drive**: thường không tải được từ phiên cloud → nhờ người dùng nén zip gửi vào chat.
- Sửa gì trong `src/` thì chạy `node scripts/prebuild-bundle.mjs` rồi commit (app trên Windows dùng gói dựng sẵn).

## Bảng mẫu chữ (xem trước khi chọn)
`cloud/catalog/mau-chu-*.jpg`: ảnh chụp đủ 104 mẫu, đánh số + tên mẫu (sinh lại bằng `cloud/render.mjs stills` mỗi khi thêm/sửa mẫu).
- Quy tắc chữ (đã chốt 8/10/2026): **không dùng kiểu "AI"** (chữ mảnh, viết thường kiểu câu văn, phát sáng neon tràn lan); ưu tiên chữ IN HOA đậm (Montserrat Black, Anton, Oswald, League Spartan) + dòng chữ ký viết tay / nhãn màu.
- Số chỉ chạy (đếm lên) khi con số hiển thị ≥ 10.000; số nhỏ đứng yên.
- Phụ đề phía dưới **tắt mặc định** (`subPosition: "tat"`); ý chính nhấn bằng khung chữ.
- Chữ sáng trên nền sáng tự đảo thành chữ đậm quầng sáng (`bg` ≥ 0,55); nền rất sáng (≥ 0,68) đảo mọi mẫu trừ mẫu có nền riêng (thẻ, mảng, bong bóng).
- Phông: chỉ dùng phông CÓ bộ chữ tiếng Việt (Poppins không có → dùng Be Vietnam Pro).
- **Tên riêng (dự án, đường, người) nghe chưa chắc → tra web hoặc hỏi người dùng TRƯỚC khi đưa lên chữ.** Vd whisper nghe "Metro Green Street" nhưng dự án thật là "Metro Grand Street"; "Tây Ba Vì" là trục "Hồ Tây – Ba Vì".
- Ảnh bìa khi mặt nằm giữa khung: làm nền = khung hình mờ + khung hình rõ dời xuống ~620px (`cloud/example/cover.phudien.json`; lệnh: `ffmpeg -i khung.png -filter_complex "[0]scale=1080:1920,boxblur=30:2,eq=brightness=-0.12[b];[0]scale=1080:-2[f];[b][f]overlay=0:620,crop=1080:1920:0:0" public/cover/ten_bg.jpg`), để chữ ở nửa trên không che mặt.
- Đừng chạy 2 lệnh `cloud/render.mjs` cùng lúc (mỗi lần chạy dọn thư mục tạm của Remotion → lệnh kia lỗi 404).
