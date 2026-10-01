// "Tự dựng hoàn chỉnh" bằng Claude: 1 lần gọi đọc lời thoại (+ kịch bản nếu có) + vài khung hình,
// trả về: sửa chữ nghe nhầm, tiêu đề mở đầu, chữ nhấn, chữ ảnh bìa, vị trí đặt chữ, các ý cần soát số liệu.
import fs from "node:fs";
import path from "node:path";
import { askClaudeJson, CALLOUT_STYLES, cleanCallouts, sentencesFromCaptions } from "./callouts.mjs";
import { run } from "./media.mjs";

const TEMPLATES = CALLOUT_STYLES.slice(0, 8);

const SYSTEM = `Bạn là editor video TikTok chuyên nghiệp cho môi giới bất động sản Việt Nam. Bạn nhận lời thoại đã nhận dạng tự động (có mốc giây, có thể nghe nhầm), kịch bản gốc (nếu có) và vài khung hình của video. Hãy lên toàn bộ phần chữ cho video.

1) "fixes": sửa chữ nhận dạng sai. Mỗi phần tử ["cụm sai đúng như trong lời thoại", "cụm đúng"]. Chỉ sửa lỗi nghe nhầm (chính tả, tên riêng, thuật ngữ BĐS: "mô giới"→"môi giới", "sử phạt"→"xử phạt", "đầu giá"→"đấu giá"...), dựa vào ngữ cảnh và kịch bản. Không đổi ý, không viết lại câu. Cụm sai phải khớp nguyên văn các chữ liên tiếp trong lời thoại.

2) "hook": tiêu đề mở đầu hiện ~3 giây đầu. Nếu có kịch bản thì lấy câu mở đầu của kịch bản. Không có thì viết 1 câu gây tò mò đúng nội dung. Đặt đúng 1 cụm 2–4 chữ trong *…* làm chữ khối lớn; phần trước là dòng chữ ký nhỏ; phần sau (nếu có) là dòng nhỏ dưới. Ví dụ: "Môi giới BĐS *bị phạt rất nhiều* nếu như..." · "Metro có làm *tăng giá* bất động sản?". "hookStyle": 1 kiểu bên dưới.

3) "callouts": chữ nổi bật CHỈ cho ý chính thật sự (luận điểm, dữ kiện then chốt, từng mục trong danh sách "thứ nhất/thứ hai...", kết luận, lời kêu gọi). Không gắn cho câu dẫn, câu đệm, câu lặp ý. Thà ít mà trúng. Khoảng 1 chữ nhấn mỗi 8–10 giây; video liệt kê thì mỗi mục 1 chữ nhấn.
Mỗi chữ nhấn: {"at": giây bắt đầu câu, "sec": 2.5–9 (phủ hết câu đó), "style", "top", "main", "sub"}
- "top": dòng chữ ký nhỏ phía trên, 1–4 chữ (vd "Thứ nhất", "Dự án", "Hạ tầng"), có thể "".
- "main": chữ khối lớn, 1–4 chữ, ≤ 22 ký tự, rút gọn ý (không chép nguyên câu). Vd "Không chứng chỉ", "Rút ngắn", "Metro Grand Street".
- "sub": dòng nhỏ dưới ≤ 30 ký tự, có thể "". Đặt con số/mức tiền ở đây khi main là nội dung, vd "Phạt 40–60 triệu".
- Không bắt đầu trước khi tiêu đề mở đầu kết thúc. Các chữ nhấn cách nhau ≥ 3 giây, không chồng thời gian. 2 chữ nhấn liền nhau không cùng kiểu.

Kiểu ("style") — chỉ dùng 8 kiểu này:
- "city": vị trí, khu vực, trung tâm · "bigyellow": từ khoá/con số cực ngắn 1–2 chữ · "redbold": vấn đề, câu hỏi, cảnh báo, nỗi đau
- "sea": biển, sông, hồ, cảnh quan · "marble": tên dự án / sản phẩm (top = loại hình, sub = địa danh) · "luxgold": giá trị, đẳng cấp, kết luận đẹp
- "neonsea": kết nối, khoảng cách, tiện ích, hiện đại · "orangegold": pháp lý, quy định, bàn giao, chính sách, con số

4) "y": vị trí dọc mặc định của khối chữ (0 = mép trên, 1 = mép dưới), nhìn khung hình để đặt lên vùng trống phía trên đầu người nói, KHÔNG che mắt/miệng, không xuống nửa dưới (phụ đề nằm ~0.8). Thường 0.18–0.32. "scale": 0.75–0.95 (người đứng xa, nhiều khoảng trống thì lớn hơn). Nếu ở đoạn nào người nói di chuyển / đổi cảnh, ghi riêng "y" (và "scale") vào chữ nhấn đó theo khung hình gần nhất; "hookY" cho tiêu đề mở đầu.

5) "cover": ảnh bìa {"title": như hook hoặc hay hơn, có *…*; "style"; "points": 0–2 ý ≤ 40 ký tự có dữ kiện cụ thể; "sec": giây có khung hình đẹp nhất làm nền (nhìn khung hình: mặt rõ, đang cười/biểu cảm, nền gọn)}.

6) "checks": danh sách các câu có số liệu, ngày tháng, pháp lý, cam kết mà người đăng cần tự soát trước khi đăng (ngắn gọn, kèm giây). Nếu một con số chỉ áp cho một nhóm (vd chỉ áp cho tổ chức) thì ghi rõ lưu ý.

Quy tắc bắt buộc: CHỈ dùng thông tin có trong lời thoại/kịch bản. Không bịa số liệu, giá, pháp lý, tên. Không viết cam kết lợi nhuận, "chắc chắn tăng giá", "số 1", "duy nhất", "rẻ nhất". Tiếng Việt có dấu đầy đủ.
Chỉ trả về JSON: {"fixes":[[string,string]],"hook":string,"hookStyle":string,"hookY":number,"callouts":[...],"y":number,"scale":number,"cover":{...},"checks":[string]}`;

