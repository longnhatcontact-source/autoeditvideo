---
name: "auto-edit-video-bds"
description: "Dựng video TikTok BĐS hoàn chỉnh từ video thô cho Nhat Real Property (lọc ồn, chỉnh hình, tiêu đề, 104 mẫu khung chữ + 23 bố cục nhấn ý chính, SFX, cảnh bổ trợ, ảnh bìa, bản nhẹ rồi bản nét) theo đúng phong cách đã chốt. Dùng khi gửi video thô/kịch bản và bảo edit, dựng, làm video."
---

# Auto edit video BĐS (Nhat Real Property)

Biến video thô (quay mặt / ghi màn hình) thành video TikTok dọc 9:16 hoàn chỉnh, đúng phong cách anh Nhật đã duyệt. Mã nguồn dựng hình (Remotion 4) nằm ở repo GitHub `longnhatcontact-source/autoeditvideo`, nhánh `feat/chu-nhan`. Claude tự dựng trong phiên làm việc: **trên máy người dùng** qua app (nhanh hơn, mục "Dựng trên máy người dùng") hoặc **trên cloud** (mục "Dựng trên cloud"). App **BĐS Video Studio** (Electron; máy anh Nhật ở `G:\Claude\Chỉ căn\remotion-bds-v2`, máy mới cài bằng `CAI-DAT.bat` vào `%USERPROFILE%\BDSVideoStudio\app`) vừa là nơi Claude gửi việc dựng trên máy, vừa cho người dùng tự bấm.

## Đầu vào cần có
- Video thô (1 hoặc nhiều clip). Nếu người dùng chỉ nhắc mà chưa gửi file → hỏi lại.
- Kịch bản (nếu có) — dùng để sửa chữ nghe nhầm và lấy câu mở đầu làm tiêu đề.
- Cảnh bổ trợ (B-roll) nếu có: clip/ảnh dự án. Link Google Drive thường KHÔNG tải được từ phiên cloud → bảo người dùng nén zip gửi thẳng vào chat hoặc để trong thư mục đã kết nối. Không có B-roll thì vẫn dựng, cuối cùng nhắc người dùng gửi thêm.
- Yêu cầu riêng của lần này (vd "không cần SFX", "bật phụ đề"). Không rõ thì hỏi, đừng đoán.

## Quy trình
1. **Dựng nền**: ghép clip, khung 9:16 (nền mờ phía sau nếu clip ngang), cắt khoảng lặng (silencedetect -30dB, 0.7s) và câu nói vấp/lặp. Nếu video gốc có sẵn hiệu ứng chớp sáng / vệt màu ở chỗ nối → cắt bỏ các khung hình đó (đúng lúc im lặng để không mất chữ).
2. **Chỉnh hình — KHÔNG được quá sáng**: chỉ tăng nhẹ tương phản/bão hoà, hạ vùng sáng.
   - Clip SDR: `eq=contrast=1.07:saturation=1.18:gamma=0.96,curves=m='0/0 0.25/0.22 0.7/0.69 1/0.97',unsharp=5:5:0.4`
   - Clip HDR HLG (iPhone): `zscale=t=linear:npl=160,format=gbrpf32le,zscale=p=bt709,tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p` rồi `eq=contrast=1.08:saturation=1.15,curves=m='0/0 0.25/0.2 0.6/0.55 1/0.95',unsharp=5:5:0.5`
3. **Lọc tiếng ồn (bắt buộc với video quay ngoài trời)**: dùng DeepFilterNet (`cloud/denoise.sh <video> <ra.wav>`), sau đó nén nhẹ + tăng âm + limiter về khoảng −15 LUFS.
   - KHÔNG dùng `dynaudnorm`/`loudnorm` sau khi lọc (kéo tiếng nền lên lại). KHÔNG dùng gate/rnnoise+gate (lúc nói vẫn nghe tiếng xe và nghe phập phồng).
   - Đo kiểm: đoạn chưa nói phải ≤ −60 dB, mức giọng gần như giữ nguyên. Claude không nghe được âm thanh → nói rõ là chỉ đo bằng số và nhờ người dùng nghe lại.
