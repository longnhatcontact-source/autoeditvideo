# Dựng trên máy người dùng (Windows) bằng "phiếu việc"

Dùng khi phiên Claude **đã liên kết máy tính** của người dùng (có các tool `mcp__remote-devices__*`) và app
BĐS Video Studio **đang mở** trên máy đó. Claude lo phần nghĩ (xem video, chọn ý, tra tên riêng, chọn cảnh, soát hình);
app chạy phần nặng native trên Windows (dùng đủ CPU), video nét gốc ghi thẳng vào Downloads (không phải nén để gửi chat).

Đo thật trên laptop i5-1240P / 8GB RAM, video 75s: cắt+chỉnh màu 46s · lọc ồn 16s · nhận giọng 2 phút · cắt 18 cảnh + chèn ~1 phút 50 ·
webm 43s · ảnh soát ~55s · bản nét ~6 phút 40 → **khoảng 12 phút** (cloud 2 nhân: ~25–30 phút). Chất lượng giống bản cloud (SSIM 0,988).

## 1. Nhận biết máy đã sẵn sàng
- `get_device_info` → `connectedFolders` phải có thư mục app (có `package.json` của repo này) — trên máy anh Nhật:
  `G:\Claude\Chỉ căn\remotion-bds-v2`; máy cài bằng `CAI-DAT.bat`: `%USERPROFILE%\BDSVideoStudio\app`. Chưa có → `device_request_folder_access`.
- Lệnh `device_bash` chạy trong **máy ảo Linux nhỏ (2 nhân, 2GB)** trên máy người dùng, thấy thư mục đã kết nối ở
  `/sessions/<phiên>/mnt/<tên-thư-mục-cuối>` (vd `.../mnt/remotion-bds-v2`, `.../mnt/Downloads`). KHÔNG dựng/chạy nặng trong máy ảo đó.
- `jobs/worker.json` có `"alive"` mới (≤ 10 giây) → app đang mở. Cũ → nhờ người dùng mở app (`MO-APP.bat` / lối tắt "BDS Video Studio (Claude)").
- Mỗi lệnh `device_bash` tối đa 45 giây → chờ việc dài bằng nhiều lệnh `sleep 40; tail log`.

## 2. Phiếu việc
Ghi file JSON vào `jobs/inbox/` (ghi ra `.tmp` rồi `mv` sang `.json` để app không đọc file dở). App nhận trong ~3 giây,
chạy tuần tự trong tiến trình riêng (app tự cập nhật/khởi động lại cũng không làm hỏng), ghi `jobs/run/<id>/status.json` + `log.txt`.
```json
{ "id": "ten-video", "steps": [ { "type": "...", ... }, ... ] }
```
Biến trong chuỗi đường dẫn: `{JOB}` = `jobs/run/<id>` · `{ROOT}` = thư mục app · `{PUBLIC}` = `.work/cloud/public` (nơi để webm/ảnh nền bìa)
· `{EXPORT}` = thư mục xuất (Downloads). Đường dẫn khác dùng dạng Windows (`C:\\Users\\...`) hoặc `/` đều được.

| type | tham số | việc |
|---|---|---|
| `setup` | – | chép phông + SFX vào public, tải deep-filter.exe (tự gọi khi cần) |
| `probe` | – | ghi `{JOB}/probe.json`: CPU, RAM, ffmpeg, Python + faster-whisper, deep-filter |
| `ffmpeg` | `args` [] | chạy ffmpeg (cắt, chỉnh màu, ghép, cắt cảnh B-roll, khung hình soát…) |
| `denoise` | `in`, `out` | lọc ồn DeepFilterNet + nén/limiter (như `cloud/denoise.sh`) |
| `transcribe` | `in`, `out` | faster-whisper medium → raw.json (như `cloud/transcribe.sh`) |
| `broll` | `base`, `plan`, `out` | `cloud/broll.py` (plan được dùng `{JOB}`… trong `clip`) |
| `webm` | `in`, `name`, `audio`? | VP9 webm vào public (như `cloud/to-webm.sh`, đa luồng) |
| `render` | `mode` video/stills/cover, `props`, `a3`, `a4`, `stillScale`?, `concurrency`? | `cloud/render.mjs` |
| `bggrid` | `video`, `items`, `out`, `ys`? | đo độ sáng nền sau khung chữ ở nhiều vị trí y |
| `copy` | `from`, `to` | chép file (vd bản nét ra `{EXPORT}/ten.mp4`) |

`status.json`: `state` running/done/error/interrupted, từng bước có `sec`; lỗi ở `error` (dòng lỗi đầu + cuối log).

## 3. Quy trình đề xuất (2 phiếu + 1 phiếu dựng)
1. **Phiếu chuẩn bị**: `ffmpeg` cắt+chỉnh màu → `ffmpeg` remux → `denoise` → `transcribe` → `ffmpeg` cắt từng cảnh B-roll → `ffmpeg` tờ khung hình (tile) cho Claude xem.
2. Claude đọc `raw.json` + tờ khung hình (đọc qua `device_bash`; ảnh: `device_stage_files` rồi Read), tra tên riêng, viết plan B-roll + props (`cloud/example/make-props.*.mjs`), ghi vào `{JOB}`.
3. **Phiếu dựng**: `broll` → `webm` → `bggrid` (chọn vị trí chữ) → `render stills` (soát, `stillScale` 0.5–1) → Claude xem → sửa props nếu cần →
   `render video net` → `copy` ra `{EXPORT}`. **Bỏ bản nhẹ** (soát bằng ảnh đủ, tiết kiệm ~5,5 phút); vẫn gửi bản nén <30MB qua chat nếu người dùng cần xem trên điện thoại.
Ví dụ đầy đủ: `cloud/example/job.parkcity.json`.

## 4. Lỗi đã gặp
- **`Host version "0.28.1" does not match binary version`** khi render: thiếu `node_modules\@esbuild\win32-x64\esbuild.exe` (npm install bị hỏng giữa chừng).
  Sửa: chạy lại `CAI-DAT.bat` (tự cài đúng bản), hoặc `npm pack @esbuild/win32-x64@<bản của esbuild>` rồi chép esbuild.exe vào.
- **OffthreadVideo "No frame found at position"** trên máy 8GB RAM → giữ mặc định `videoEngine` (webm VP9 + `@remotion/media`). Đọc mp4 bằng trình duyệt cũng không nhanh hơn.
- Chép file lớn từ cloud sang máy: `SendUserFile` + `device_commit_files`; mp4 bị sửa vài byte đầu khi truyền → thêm 16 byte đệm, ghép lại bằng `tail -c +17`, so sha256.
- `device_bash` không xoá được file trong thư mục người dùng (cần `device_request_delete_permission`) — không tự xoá file của người dùng.
- Video gốc nên nằm trong thư mục đã kết nối (vd Downloads) để app đọc thẳng, khỏi chép qua chat.