/** lấy n khung hình nhỏ đều nhau (để Claude nhìn bố cục + chọn khung bìa) */
async function sampleFrames(video, durationSec, workDir, n = 6) {
  fs.mkdirSync(workDir, { recursive: true });
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = Math.min(durationSec - 0.3, ((i + 0.5) * durationSec) / n);
    const f = path.join(workDir, `plan_${i}.jpg`);
    const r = await run("ffmpeg", ["-y", "-v", "error", "-ss", t.toFixed(2), "-i", video, "-frames:v", "1", "-vf", "scale=270:480", "-q:v", "5", f]);
    if (r.code === 0 && fs.existsSync(f)) out.push({ t, path: f, data: fs.readFileSync(f).toString("base64") });
  }
  return out;
}

const okStyle = (s, def) => (TEMPLATES.includes(s) ? s : def);
const num = (v, lo, hi, def) => (Number.isFinite(Number(v)) ? Math.min(hi, Math.max(lo, Number(v))) : def);

/**
 * Claude lên phần chữ cho cả video. captions: phụ đề hiện tại; script: kịch bản (tuỳ chọn).
 * Trả về { fixes, hook, callouts, cover, checks } đã làm sạch.
 */
export async function planVideo({ video, captions, script = "", durationSec, workDir, hookSec = 3 }) {
  const sentences = sentencesFromCaptions(captions);
  if (!sentences.length) throw new Error("Video chưa có phụ đề để dựng");
  const transcript = sentences.map((s) => `[${s.start.toFixed(1)}–${s.end.toFixed(1)}] ${s.text}`).join("\n");
  // khoảng 1 khung / 5 giây (6–14 khung) để thấy người nói di chuyển, đổi cảnh
  const nFrames = Math.max(6, Math.min(14, Math.round(durationSec / 5)));
  const frames = await sampleFrames(video, durationSec, workDir, nFrames).catch(() => []);
  const content = [
    ...frames.flatMap((f) => [
      { type: "text", text: `Khung hình ở giây ${f.t.toFixed(1)}:` },
      { type: "image", path: f.path, source: { type: "base64", media_type: "image/jpeg", data: f.data } },
    ]),
    {
      type: "text",
      text: `Tổng thời lượng: ${durationSec.toFixed(1)} giây. Tiêu đề mở đầu hiện ${hookSec} giây đầu.\n\nKịch bản gốc:\n${script.trim() || "(không có)"}\n\nLời thoại nhận dạng tự động:\n${transcript}`,
    },
  ];
  const r = await askClaudeJson(SYSTEM, content, 6000);

  const y = num(r?.y, 0.12, 0.5, 0.28);
  const scale = num(r?.scale, 0.6, 1.1, 0.85);
  const hookText = String(r?.hook || "").slice(0, 120);
  const callouts = cleanCallouts(
    (Array.isArray(r?.callouts) ? r.callouts : []).map((c) => ({ ...c, style: okStyle(c?.style, "luxgold"), x: 0.5, y: num(c?.y, 0.1, 0.5, y), scale: num(c?.scale, 0.6, 1.1, scale) })),
    durationSec,
  )
    .filter((c) => c.main && c.at >= (hookText ? hookSec : 0) - 0.05)
    .sort((a, b) => a.at - b.at)
    .reduce((acc, c) => {
      const prev = acc[acc.length - 1];
      if (prev && c.at < prev.at + prev.sec) {
        if (c.at - prev.at < 2) return acc; // trùng chỗ: bỏ
        prev.sec = Math.round((c.at - prev.at - 0.1) * 10) / 10; // co chữ trước lại
      }
      acc.push(c);
      return acc;
    }, []);
  const cv = r?.cover || {};
  return {
    fixes: (Array.isArray(r?.fixes) ? r.fixes : [])
      .filter((f) => Array.isArray(f) && typeof f[0] === "string" && typeof f[1] === "string" && f[0].trim() && f[0].trim() !== f[1].trim())
      .slice(0, 60),
    hook: hookText ? { text: hookText, style: okStyle(r?.hookStyle, "redbold"), x: 0.5, y: num(r?.hookY, 0.1, 0.5, y), scale } : null,
    callouts,
    cover: {
      title: String(cv.title || hookText || "").slice(0, 120),
      style: okStyle(cv.style, okStyle(r?.hookStyle, "redbold")),
      points: (Array.isArray(cv.points) ? cv.points : []).map((p) => String(p).slice(0, 48)).slice(0, 2),
      sec: num(cv.sec, 0, Math.max(0, durationSec - 0.3), durationSec * 0.4),
    },
    checks: (Array.isArray(r?.checks) ? r.checks : []).map((c) => String(c).slice(0, 200)).slice(0, 12),
  };
}