4. **Nhận giọng nói**: faster-whisper `medium`, tiếng Việt, hotwords từ `tu-khoa.txt`, áp `sua-tu.txt`. Sửa chữ nghe nhầm theo ngữ cảnh + kịch bản (vd "mô giới"→"môi giới", "quy vạch"→"quy hoạch", "hiện hiếu"→"hiện hữu").
   - **TÊN RIÊNG (dự án, đường, chủ đầu tư, người) nghe chưa chắc → TRA WEB hoặc HỎI người dùng TRƯỚC khi đưa lên chữ.** Đừng đưa lên rồi mới báo. Vd whisper nghe "Metro Green Street" nhưng dự án thật là "Metro Grand Street"; "biệt thượng" là "biệt thự"; "Tây Ba Vì" là trục "Hồ Tây – Ba Vì".
   - **PHỤ ĐỀ PHÍA DƯỚI TẮT MẶC ĐỊNH** (`subPosition: "tat"`): ý chính được nhấn bằng khung chữ (bước 6). Chỉ bật khi người dùng yêu cầu; khi bật thì phụ đề ĐỨNG YÊN, cỡ tối đa 66px, màu nhấn #FFD23F, không hộp nền.
5. **Tiêu đề mở đầu** (~2.5–4s đầu): câu mở đầu kịch bản; không có thì 1 câu gây tò mò đúng nội dung. Đúng 1 cụm 2–4 chữ trong `*…*` làm chữ khối lớn; phần trước = dòng chữ ký nhỏ, phần sau = dòng nhỏ dưới. Tiêu đề mở đầu KHÔNG có SFX.
6. **Khung chữ nhấn ý chính** (thay cho phụ đề) — CHỈ ý chính: luận điểm, dữ kiện then chốt, từng mục liệt kê, điểm cộng / điểm cần cân nhắc, chuyển ý ("tuy nhiên"), kết luận, lời kêu gọi. Không gắn câu đệm/lặp ý. Mật độ khoảng 1 khung / 5–7 giây (video 80–90s ≈ 12–15 khung).
   - `top` 1–4 chữ, `main` 1–4 chữ ≤22 ký tự (rút gọn ý, đúng lời thoại), `sub` ≤30 ký tự (con số / chi tiết).
   - Không bắt đầu trước khi tiêu đề kết thúc; cách nhau ≥2s; không chồng thời gian; 2 khung liền nhau không cùng mẫu.
