// Bước "soát bản nháp": chụp khung hình của video ĐÃ DỰNG (có tiêu đề, chữ nhấn, phụ đề) + ảnh bìa,
// đưa Claude xem như editor xem bản nháp rồi sửa: vị trí chữ, chữ quá dài / sai chính tả, ý không chính, bìa.
// Đây là đúng quy trình làm tay: dựng -> chụp khung -> nhìn -> sửa -> chụp lại.
import { askClaudeJson, LAYOUT_IDS, sentencesFromCaptions, STYLE_GUIDE, TEMPLATE_IDS } from "./callouts.mjs";

const TEMPLATES = TEMPLATE_IDS;

const SYSTEM = `Bạn là editor video TikTok chuyên nghiệp cho môi giới bất động sản Việt Nam, đang soát BẢN NHÁP do mình dựng trước khi xuất.
Bạn nhận: ảnh chụp từng chữ nhấn (và tiêu đề mở đầu) trên video thật, ảnh bìa, dữ liệu từng mục, và toàn bộ phụ đề hiện tại.

Soát kỹ từng ảnh theo tiêu chuẩn của chủ kênh (bắt buộc):
- Chữ nổi bật đặt CAO, KHÔNG che mắt/miệng/mặt người nói, KHÔNG đè lên phụ đề (phụ đề ở phía dưới).
- Chữ phải đọc rõ: nền sáng mà chữ chìm thì đổi kiểu chữ có màu tương phản hoặc dời sang vùng tối hơn. Không có thẻ/nền đen sau chữ.
- Dấu tiếng Việt không bị cắt, chữ không tràn mép khung, không quá nhỏ.
- Chỉ giữ Ý CHÍNH (luận điểm, dữ kiện then chốt, từng mục liệt kê, kết luận, lời kêu gọi). Mục nào là câu đệm/lặp ý thì bỏ.
- Chữ ngắn gọn (main ≤ 22 ký tự, 1–4 chữ), đúng chính tả, đúng nội dung lời thoại, không bịa.
- Kiểu chữ hợp nghĩa, 2 chữ nhấn liền nhau không cùng kiểu; bố cục ("layout") hợp nội dung. Danh sách mẫu:
${STYLE_GUIDE}
- Phụ đề: tìm chữ còn nghe nhầm (sai chính tả, sai thuật ngữ BĐS, tên riêng) → đưa vào "fixes" ["cụm sai đúng nguyên văn trong phụ đề","cụm đúng"]. Không viết lại câu.
- Ảnh bìa: chữ ở giữa, rõ, không che mặt, tiêu đề gây tò mò đúng nội dung; khung nền đẹp (mặt rõ, biểu cảm). Nếu khung nền xấu thì chọn giây khác ("sec").

Chỉ trả về những gì CẦN SỬA. Mục ổn thì không ghi. Toạ độ y: 0 = mép trên, 1 = mép dưới (giữ trong 0.1–0.5). scale 0.6–1.1.
Chỉ trả về JSON:
{"items":[{"i":number,"y"?:number,"scale"?:number,"style"?:string,"layout"?:string,"top"?:string,"main"?:string,"sub"?:string,"text"?:string,"drop"?:true,"why":string}],
 "fixes":[[string,string]],
 "cover"?:{"title"?:string,"style"?:string,"points"?:[string],"sec"?:number,"why":string},
 "ok":boolean}
("i" là số thứ tự mục như trong danh sách; "text" chỉ dùng cho tiêu đề mở đầu, có đúng 1 cụm *…*. "ok": true nếu bản nháp đã đạt, không cần sửa gì.)`;

const num = (v, lo, hi) => (Number.isFinite(Number(v)) ? Math.min(hi, Math.max(lo, Number(v))) : undefined);
const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : undefined);

/**
 * items: [{label, kind: "hook"|"callout", data, image}] ; cover: {data, image} | null
 * Trả về { items: Map(i -> patch), drops: Set(i), fixes, cover, ok, notes }
 */
export async function reviewDraft({ items, cover, captions, durationSec }) {
  const content = [];
  items.forEach((it, i) => {
    content.push({ type: "text", text: `Mục ${i} — ${it.label}: ${JSON.stringify(it.data)}` });
    if (it.image) content.push({ type: "image", path: it.image.path, source: { type: "base64", media_type: "image/jpeg", data: it.image.data } });
  });
  if (cover?.image) {
    content.push({ type: "text", text: `Ảnh bìa: ${JSON.stringify(cover.data)}` });
    content.push({ type: "image", path: cover.image.path, source: { type: "base64", media_type: "image/jpeg", data: cover.image.data } });
  }
  const transcript = sentencesFromCaptions(captions)
    .map((s) => `[${s.start.toFixed(1)}–${s.end.toFixed(1)}] ${s.text}`)
    .join("\n");
  content.push({ type: "text", text: `Tổng thời lượng ${durationSec.toFixed(1)} giây.\n\nPhụ đề hiện tại:\n${transcript}` });

  const r = await askClaudeJson(SYSTEM, content, 4000);
  const patches = new Map();
  const drops = new Set();
  const notes = [];
  for (const x of Array.isArray(r?.items) ? r.items : []) {
    const i = Number(x?.i);
    if (!Number.isInteger(i) || i < 0 || i >= items.length) continue;
    if (x.drop && items[i].kind === "callout") {
      drops.add(i);
      notes.push(`Bỏ "${items[i].data.main}": ${str(x.why, 120) || ""}`);
      continue;
    }
    const p = {};
    const y = num(x.y, 0.1, 0.5);
    const sc = num(x.scale, 0.6, 1.1);
    if (y !== undefined) p.y = y;
    if (sc !== undefined) p.scale = sc;
    if (TEMPLATES.includes(x.style)) p.style = x.style;
    if (items[i].kind === "callout" && LAYOUT_IDS.includes(x.layout)) p.layout = x.layout;
    if (items[i].kind === "callout") {
      for (const k of ["top", "main", "sub"]) if (str(x[k], k === "main" ? 26 : 40) !== undefined) p[k] = str(x[k], k === "main" ? 26 : 40);
    } else if (str(x.text, 120) && /\*[^*]+\*/.test(x.text)) p.text = str(x.text, 120);
    if (Object.keys(p).length) {
      patches.set(i, p);
      if (x.why) notes.push(`${items[i].label}: ${str(x.why, 120)}`);
    }
  }
  let coverPatch = null;
  if (r?.cover && typeof r.cover === "object") {
    const c = {};
    if (str(r.cover.title, 120) && /\*[^*]+\*/.test(r.cover.title)) c.title = str(r.cover.title, 120);
    if (TEMPLATES.includes(r.cover.style)) c.style = r.cover.style;
    if (Array.isArray(r.cover.points)) c.points = r.cover.points.map((p) => String(p).slice(0, 48)).slice(0, 2);
    const sec = num(r.cover.sec, 0, Math.max(0, durationSec - 0.3));
    if (sec !== undefined) c.sec = sec;
    if (Object.keys(c).length) {
      coverPatch = c;
      if (r.cover.why) notes.push(`Ảnh bìa: ${str(r.cover.why, 120)}`);
    }
  }
  const fixes = (Array.isArray(r?.fixes) ? r.fixes : [])
    .filter((f) => Array.isArray(f) && typeof f[0] === "string" && typeof f[1] === "string" && f[0].trim() && f[0].trim() !== f[1].trim())
    .slice(0, 40);
  const ok = !!r?.ok && !patches.size && !drops.size && !coverPatch && !fixes.length;
  return { patches, drops, fixes, cover: coverPatch, ok, notes };
}
