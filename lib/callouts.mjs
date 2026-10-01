// "Chữ nhấn": chữ hiệu ứng lớn giữa màn hình ở đoạn quan trọng (vẽ ở src/CaptionedVideo/Callouts.tsx)
import { getAiConfig } from "./settings.mjs";

// khớp CALLOUT_STYLES trong src/CaptionedVideo/Callouts.tsx
export const CALLOUT_STYLES = [
  "city", "bigyellow", "redbold", "sea", "marble", "luxgold", "neonsea", "orangegold",
  "red", "neon", "gold", "type", "banner", "pop", "outline", "editorial", "stamp",
];
const MAX_TEXT = 40;

// tâm khối chữ (0..1) + cỡ; khớp CALLOUT_DEFAULT_POS trong src/CaptionedVideo/Callouts.tsx
export const DEFAULT_POS = { x: 0.5, y: 0.3, scale: 1 };
const num = (v, lo, hi, def) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : def;
};

const str = (v) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, MAX_TEXT) : "");

/** Làm sạch danh sách chữ nhấn; giữ thứ tự người dùng (không tự sắp xếp khi đang gõ) */
export function cleanCallouts(list, durationSec = Infinity) {
  return (Array.isArray(list) ? list : [])
    .map((c) => ({
      at: Math.max(0, Math.min(Number(c?.at) || 0, Math.max(0, durationSec - 1))),
      sec: Math.max(1.5, Math.min(8, Number(c?.sec) || 3.5)),
      style: CALLOUT_STYLES.includes(c?.style) ? c.style : "red",
      top: str(c?.top),
      main: str(c?.main),
      sub: str(c?.sub),
      x: num(c?.x, 0.1, 0.9, DEFAULT_POS.x),
      y: num(c?.y, 0.05, 0.95, DEFAULT_POS.y),
      scale: num(c?.scale, 0.5, 1.5, DEFAULT_POS.scale),
    }))
    .filter((c) => c.main || c.top || c.sub);
}

/** Gom phụ đề từng chữ thành câu có mốc thời gian (giây) để đưa cho Claude đọc */
export function sentencesFromCaptions(captions) {
  const out = [];
  let cur = null;
  for (const c of captions || []) {
    const text = String(c.text ?? "").trim();
    if (!text) continue;
    const gap = cur ? c.startMs - cur.endMs : 0;
    if (!cur || gap > 700 || cur.endMs - cur.startMs > 9000) {
      if (cur) out.push(cur);
      cur = { startMs: c.startMs, endMs: c.endMs, text };
    } else {
      cur.endMs = c.endMs;
      cur.text += " " + text;
    }
    if (/[.?!…]$/.test(text)) {
      out.push(cur);
      cur = null;
    }
  }
  if (cur) out.push(cur);
  return out.map((s) => ({ start: s.startMs / 1000, end: s.endMs / 1000, text: s.text }));
}

