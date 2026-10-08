// VÍ DỤ THẬT 2 (video Phú Diễn, 8/10/2026): quay selfie ngoài công trường, trời sáng phía trên → khung chữ đặt DƯỚI mặt (y 0.75, vùng áo tối),
// tắt phụ đề, 13 khung chữ nhấn ý chính, sửa tên riêng nghe nhầm (đã tra: "Metro Green Street" → Metro Grand Street).
// Dùng: node cloud/example/make-props.phudien.mjs <thư-mục có raw.json + cut.mp4>
import fs from "node:fs";
import { wordsToCaptions } from "../../lib/captions.mjs";
import { withBackground } from "../../lib/contrast.mjs";
const W = process.argv[2];
const raw = JSON.parse(fs.readFileSync(W + "/raw.json", "utf8"));
const keep = [[0.3, 4.58], [5.14, 78.0]];
const map = (t) => { let acc = 0; for (const [a, b] of keep) { if (t < a) return acc; if (t <= b) return acc + (t - a); acc += b - a; } return acc; };
const END = keep.reduce((s, [a, b]) => s + b - a, 0);
const fix = { 17: "Phú", 18: "Diễn", 36: "Phú", 37: "Diễn", 58: "hoạch", 77: "hữu", 91: "Phú", 92: "Diễn", 103: "Hồ", 104: "Tây –", 109: "Việt", 110: "kéo", 111: "dài,", 113: "đai", 120: "đai", 121: "3.5.", 122: "", 211: "cứu", 213: "Grand", 265: "biệt", 266: "thự", 233: "Phú", 234: "Diễn", 259: "anh", 260: "chị", 267: "Phú", 268: "Diễn,", 270: "Tuấn", 285: "Phú", 286: "Diễn" };
const words = raw.words.map((w, i) => ({ ...w, start: map(w.start), end: map(w.end), word: fix[i] ?? w.word })).filter((w) => w.word);
const captions = wordsToCaptions(words);
const P = { x: 0.5, y: 0.75, scale: 0.88 };
const c = (at, sec, style, top, main, sub, extra = {}) => ({ at: +map(at).toFixed(2), sec: +sec.toFixed(2), style, top, main, sub, ...P, ...extra });
let callouts = [
  c(6.0, 3.5, "minimal", "Nhìn bề ngoài", "Khu dân cư", "Phú Diễn như một địa danh"),
  c(9.7, 5.4, "flipwhite", "Nhưng", "Câu chuyện rộng hơn", "Trong đô thị phía Tây"),
  c(15.5, 7.4, "framegold", "Trong quy hoạch", "Vị trí", "Quyết định giá trị khu vực"),
  c(23.4, 4.2, "headline", "Mạng lưới", "Trục kết nối", "Đang hình thành"),
  c(27.7, 3.6, "pillorange", "Các trục lớn", "Hồ Tây–Ba Vì", "Hoàng Quốc Việt kéo dài"),
  c(31.4, 3.5, "cornermint", "Vành đai", "Vành đai 3 & 3.5", "Tây Thăng Long"),
  c(35.0, 4.4, "blueglow", "Hạ tầng", "Metro", "Định hướng phát triển"),
  c(39.5, 4.6, "duoyellow", "Thay đổi", "Khả năng tiếp cận", "Dòng người · Chức năng đô thị"),
  c(44.5, 6.6, "headline", "Bản chất", "3 thay đổi", "Hạ tầng · Dòng người · Chức năng", { layout: "bar" }),
  c(51.4, 5.5, "luxgold", "Giá trị BĐS", "Hệ quy chiếu mới", ""),
  c(57.6, 5.6, "framewhite", "Dự án", "Metro Grand Street", "Biệt thự Phú Diễn"),
  c(63.8, 6.6, "question", "Phú Diễn sẽ giữ", "Vị trí nào?", "Khi hạ tầng dần hình thành"),
  c(71.0, 6.9, "cardmsg", "Em Tuấn", "Bản đồ trục hạ tầng", "Nhắn em để cùng nghiên cứu"),
];
callouts = withBackground(W + "/cut.mp4", callouts, 2);
const hook = { at: 0, sec: 4.2, x: 0.5, y: 0.75, scale: 0.85 };
const hookBg = withBackground(W + "/cut.mp4", [hook], 2)[0].bg;
const base = JSON.parse(fs.readFileSync(new URL("./base-props.json", import.meta.url), "utf8"));
const props = { ...base, src: "v3cc.webm", captions, durationInFrames: Math.round(END * 30) - 1, callouts, sfx: [], hookText: "Phú Diễn nằm ở đâu *trong đô thị* phía Tây Hà Nội?", hookSec: 4.2, hookStyle: "bigyellow", hookX: 0.5, hookY: 0.75, hookScale: 0.85, hookBg, keepTogether: ["Phú Diễn", "Hồ Tây – Ba Vì", "Vành đai 3", "Metro Grand Street"], calloutSfx: 1, punchZoom: false, subPosition: "tat" };
fs.writeFileSync(W + "/props.json", JSON.stringify(props));
fs.writeFileSync(W + "/frames.json", JSON.stringify([{ id: "h", frame: 70 }, ...callouts.map((x, i) => ({ id: "c" + String(i).padStart(2, "0"), frame: Math.round((x.at + 1.6) * 30) }))]));
console.log(END.toFixed(2), "hookBg", hookBg, callouts.map((x) => `${x.style}@${x.at} bg${x.bg}`).join(" | "));