7. **104 mẫu khung chữ** (`src/CaptionedVideo/TitleTemplates.tsx`; danh sách máy đọc `lib/template-catalog.mjs`; **ẢNH XEM TRƯỚC `cloud/catalog/mau-chu-*.jpg`, đánh số 1–104**). Chọn theo công dụng từng ý, đa dạng mẫu + bố cục nhưng CÙNG TÔNG (vd pháp lý: orangegold/warning/redseal/framewhite; dự án cao cấp: framegold/luxgold/marble/statgold):
   - **Gốc (8)**: `city` vị trí · `bigyellow` từ khoá/số cực ngắn · `redbold` vấn đề, cảnh báo · `sea` mặt nước, cảnh quan · `marble` tên dự án · `luxgold` giá trị, kết luận đẹp · `neonsea` kết nối, tiện ích · `orangegold` pháp lý, chính sách
   - **Sang trọng / giá trị (10)**: `rosegold` tổ ấm cao cấp · `champagne` nghỉ dưỡng · `platinum` đẳng cấp hiện đại · `goldserif` biệt thự, kiến trúc · `bronze` lâu đời, uy tín · `copper` nhà ở gia đình · `pearl` căn hộ cao cấp · `royal` độc bản · `goldscript` slogan, cảm ơn · `sapphire` tài chính, vốn vay
   - **Thiên nhiên / cảnh quan (10)**: `emerald` cây xanh · `forest` sinh thái · `jade` phong thuỷ · `sky` view thoáng · `sunset` hoàng hôn · `lagoon` hồ, sông · `ocean` biển · `sand` resort · `mint` nhà mới · `aurora` độc đáo
   - **Cảnh báo / vấn đề (7)**: `fire` hot, cháy hàng · `alarm` nguy hiểm · `ruby` rủi ro, mất tiền · `redseal` đừng, bị phạt · `warning` lưu ý, điều kiện · `lava` tranh cãi · `question` câu hỏi
   - **Con số / dữ liệu (6)**: `bignumber` số lớn · `cyanfigure` thông số, khoảng cách · `limefigure` phần trăm · `goldnumber` tổng giá · `tealdata` kỹ thuật, quy hoạch · `countdown` hạn chót (đếm ngược)
   - **Neon / hiện đại (6)**: `neonpink` giới trẻ, studio · `neongreen` tiện ích đạt chuẩn · `neongold` phố đêm, kinh doanh · `neonpurple` giải trí · `neonwhite` thông điệp ngắn · `neonred` khuyến mãi
   - **Sạch / thông tin / kể chuyện (14)**: `cleanwhite` thông tin chung · `magazine` góc nhìn · `typewriter` định nghĩa · `stack` so sánh A/B · `handwritten` lời khuyên · `retro` gia đình · `headline` tin tức, ý lớn · `pastel` nội thất · `silverserif` văn phòng · `ice` không gian thoáng · `concrete` xây dựng, tiến độ · `wood` nội thất gỗ · `holo` nhà thông minh · `investor` đầu tư, cho thuê
   - **Khung chữ / số chạy (12)**: `statgold` đơn giá, giá/m² · `statwhite` số tầng, số căn, diện tích · `statred` mức phạt, chi phí · `percentlime` phần trăm, chiết khấu, lãi suất · `progresscyan` tiến độ, tỷ lệ đã bán · `framegold` tên dự án trang trọng, ý quan trọng · `framewhite` thông tin chính thức, tên dự án · `pillorange` mục liệt kê, tiêu chí · `cornermint` tiện ích, điểm cộng · `flipwhite` chuyển ý "nhưng / tuy nhiên" · `letterrose` thông điệp cảm xúc · `wordsyellow` khẩu hiệu, lời kêu gọi
   - **Theo video tham khảo (31)**: `sweepblue` mục mới · `duoyellow` khái niệm 2 tầng · `strikered` sai lầm, hiểu sai · `neonyellow` ưu điểm nổi bật · `whitered` khẳng định · `offsetyellow` từ khoá trẻ trung · `cardmsg` lời kêu gọi nhắn tin / câu khách hay hỏi (thẻ tin nhắn trắng) · `minimal` câu dẫn · `flickerprice` giá sốc · `selboxblue` thuật ngữ · `scribblered` câu hỏi gợi mở · `blueglow` công nghệ, Metro · `pillglow` mẹo nhỏ · `nextlevel` ra mắt, nâng cấp · `eventtag` ngày mở bán, sự kiện · `slabpurple` công bố · `comicred`/`cartoonblue`/`cartoonyellow` vui nhộn (CHỈ nội dung gia đình/ưu đãi, không dùng cho pháp lý/giá) · `filmic` kể chuyện · `flickerlime` năng động · `stickerblue` tính năng · `shinyblue` bật mí · `markerblue` bôi 1 cụm từ · `zipblue` chuyển ý nhanh · `yellowwhite` hạn mức, khoản vay · `glitchred` đáp án sai, bóc phốt · `streakwhite` "không bao giờ" · `bubbleorange` mở đầu câu chuyện · `outlineyellow` từ khoá lớn · `whiteredbrush` "sự thật rằng…"
   - **23 bố cục** (`layout`, áp cho các mẫu mở rộng; trống = mặc định của mẫu): center · left · right · inline · side · zigzag · bar · brackets · underline · lines · frame (khung viền tự vẽ) · pill (nhãn bo tròn) · stat (số to + đơn vị) · progress (thanh tiến độ) · corner (2 góc chéo) · marker (vệt bôi) · slab (mảng màu) · bubble (bong bóng thoại) · card (thẻ tin nhắn) · selbox (khung chọn) · strike (gạch ngang) · scribble (gạch chân viết tay) · offset (bóng viền lệch).
   - **Số chạy** (đếm từ ít lên số thật) CHỈ khi con số hiển thị ≥ 10.000 và chữ chính có đúng 1 con số; số nhỏ đứng yên. Giữ cách viết Việt (dấu phẩy thập phân, dấu chấm ngăn nghìn).
   - **Tránh kiểu "AI"**: không dùng chữ mảnh + viết thường kiểu câu văn + phát sáng tràn lan. Ưu tiên chữ IN HOA đậm (Montserrat Black, Anton, Oswald, League Spartan) kèm dòng chữ ký viết tay hoặc nhãn màu. Không nền/thẻ ĐEN sau chữ (mảng màu, thẻ trắng, bong bóng có màu thì được).
   - **Phông chữ (12, đều có bộ chữ tiếng Việt)**: Montserrat, Whisper (chữ ký), League Spartan, Lexend, Anton, Playfair Display, Be Vietnam Pro, Oswald, Pattaya, Lobster, Dancing Script, Baloo 2. KHÔNG thêm phông thiếu tiếng Việt (vd Poppins → dùng Be Vietnam Pro). Thêm phông phải thêm cả vào `src/load-font.ts`, `cloud/load-font.offline.ts`, `cloud/fonts/`.
   - Thêm/sửa mẫu: sửa `PRESETS` trong TitleTemplates.tsx → `python scripts/gen_template_catalog.py` → chụp lại bảng `cloud/catalog/` → `node scripts/prebuild-bundle.mjs` → commit.
