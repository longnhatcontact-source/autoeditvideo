# Thư viện SFX (nhánh `sfx-lib`)

872 tiếng (đã bỏ trùng) từ "Bộ 1000 Sound Xu Hướng" anh Nhật gửi 18/11/2026, chuyển về mp3 192k, bỏ khoảng lặng đầu, tối đa 12 giây.
- `index.json`: danh sách `{id, group, dur, peak_db, mean_db, source}` — `id` là đường dẫn dùng trong props (`lib/<id>` khi đã chép vào `public/sfx/lib/`).
- Nhóm: whoosh, impact, riser, pop, click, ui, notify, money, paper, keyboard, camera, counter, data, glitch, metal, shatter, zoom, alarm, ambience, other, **meme (KHÔNG dùng cho video BĐS)**.
- Lấy về: `bash cloud/sfx-lib.sh` (cloud) — app trên máy tự lấy ở bước `setup`.
- Lưu ý bản quyền: một số file gốc tên `ES_…` có thể từ Epidemic Sound (cần gói thuê bao khi đăng thương mại). Ưu tiên bộ `nr-*` đã chọn trong `assets/sfx/`.
