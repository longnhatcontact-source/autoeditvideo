// "Tự dựng hoàn chỉnh" khi KHÔNG có khoá Claude: chọn ý chính, tiêu đề, chữ ảnh bìa bằng quy tắc.
// Có khoá thì projects.mjs dùng Claude trước, lỗi mới rơi về đây.
import { sentencesFromCaptions } from "./callouts.mjs";

const norm = (s) => s.toLowerCase().normalize("NFC");
const ORDINAL = /\b(thứ\s+(nhất|hai|ba|tư|bốn|năm|sáu|bảy|tám|chín|mười|[2-9])|đầu tiên|cuối cùng)\b/i;
const ORD_LABEL = { nhất: "Thứ nhất", hai: "Thứ hai", "2": "Thứ hai", ba: "Thứ ba", "3": "Thứ ba", tư: "Thứ tư", bốn: "Thứ tư", "4": "Thứ tư", năm: "Thứ năm", "5": "Thứ năm", sáu: "Thứ sáu", "6": "Thứ sáu", bảy: "Thứ bảy", "7": "Thứ bảy", tám: "Thứ tám", "8": "Thứ tám", chín: "Thứ chín", "9": "Thứ chín", mười: "Thứ mười" };
const UNIT = "(triệu|tỷ|tỉ|nghìn|ngàn|trăm|m²|m2|mét vuông|mét|m|km|%|phần trăm|năm|tháng|phút|giây|căn|tầng|ha|héc ta|lần)";
// "từ 40 đến 60 triệu", "40 - 60 triệu", "18 đến 40m"
const RANGE = new RegExp(`(?:từ\\s+)?(\\d+(?:[.,]\\d+)?)\\s*(?:đến|tới|cho tới|-|–)\\s*(\\d+(?:[.,]\\d+)?)\\s*${UNIT}`, "i");
const SINGLE = new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*${UNIT}`, "i");
const DATE = /ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})(?:\s+năm\s+(\d{4}))?/i;
const FILLER = /^(là|thì|mà|cái|đó|chính|đó chính là|chính là|nếu như|nếu|và|nhưng|còn|với|có lẽ|thực sự|anh chị|các anh chị|ạ|nhé)\s+/i;
const CTA = /(đăng ký kênh|theo dõi kênh|follow|liên hệ|inbox|nhắn tin|để lại bình luận|bình luận)/i;
const GREETING = /^(xin chào|chào|hello|hi|alo)\b/i;

const TOPICS = [
  { re: /(pháp lý|sổ đỏ|sổ hồng|giấy phép|nghị định|quy định|xử phạt|phạt|chứng chỉ|hợp đồng|bàn giao|tiến độ|chính sách|chiết khấu|thanh toán)/i, style: "orangegold" },
  { re: /(biển|sông|hồ|view|cảnh quan|công viên|cây xanh|thiên nhiên)/i, style: "sea" },
  { re: /(metro|kết nối|di chuyển|đường|tuyến|cầu|vành đai|cao tốc|tiện ích)/i, style: "neonsea" },
  { re: /(vị trí|trung tâm|quận|phường|khu vực|mặt tiền|mặt bằng|ngã tư|nút giao)/i, style: "city" },
  { re: /(sai lầm|rủi ro|cảnh báo|đừng|nỗi đau|vấn đề|lỗi|mất tiền|thua lỗ|bị đòi|khó khăn)/i, style: "redbold" },
  { re: /(đẳng cấp|sang trọng|giá trị|tiềm năng|minh bạch|chất lượng|thượng lưu)/i, style: "luxgold" },
];

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const words = (s) => s.split(/\s+/).filter(Boolean);
const clipWords = (s, n) => words(s).slice(0, n).join(" ");
const stripPunct = (s) => s.replace(/[.,!?;:…"“”]+/g, " ").replace(/\s+/g, " ").trim();
const stripFiller = (s) => {
  let t = s.trim();
  for (let i = 0; i < 4; i++) t = t.replace(FILLER, "");
  return t;
};

function numberPhrase(text) {
  const d = text.match(DATE);
  if (d) return d[3] ? `${d[1]}/${d[2]}/${d[3]}` : `${d[1]}/${d[2]}`;
  const r = text.match(RANGE);
  if (r) return `${r[1]}–${r[2]} ${unitShort(r[3])}`.trim();
  const s = text.match(SINGLE);
  if (s) return `${s[1]} ${unitShort(s[2])}`.trim();
  return "";
}
function unitShort(u) {
  const x = u.toLowerCase();
  if (x === "mét vuông" || x === "m2") return "m²";
  if (x === "phần trăm") return "%";
  if (x === "mét") return "m";
  if (x === "tỉ") return "tỷ";
  return x;
}

/** người nói nhắc tên dự án / từ khoá riêng có trong tu-khoa.txt */
function findName(text, vocab) {
  const t = norm(text);
  return vocab.filter((v) => /\s/.test(v) || /[A-Z]/.test(v)).sort((a, b) => b.length - a.length).find((v) => t.includes(norm(v))) || "";
}

/** 1 câu -> {score, callout} */
function analyze(s, vocab) {
  const text = stripPunct(s.text);
  const low = norm(text);
  let score = 0;
  let top = "";
  let main = "";
  let sub = "";
  let style = "";

  const ord = low.match(ORDINAL);
  const num = numberPhrase(low);
  const name = findName(text, vocab);
  const topic = TOPICS.find((t) => t.re.test(low));
  const cta = low.match(CTA);

  if (ord) {
    score += 4;
    const k = (ord[2] || "").toLowerCase();
    top = ord[1].toLowerCase().startsWith("thứ") ? ORD_LABEL[k] || cap(ord[1]) : cap(ord[1]);
    // nội dung ngay sau "thứ nhất" tới trước "thì / sẽ / bị phạt / ,"
    const after = text.slice(text.toLowerCase().indexOf(ord[1].toLowerCase()) + ord[1].length);
    const clause = stripFiller(after.split(/\b(thì|sẽ|bị phạt|được|nên)\b/i)[0] || "");
    sub = clipWords(clause, 6);
  }
  if (num) {
    score += 3;
    if (ord) main = num;
    else {
      main = num;
      // ngữ cảnh: 3–4 chữ trước con số
      const idx = low.search(/\d/);
      const before = stripFiller(text.slice(0, Math.max(0, idx)).split(/[,]/).pop() || "");
      top = cap(words(before).slice(-4).join(" "));
    }
  }
  if (name) {
    score += 3;
    if (!main) main = name;
    else if (!sub) sub = name;
    style = style || "marble";
  }
  if (topic) score += 2;
  if (cta && s.start > 0) {
    score += 2;
    if (!main) {
      main = cap(cta[1]);
      style = "luxgold";
    }
  }
  if (!main && ord && sub) {
    // "Thứ ba: không tuân thủ quy chế" (không có số): nội dung lên làm chữ chính
    main = sub;
    sub = "";
  }
  if (!main && topic) {
    // cụm 2–4 chữ bắt đầu từ từ khoá
    const m = text.match(topic.re);
    const from = text.toLowerCase().indexOf(m[0].toLowerCase());
    main = clipWords(text.slice(from), 4);
  }
  if (!main) return null;
  let layout;
  if (!style && num && !ord) {
    // con số: chọn mẫu số theo loại
    if (/tỷ|triệu|nghìn|ngàn/.test(main)) (style = "goldnumber"), (layout = "underline");
    else if (/m²|ha|km|m\b/.test(main)) (style = "bignumber"), (layout = "side");
    else if (/%/.test(main)) style = "limefigure";
    else if (/\d+\/\d+/.test(main)) (style = "countdown"), (layout = "inline");
  }
  if (!style && ord) layout = "bar";
  if (!style) style = num && !ord ? (main.length <= 10 ? "bigyellow" : "luxgold") : topic?.style || (ord ? "redbold" : "luxgold");
  if (main.length > 26) main = clipWords(main, 4);
  if (sub.length > 34) sub = clipWords(sub, 5);
  return { score, callout: { top: cap(top), main: cap(main), sub: cap(sub), style, ...(layout ? { layout } : {}) } };
}

/** chọn chữ nhấn bằng quy tắc: ưu tiên "thứ nhất/hai…", số liệu, tên dự án, chủ đề BĐS, lời kêu gọi */
export function ruleCallouts({ captions, durationSec, hookSec = 0, vocab = [], y = 0.28, scale = 0.85 }) {
  const sentences = sentencesFromCaptions(captions);
  const max = Math.max(2, Math.min(12, Math.round(durationSec / 9)));
  const cands = sentences
    .map((s) => ({ s, a: analyze(s, vocab) }))
    .filter((x) => x.a && x.s.start >= hookSec + 0.3)
    .sort((a, b) => b.a.score - a.a.score || a.s.start - b.s.start);
  const picked = [];
  for (const c of cands) {
    if (picked.length >= max) break;
    if (picked.some((p) => Math.abs(p.s.start - c.s.start) < 4)) continue;
    picked.push(c);
  }
  picked.sort((a, b) => a.s.start - b.s.start);
  let prev = "";
  return picked.map(({ s, a }) => {
    let style = a.callout.style;
    if (style === prev) style = { orangegold: "luxgold", luxgold: "orangegold", redbold: "orangegold", city: "luxgold", sea: "luxgold", neonsea: "city", marble: "luxgold", bigyellow: "redbold" }[style] || "luxgold";
    prev = style;
    const sec = Math.round(Math.min(6, Math.max(2.8, s.end - s.start + 0.6)) * 10) / 10;
    return { at: Math.round(s.start * 10) / 10, sec: Math.min(sec, Math.max(1.5, durationSec - s.start - 0.2)), ...a.callout, style, x: 0.5, y, scale };
  });
}

/** tiêu đề mở đầu: kịch bản (dòng đầu) nếu có, không thì câu mở đầu (bỏ câu chào) */
export function ruleHook({ captions, script = "" }) {
  const first = script.split(/\r?\n/).map((l) => l.trim()).find(Boolean);
  let text = first || "";
  if (!text) {
    const s = sentencesFromCaptions(captions).find((x) => !GREETING.test(x.text.trim()) && words(x.text).length >= 4);
    text = s ? clipWords(stripPunct(s.text), 10) : "";
  }
  text = text.replace(/[*]/g, "").replace(/^[^\p{L}\d]+/u, "").trim();
  if (!text) return "";
  // 2–3 chữ cuối (hoặc cụm sau dấu phẩy) làm chữ khối lớn
  const w = words(text.replace(/\.{3}|…/g, " ...").trim());
  const tailDots = w[w.length - 1] === "..." ? w.pop() : "";
  const n = w.length >= 7 ? 3 : 2;
  if (w.length <= 3) return `*${w.join(" ")}*${tailDots ? " " + tailDots : ""}`;
  return `${w.slice(0, -n).join(" ")} *${w.slice(-n).join(" ")}*${tailDots ? " " + tailDots : ""}`;
}

/** chữ ảnh bìa: tiêu đề = tiêu đề mở đầu; ý chính = 2 chữ nhấn có số liệu / thứ tự */
export function ruleCover({ hookText, callouts, durationSec }) {
  const points = callouts
    .filter((c) => /\d/.test(c.main) || /^Thứ /.test(c.top))
    .slice(0, 2)
    .map((c) => (c.top ? `${c.top}: ${c.main}` : c.main).slice(0, 44));
  return { title: hookText || (callouts[0] ? `*${callouts[0].main}*` : ""), style: "redbold", points, sec: Math.min(durationSec * 0.4, Math.max(0, durationSec - 1)) };
}