const SYSTEM = `Bạn là editor video TikTok cho môi giới bất động sản Việt Nam.
Đọc lời thoại có mốc thời gian (giây) và chọn các đoạn QUAN TRỌNG NHẤT để gắn "chữ nhấn" — chữ hiệu ứng lớn giữa màn hình.

Mỗi chữ nhấn có 3 dòng:
- "top": chữ viết tay nhỏ phía trên, 1–3 từ (có thể để trống "")
- "main": chữ đậm chính, 1–3 từ, ngắn và mạnh — BẮT BUỘC
- "sub": chữ viết tay phía dưới, 2–5 từ (có thể để trống "")
Ví dụ: {"top":"Vị trí","main":"Đắc địa","sub":"Nhịp sống phồn thịnh"} · {"top":"","main":"Căn hộ","sub":"Đáng sống"}

Kiểu ("style") — bộ "chữ ký + chữ khối" (top = chữ ký viết tay 1–3 từ, main = chữ khối lớn):
- "city": vị trí, khu vực, trung tâm ("Giữa lòng / Trung tâm thành phố / xuất hiện")
- "bigyellow": từ khoá cực ngắn 1–2 từ, chủ đề video ("Temp Font / BĐS")
- "redbold": câu hỏi, vấn đề, nỗi đau khách hàng ("Không biết / Bắt đầu từ đâu")
- "sea": biển, sông, hồ, cảnh quan, thiên nhiên ("Hay / Nhà phố mặt biển")
- "marble": tên dự án / sản phẩm; top = loại hình, sub = địa danh ("Nhà phố thương mại / Sora Bay / Hạ Long")
- "luxgold": đẳng cấp, giá trị, phong cách sống ("Định vị / Đẳng cấp sống")
- "neonsea": khoảng cách, kết nối, tiện ích, hiện đại ("Một bước / Chạm biển")
- "orangegold": bàn giao, pháp lý, tiến độ, chính sách, con số ("Bàn giao / Tiêu chuẩn")
CHỈ dùng 8 kiểu trên. KHÔNG dùng các kiểu cũ (red, neon, gold, type, banner, pop, outline, editorial, stamp) — người dùng đã bỏ.

Quy tắc bắt buộc:
1. CHỈ dùng thông tin có trong lời thoại hoặc phần "Thông tin dự án". Không bịa số liệu, giá, diện tích, pháp lý, tên dự án.
2. Không viết cam kết lợi nhuận, "chắc chắn tăng giá", "số 1", "duy nhất", "rẻ nhất" hay lời dễ vi phạm quy định quảng cáo bất động sản.
3. Chỉ chọn Ý CHÍNH thật sự (luận điểm, dữ kiện then chốt, kết luận, lời kêu gọi) — không gắn cho câu dẫn, câu đệm, câu lặp ý. Thà ít mà trúng.
Tiếng Việt có dấu đầy đủ. Mỗi dòng tối đa 20 ký tự. Không chép nguyên câu nói — rút gọn thành cụm gợi cảm xúc.
4. "at" = giây bắt đầu, lấy đúng mốc đầu câu tương ứng; "sec" từ 2.5 đến 4.5.
5. Không đặt trước giây {HOOK_END}. Các chữ nhấn cách nhau ít nhất 4 giây. Chọn {MIN}–{MAX} chữ nhấn; 2 chữ nhấn liền nhau không dùng cùng kiểu.
6. Chỉ trả về JSON, không giải thích: {"callouts":[{"at":number,"sec":number,"style":string,"top":string,"main":string,"sub":string,"why":string}]}`;

/** Gọi Claude để gợi ý chữ nhấn từ phụ đề. Chỉ gửi CHỮ phụ đề + thông tin dự án, không gửi video. */
export async function suggestCallouts({ captions, info, hookSec = 0, durationSec }) {
  const { key, model } = getAiConfig();
  if (!key) throw new Error("Chưa có khoá API Claude. Vào ⚙ Cài đặt để nhập khoá (hoặc thêm chữ nhấn bằng tay).");
  const sentences = sentencesFromCaptions(captions);
  if (!sentences.length) throw new Error("Video chưa có phụ đề để gợi ý");

  const max = Math.max(2, Math.min(9, Math.round(durationSec / 8)));
  const min = Math.min(max, durationSec > 30 ? 3 : 2);
  const system = SYSTEM.replace("{HOOK_END}", String(Math.ceil(hookSec + 0.5)))
    .replace("{MIN}", String(min))
    .replace("{MAX}", String(max));
  const infoText = Object.entries(info || {})
    .filter(([, v]) => String(v || "").trim())
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
  const transcript = sentences.map((s) => `[${s.start.toFixed(1)}–${s.end.toFixed(1)}] ${s.text}`).join("\n");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model,
      max_tokens: 2000,
      system,
      messages: [
        {
          role: "user",
          content: `Tổng thời lượng: ${durationSec.toFixed(1)} giây\n\nThông tin dự án:\n${infoText || "(không có)"}\n\nLời thoại:\n${transcript}`,
        },
      ],
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.error?.message || `HTTP ${res.status}`;
    if (res.status === 401) throw new Error("Khoá API Claude không đúng hoặc đã bị thu hồi: " + msg);
    throw new Error("Claude báo lỗi: " + msg);
  }
  const raw = (body.content || []).map((c) => c.text || "").join("");
  let parsed;
  try {
    parsed = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
  } catch {
    throw new Error("Không đọc được gợi ý từ Claude, bấm thử lại");
  }

  // làm sạch + bỏ đoạn chồng nhau / đè tiêu đề mở đầu; lỡ trả kiểu cũ thì đổi sang mẫu chữ ký tương ứng
  const OLD_TO_NEW = { red: "redbold", neon: "neonsea", gold: "luxgold", type: "marble", banner: "redbold", pop: "bigyellow", outline: "luxgold", editorial: "marble", stamp: "orangegold" };
  const list = cleanCallouts(
    (parsed.callouts || []).map((c) => ({ ...c, style: OLD_TO_NEW[c?.style] ?? c?.style })),
    durationSec,
  )
    .filter((c) => c.main && c.at >= hookSec)
    .sort((a, b) => a.at - b.at);
  const out = [];
  for (const c of list) {
    const prev = out[out.length - 1];
    if (prev && c.at < prev.at + prev.sec + 0.5) continue;
    out.push(c);
  }
  return out;
}