8. **Vị trí chữ**: KHÔNG che mắt/miệng/mặt. Video thường (mặt ở giữa–dưới): đặt CAO (y ≈ 0.17–0.32). Video selfie mặt chiếm giữa khung: đặt DƯỚI mặt, vùng áo (y ≈ 0.58–0.76 — chọn chỗ áo TỐI, vd áo navy ≈ 0.6), tránh vùng chú thích TikTok (≥ 0.85). scale 0.8–0.9. Người nói di chuyển/đổi cảnh thì chỉnh riêng từng khung.
9. **Độ tương phản**: đo độ sáng nền sau khối chữ (lib/contrast.mjs `withBackground`) TRÊN VIDEO ĐÃ CHÈN CẢNH BỔ TRỢ, cho cả khung chữ lẫn tiêu đề (hookBg). **KHÔNG BAO GIỜ đảo thành chữ đen quầng sáng** (anh Nhật đã từ chối 16/10/2026: "t bảo bỏ mấy cái phông chữ kiểu này đi cơ mà?"; mã đã bỏ cơ chế đảo). Nền ≥ 0,55 → đo thử nhiều vị trí y (0.14…0.78) rồi dời khung sang chỗ nền tối (áo tối, mảng cây) mà không che mặt; vẫn sáng thì đổi cảnh bổ trợ tối hơn hoặc dùng mẫu có nền riêng (thẻ, mảng, bong bóng). Chụp soát ảnh cao `STILL_SCALE=1` để thấy rõ dấu tiếng Việt. Nền áo kẻ sọc/rối → chọn mẫu chữ đậm, màu nổi (vàng, trắng đậm), tránh màu tím/xanh đậm.
10. **KHÔNG zoom vào chỗ quan trọng**: `punchZoom: false` (mặc định).
11. **SFX — chỉ ở KHUNG CHỮ NHẤN**: bộ 20 tiếng anh Nhật chọn (`assets/sfx/nr-*.mp3`), mỗi mẫu đã gắn sẵn tiếng (templateSounds), `calloutSfx: 1`. Không đặt SFX ở tiêu đề mở đầu, chuyển cảnh hay chỗ khác (`sfx: []`). KHÔNG SFX meme/hài.
12. **Cảnh bổ trợ (B-roll)** — để video không bị 1 khung hình:
    - Xem từng clip (chụp tờ khung hình), chỉ chèn cảnh KHỚP nội dung đang nói, mỗi cảnh 1.5–4s. Cảnh không khớp thì không dùng. Không tự lấy hình trên mạng.
    - Giữ mặt người nói ở câu mở đầu, đoạn nêu giá/lưu ý quan trọng, lời kêu gọi cuối.
    - Chuyển cảnh: mờ chồng 0.3s; từ người nói sang cảnh có thể trượt từ dưới lên. Không chớp trắng, xoay, zoom giật. Clip ngang: cắt dọc + lia ngang chậm.
    - Video giới thiệu của chủ đầu tư thường có chữ chú thích (tên phân khu, diện tích…) ở góc: cắt dọc né vùng chữ đó, không để lộ chữ bị cắt dở. Ảnh phối cảnh (render) của dự án khác không dùng minh hoạ cho dự án đang nói nếu người dùng không yêu cầu.
    - Làm bằng `cloud/broll.py <nền.mp4> <plan.json> <ra.mp4>`; báo người dùng bảng "giây – lời nói – cảnh chèn" và các cảnh chưa dùng.
