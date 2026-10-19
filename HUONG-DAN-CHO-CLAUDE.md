# Hướng dẫn cho Claude: cài "Auto edit video BĐS" cho người dùng mới

> Người dùng đưa file này cho Claude (đính kèm, hoặc nói "đọc HUONG-DAN-CHO-CLAUDE.md trong repo
> longnhatcontact-source/autoeditvideo và cài cho tôi"). Claude làm lần lượt các phần dưới, tự làm hết phần làm được,
> chỉ nhờ người dùng ở những bước bắt buộc phải bấm tay. Trả lời người dùng bằng tiếng Việt, ngắn gọn.

Mục tiêu khi xong:
1. Tài khoản Claude của người dùng có skill **auto-edit-video-bds** (dựng video TikTok BĐS theo phong cách Nhat Real Property).
2. Dựng được video **trên cloud** (không cần cài gì).
3. (Tuỳ chọn, máy Windows) dựng được **trên máy** của họ qua app BĐS Video Studio — nhanh gấp ~2 lần, bản nét gốc vào Downloads.

Quy tắc chung: không xoá file nào của người dùng; không đẩy (push) gì lên repo (người dùng khác chỉ có quyền đọc);
không gửi thông tin trong máy/tài khoản người dùng ra ngoài; bước nào lỗi → nói rõ lỗi + cách sửa, không đoán bừa.

---

## Phần 1 — Quyền đọc repo
1. Gọi `add_repo` với owner `longnhatcontact-source`, repo `autoeditvideo`. (Đừng thử curl/`git ls-remote` trước: repo riêng tư sẽ báo 404 giả.)
2. Bị từ chối quyền → báo người dùng đúng lý do tool trả về, và nhắc 2 việc:
   - Nhắn anh Nhật (chủ repo) thêm **tài khoản GitHub của họ** làm Collaborator của repo, rồi bấm **Accept** trong email mời.
   - Kết nối GitHub với Claude (Settings → Connectors / theo hướng dẫn tool trả về).
   Làm xong thì thử lại. Không làm tiếp khi chưa đọc được repo.
3. Đọc được → clone đúng nhánh, chỉ 1 nhánh (nhánh `models` nặng 1,5GB, không cần):
   `git clone --single-branch --branch feat/chu-nhan https://github.com/longnhatcontact-source/autoeditvideo`

## Phần 2 — Cài skill
1. Đọc `cloud/skill/SKILL.md` trong bản clone.
2. Gọi `propose_skills` với 1 đề xuất: `name` = `auto-edit-video-bds`, `kind` = `new` (đã có skill cùng tên → `improvement`, `target` = tên đó),
   `description` = dòng description trong frontmatter, `skillMd` = **nguyên văn** file đó. Nhắc người dùng bấm **lưu** trên thẻ.
3. Nếu không có tool `propose_skills`: gửi file zip skill cho họ (nén thư mục `auto-edit-video-bds/SKILL.md`) và hướng dẫn
   Customize → Skills → **+** → Upload. Nhắc bật Settings → Capabilities → **Code execution and file creation**.

## Phần 3 — Kiểm tra dựng trên cloud
1. Trong bản clone: `bash cloud/setup.sh` (vài phút, ~4GB ổ; cài thư viện, phông, SFX, bộ lọc ồn, model nhận giọng từ nhánh `models`).
2. Thấy `SETUP_DONE` là xong. Báo người dùng: từ giờ gõ `/auto-edit-video-bds` kèm video thô là dựng được (~25–30 phút máy chạy / video 75 giây,
   bản nét gửi qua chat phải nén ≤30MB). Lỗi → xem mục "Lỗi đã gặp" trong `cloud/README.md`.

## Phần 4 — (Tuỳ chọn) Cài dựng trên máy Windows
Chỉ làm khi người dùng muốn và **phiên này đã liên kết máy tính** của họ (có các tool `mcp__remote-devices__*`).
Không có → hướng dẫn: cài app Claude cho máy tính, đăng nhập đúng tài khoản, mở phiên này trong app và chọn liên kết với máy; rồi làm tiếp.

1. `get_device_info`: phải là `win32`. Xem `connectedFolders`; chưa có Downloads → `device_request_folder_access` với `~/Downloads`
   (lý do: "Để chép bộ cài và đọc/ghi video").
2. Đưa `CAI-DAT.bat` (ở gốc bản clone) vào Downloads của họ: `SendUserFile` file đó (display `attach`) rồi `device_commit_files`
   tới `C:\Users\<tên>\Downloads\CAI-DAT.bat` (lấy đường dẫn home từ `connectedFolders`). Không được thì nhờ họ tải file trong chat về Downloads.
3. Nhờ người dùng **bấm đúp `CAI-DAT.bat`** (Windows có thể hiện "Windows protected your PC" → More info → Run anyway).
   Nói trước: lần đầu 15–30 phút; Git sẽ mở trình duyệt để đăng nhập GitHub (đăng nhập tài khoản đã được thêm ở Phần 1);
   gặp dòng "Chua tim thay ... sau khi cai" thì đóng cửa sổ và bấm đúp lại; lỗi khác thì chụp màn hình gửi Claude.
   File tự cài: Git, Node.js LTS, Python 3.12, ffmpeg (winget) → mã nguồn vào `%USERPROFILE%\BDSVideoStudio\app` → npm + faster-whisper
   → model nhận giọng (~1,5GB) → lối tắt **BDS Video Studio (Claude)** ngoài màn hình.
4. Khi họ báo xong: `device_request_folder_access` với `~/BDSVideoStudio/app` (lý do: "Để gửi việc dựng video cho app").
   Kiểm tra trong máy ảo của `device_bash` (thư mục đã kết nối nằm ở `/sessions/<phiên>/mnt/<tên thư mục>`): có `package.json`,
   `node_modules/@esbuild/win32-x64/esbuild.exe`.
5. Nhờ họ mở **BDS Video Studio (Claude)** và để cửa sổ đen mở. Chờ `jobs/worker.json` có `"alive"` mới (≤10 giây).
6. Chạy thử 1 phiếu việc (ghi `.tmp` rồi `mv` vào `jobs/inbox/`):
   ```json
   {"id":"kiem-tra","steps":[{"type":"setup"},{"type":"probe"}]}
   ```
   Đọc `jobs/run/kiem-tra/status.json` (phải `done`) và `probe.json`: `python` phải in ra phiên bản + faster-whisper, `ffmpeg` có,
   `encoders` có `libx264` và `libvpx-vp9`, `deepFilter: true`. Thiếu gì → chạy lại `CAI-DAT.bat` hoặc sửa theo `cloud/LOCAL.md` mục "Lỗi đã gặp".
7. Báo người dùng: máy đã sẵn sàng; mỗi lần dựng chỉ cần mở **BDS Video Studio (Claude)**, để video thô trong Downloads,
   gõ `/auto-edit-video-bds`. Chi tiết cách Claude gửi việc cho app: `cloud/LOCAL.md`.

## Phần 5 — Cập nhật về sau
- App trên máy tự lấy bản mới từ GitHub mỗi lần mở và mỗi 30 giây khi đang mở. Không sửa tay file trong thư mục app (sửa tay → app ngừng tự cập nhật).
- Dựng trên cloud luôn clone bản mới nhất.
- Skill: khi `cloud/skill/SKILL.md` trong repo khác skill đang cài → đề xuất cập nhật như Phần 2 (kind `improvement`).
- Thư viện mới (hiếm): chạy lại `CAI-DAT.bat`.
