# BĐS Video Studio

App máy tính (Electron + Remotion) biến clip thô (quay / ghi màn hình) thành video TikTok dọc 9:16 cho bất động sản.
Dựng từ template chính thức `npx create-video --tiktok` của Remotion.

## Tính năng
- **Dựng video:** nhiều clip → khung dọc 9:16 (nền mờ phía sau), tự cắt viền đen bản ghi màn hình, cắt đoạn im lặng, ghép.
- **Phụ đề tự động** (faster-whisper, tiếng Việt lẫn tiếng Anh): danh sách từ khoá, bảng tự sửa chữ sai; kiểu TikTok tô
  chữ đang đọc, 1 cỡ chữ cho cả video, không ngắt đôi tên dự án; số liệu (giá, m², năm) tô vàng.
- **Sửa trong app:** sửa chữ từng câu, kiểu phụ đề (màu/vị trí/hộp nền), hoàn tác Ctrl+Z / Ctrl+Y.
- **Thông tin BĐS:** băng tên dự án + thẻ giá. Không có ô số điện thoại (tránh bị TikTok hạn chế).
- **Tiêu đề mở đầu** vài giây đầu, cùng bộ chữ với Chữ nhấn (`*chữ*` = chữ đậm to; phần trước/sau = chữ viết tay
  trên/dưới; chọn kiểu màu, dời chỗ, đổi cỡ), **che vùng** (làm mờ SĐT dính sẵn trong clip),
  **zoom nhẹ** ở chỗ nhấn mạnh, **ảnh/clip minh hoạ chèn**, **tên kênh / logo**.
- **Chữ nhấn:** chữ hiệu ứng lớn giữa màn hình ở đoạn quan trọng (3 kiểu: trắng viền đỏ, neon xanh, vàng ánh kim;
  dòng trên/dưới viết tay; kéo thả trên khung xem trước để dời chỗ, lăn chuột / thanh trượt để đổi cỡ). Thêm tay tại giây đang xem, hoặc bấm ✨ để Claude đọc phụ đề và gợi ý (cần khoá API
  Anthropic trong ⚙ Cài đặt; chỉ gửi chữ phụ đề + thông tin dự án, không gửi video). Chưa có trong bản xuất CapCut.
- **Âm thanh:** nhạc nền từ máy (tự vặn nhỏ khi nói), 31 SFX CC0 + thêm SFX riêng.
- **Mẫu dự án:** lưu thông tin, tiêu đề, vùng che, kiểu phụ đề, nhạc để dùng lại.
- **Xuất:** MP4 1080×1920 (mặc định vào thư mục Downloads, đổi được) hoặc **draft CapCut** chỉnh tiếp được.

## Cài trên máy mới
Cần: Node.js 20+, ffmpeg/ffprobe trên PATH, Python 3.12 có `faster-whisper` và `pycapcut`.
```
npm install
node node_modules/electron/install.js   # npm có chặn script cài đặt thì chạy tay
npm run build:ui
npm run app
```
Đường dẫn Python mặc định `F:/Tools/Python312/python.exe` (đổi bằng biến môi trường `WHISPER_PYTHON`),
model whisper ở `F:/Tools/whisper-models` (xem `scripts/transcribe.py`).

## Cấu trúc
```
app/        electron.cjs (cửa sổ, hộp chọn file) · server.mjs (API express + phát media) · preload.cjs · icon
ui/         giao diện React + @remotion/player (npm run build:ui -> ui/dist)
src/        composition Remotion "BdsVideo" — dùng chung cho xem trước và xuất MP4
lib/        media (ffmpeg) · captions-core (chia câu, sửa chữ, số liệu, zoom — dùng chung UI/Remotion/Node)
            projects (dự án + hàng đợi việc) · render · capcut · sfx · templates · brand · settings
scripts/    transcribe.py (faster-whisper) · capcut_export.py (pycapcut)
assets/sfx/ thư viện SFX (custom/ = SFX người dùng thêm)
projects/   dữ liệu từng video (không đưa lên git)
```

## Phát triển
- Sửa giao diện: `npm run server` (cổng 5190) + `npx vite --config ui/vite.config.ts` (http://localhost:5191),
  xong `npm run build:ui`.
- Sửa `src/` hoặc `lib/`: khởi động lại app (server bundle composition 1 lần mỗi phiên).
- Kiểm tra kiểu: `npx tsc --noEmit -p .`

## Ghi chú kỹ thuật (lỗi đã gặp)
- Dùng `<Video>`/`<Audio>` của `@remotion/media`, không dùng `OffthreadVideo` (lỗi "No frame found" với video dài).
- Remotion dùng thư mục tạm riêng `G:\Claude\BDSVideoStudio\tmp` (ngoài AppData\Local\Temp — thư mục đó từng bị xoá
  giữa lúc render làm lỗi "remotion-audio-mixing"); render lỗi thì tự thử lại 1 lần.
- Whisper: chỉ dùng `hotwords`; `initial_prompt` hoặc `condition_on_previous_text=False` làm mất cả đoạn.
- Nhạc lặp: `loopVolumeCurveBehavior="extend"` để vặn nhỏ đúng chỗ nói.
- CapCut: 1 track không cho 2 đoạn chồng nhau (SFX/ảnh chồng -> track 2, 3…); vùng che được làm mờ sẵn vào
  `video_capcut.mp4` vì CapCut không nhận vùng mờ; font Montserrat-ExtraBold dùng id kho font CapCut.
  Draft ghi vào thư mục draft CapCut đang dùng (đọc `globalSetting`), tên luôn có tiền tố `BDS_`.
- Shortcut Desktop trỏ `G:\Claude\BDSVideoStudio\launch.vbs` vì WScript không nhận chữ có dấu trong đường dẫn.