13. **Ảnh bìa** 1080×1920: chữ ĐẶT GIỮA/nửa trên, tiêu đề có `*…*`, 0–2 ý chính ≤40 ký tự có dữ kiện cụ thể; KHÔNG che mặt. Mặt nằm giữa khung → làm nền = khung hình mờ + khung hình rõ dời xuống ~620px (lệnh trong `cloud/README.md`, ví dụ `cloud/example/cover.phudien.json`). Cụm chữ khối lớn có dấu chồng (Ố, Ấ…) dễ đè lên dòng chữ ký phía trên → chọn cụm không có dấu chồng hoặc kiểm tra ảnh.
14. **Soát bản nháp như editor** (bắt buộc trước khi gửi): chụp khung hình giữa mỗi khung chữ + tiêu đề + ảnh bìa, ghép thành 1 tờ, tự nhìn và sửa: che mặt? chìm trên nền sáng/rối? dấu tiếng Việt bị cắt/lỗi (dấu nặng dưới chữ, dấu chồng)? chữ bị cắt mép? chữ quá nhỏ? sai chính tả, sai TÊN RIÊNG? ý không chính? mẫu hợp nghĩa? trông "kiểu AI"? có chữ đen đảo màu không? Sửa xong chụp lại soát vòng 2.
15. **Xuất**: dựng trên CLOUD → LUÔN làm **bản nhẹ trước** (720×1280) gửi duyệt (nếu >30MB thì nén lại crf 29–30 để gửi được qua chat) → OK mới xuất **bản nét** (1080×1920, crf 20). Dựng TRÊN MÁY người dùng → bỏ bản nhẹ: soát bằng ảnh chụp khung hình (bước 14), duyệt xong dựng thẳng bản nét, chép ra Downloads, gửi kèm bản nén <30MB trong chat để xem nhanh. Luôn kèm ảnh bìa PNG. Bản nét >30MB: để vào Downloads trên máy người dùng (nếu đã kết nối) + gửi bản 1080p nén gọn trong chat.

## Nội dung & pháp lý (bắt buộc)
- Chỉ dùng thông tin có trong lời thoại/kịch bản. Không bịa số liệu, giá, pháp lý, tên.
- Không viết cam kết lợi nhuận, "chắc chắn tăng giá", "số 1", "duy nhất", "rẻ nhất". Không đưa số điện thoại lên video.
- Liệt kê các chỗ có số liệu/ngày tháng/pháp lý/tên riêng cần tự soát trước khi đăng (kể cả khi lời thoại tự mâu thuẫn, vd tiêu đề "4 tỷ" nhưng nói "4 tỷ 6"). Số liệu chưa tìm được nguồn → hỏi người dùng trước khi đưa lên khung chữ.

## Dựng trên máy người dùng (nhanh gấp ~2 lần, bản nét không nén) — ưu tiên khi đủ điều kiện
Điều kiện: phiên có tool `mcp__remote-devices__*` (đã liên kết máy Windows) + thư mục app đã kết nối + app BĐS Video Studio đang mở (`jobs/worker.json` có `alive` mới ≤10 giây). Thiếu điều kiện nào → nhờ người dùng (mở app bằng `MO-APP.bat` / lối tắt "BDS Video Studio (Claude)"; máy mới chạy `CAI-DAT.bat` trong repo) hoặc dựng trên cloud như mục dưới.
- **ĐỌC `cloud/LOCAL.md`** (trong repo; đọc qua `device_bash` ở thư mục app đã kết nối, hoặc bản clone trên cloud): cách nhận biết, định dạng phiếu việc, các loại bước, lỗi đã gặp. Ví dụ thật: `cloud/example/job.parkcity.json`.
- Claude làm phần nghĩ (xem video, chọn ý, tra tên riêng, chọn cảnh, viết props, soát ảnh); app làm phần nặng native. Gửi việc = ghi JSON vào `jobs/inbox/` (ghi `.tmp` rồi `mv`), theo dõi `jobs/run/<id>/status.json` + `log.txt` bằng nhiều lệnh `sleep 40` (mỗi lệnh `device_bash` tối đa 45 giây).
- `device_bash` chạy trong máy ảo Linux nhỏ (2 nhân, 2GB) — KHÔNG dựng/chạy nặng trong đó, chỉ đọc/ghi file và theo dõi.
- Video gốc + B-roll nên nằm trong thư mục đã kết nối (Downloads…) để app đọc thẳng.
- Chất lượng giống bản cloud (đã so: SSIM 0,988, chữ/dấu/màu y hệt). Đo thật trên i5-1240P/8GB, video 75s: ~12 phút máy chạy (cloud ~25–30 phút). Phần dựng hình (~6–7 phút) là mức sàn trên máy 8GB; KHÔNG dùng `videoEngine: "offthread"` trên máy 8GB (lỗi "No frame found").

## Dựng trên cloud (khi không có máy đã liên kết) — mọi thứ nằm trên GitHub
Cần: phiên Claude có máy ảo chạy lệnh được + quyền đọc repo `longnhatcontact-source/autoeditvideo`. Không cần app, không cần máy anh Nhật.
1. **Cài 1 lần mỗi phiên**: `git clone --single-branch --branch feat/chu-nhan https://github.com/longnhatcontact-source/autoeditvideo && cd autoeditvideo && bash cloud/setup.sh` — cài thư viện, phông chữ offline, 20 SFX, bộ lọc ồn, faster-whisper + model `medium` (lấy từ nhánh `models` của repo vì HuggingFace thường bị chặn). Mất vài phút, cần ~4GB ổ trống.
2. **ĐỌC `cloud/README.md` trước khi làm**: bảng lệnh từng bước, quy tắc chữ đã chốt, danh sách lỗi đã gặp + cách xử lý (phông chữ, video phải là VP9 webm, đầy ổ, HDR iPhone, file >30MB, Google Drive, không chạy 2 lệnh dựng cùng lúc…). Xem `cloud/catalog/` để biết mặt từng mẫu trước khi chọn.
3. Các lệnh: `cloud/denoise.sh` (lọc ồn) · `cloud/transcribe.sh` (nhận giọng nói → raw.json) · `cloud/broll.py` (chèn cảnh bổ trợ) · `cloud/to-webm.sh` (đưa video vào public; chạy nền) · `node cloud/render.mjs stills|video|cover` (soát khung hình — thêm `STILL_SCALE=1` để chụp nét, bản nhẹ `lite` / bản nét `net`, ảnh bìa).
4. Tạo props: theo 2 ví dụ thật `cloud/example/make-props.astor1.mjs` (có B-roll, chữ đặt cao) và `make-props.phudien.mjs` (selfie, chữ đặt dưới mặt, sửa tên riêng) + `base-props.json` + `cover.*.json`. Props chính: src, captions, durationInFrames, hookText/hookStyle/hookY/hookScale/hookBg, callouts[{at,sec,style,layout,top,main,sub,x,y,scale,bg}], sfx: [], calloutSfx: 1, punchZoom: false, subPosition: "tat", keepTogether.
5. Thứ tự: cắt + chỉnh hình → lọc ồn → nhận giọng nói → tra tên riêng → (chèn B-roll) → webm → props → chụp khung hình soát → bản nhẹ → duyệt → bản nét + ảnh bìa.
- Lưu ý lệnh: `pkill -f`/`pgrep -f` khớp cả dòng lệnh của chính shell đang chạy (tự giết shell / vòng chờ không bao giờ thoát) → dùng `pgrep -a` rồi kill theo PID, hoặc kiểm tra file kết quả.
- Nếu không clone được repo (không có quyền): báo người dùng xin chủ repo cấp quyền đọc; đừng tự dựng lại bằng công cụ khác.
- Sửa `src/` thì chạy `node scripts/prebuild-bundle.mjs` rồi commit. Chỉ chủ repo mới đẩy thay đổi lên; tài khoản khác chỉ đọc.

## Người dùng tự bấm trong app (cách phụ)
- **+ Video mới** → chọn clip → tick **Tự dựng hoàn chỉnh** → dán kịch bản → app tự làm tiêu đề, khung chữ, SFX, ảnh bìa và xuất bản nhẹ vào Downloads. Phụ đề mặc định tắt (bật lại ở tab Phụ đề). App CHƯA có lọc ồn DeepFilterNet và chèn B-roll tự động — hai bước này làm tay theo mục trên.

## Phản hồi anh Nhật đã từng đưa (đừng lặp lại lỗi)
- "Đừng làm mấy cái chữ có phông đen" → không nền đen sau chữ.
- "Màu trắng trên trời bị xấu / nền sáng không rõ chữ"; "t bảo tránh mấy cái chữ như này mà?" (khung trắng trên trần màu kem) → luôn kiểm tra tương phản.
- "t bảo bỏ mấy cái phông chữ kiểu này đi cơ mà?" (chữ bị đảo thành đen quầng sáng trên nền sáng) → không đảo màu nữa; dời vị trí khung chữ sang nền tối / đổi cảnh.
- "Bỏ phụ đề phía dưới, nhấn các ý nổi bật bằng các frame chữ" (nhắc lại nhiều lần) → subPosition "tat", nhiều khung chữ hơn.
- "Sao cái nào có số cũng chạy? chỉ chạy số liệu từ 10000 đơn vị" → ngưỡng 10.000.
- "81, 84, 86… không đẹp, hiệu ứng font chữ bị AI quá" → bỏ chữ mảnh/viết thường/phát sáng; dùng IN HOA đậm + chữ ký.
- "Không được lỗi font tiếng Việt" → chỉ dùng phông có bộ tiếng Việt; mã đã chuẩn hoá NFC; soát dấu trong ảnh chụp.
- "Metro Green Street là dự án nào? / thế m để trong video t là cái gì" → đã đưa tên nghe nhầm lên video. Tên riêng phải tra/hỏi trước.
- "Chỉ ghi số căn, không ghi diện tích" (video ParkCity) → khi lấy số liệu từ video chủ đầu tư, chỉ hiện đúng loại số người dùng đồng ý.
- "Đừng có zoom zoom vào mấy chỗ quan trọng" → tắt punch zoom.
- "Sound effect nghe chán" → bộ nr-*; "chỉ thêm vào những chữ nhấn"; "SFX nghe không rõ" → đã cân mức.
- "Không xoá ồn à / vẫn nghe tiếng xe máy, ô tô" → DeepFilterNet.
- "Hình ảnh bị sáng quá" → chỉnh màu nhẹ, hạ highlight.
- "Chèn video để tránh bị 1 khung hình, chuyển cảnh chuyên nghiệp" → B-roll khớp nội dung.
- "Bỏ meme hài, chuyên nghiệp"; "Không làm bừa, chắt lọc ý chính key".
- "Nhớ làm bản nhẹ trước"; "Ảnh bìa đâu?" → luôn kèm ảnh bìa. (Dựng trên máy người dùng: soát bằng ảnh khung hình thay cho bản nhẹ — anh Nhật đồng ý 19/10/2026.)

## Cập nhật skill này
- Bản gốc của skill nằm trong repo: `cloud/skill/SKILL.md` (anh Nhật sửa và đẩy lên GitHub). Khi đã clone repo trong phiên, so nội dung file đó với skill đang dùng; khác nhau → báo người dùng và đề xuất cập nhật bằng `propose_skills` (kind `improvement`, dán NGUYÊN VĂN file trong repo) để họ bấm lưu.
- Cài cho tài khoản/máy mới: làm theo `HUONG-DAN-CHO-CLAUDE.md` ở thư mục gốc repo.

## Giao tiếp
- Tiếng Việt, ngắn gọn đủ ý, chuyên nghiệp. Không hiểu thì hỏi lại.
- Gửi bản nhẹ + ảnh bìa + danh sách cần soát; nói rõ chỗ nào chưa chắc/chưa kiểm được (nhất là âm thanh, chuyển động, tên riêng). Không tự xoá file nào của người dùng.