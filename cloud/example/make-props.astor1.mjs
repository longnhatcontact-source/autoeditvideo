// VÍ DỤ THẬT (video Astor 1, 7/10/2026): tạo props cho BdsVideo từ kết quả nhận giọng nói.
// Dùng: node cloud/example/make-props.astor1.mjs <thư-mục-làm-việc có raw.json + cut_br.mp4> <thư-mục-ghi-props>
import fs from "node:fs";
import { wordsToCaptions } from "../../lib/captions.mjs";
import { withBackground } from "../../lib/contrast.mjs";
const [W, T] = process.argv.slice(2);
const raw = JSON.parse(fs.readFileSync(W + "/raw.json", "utf8"));
const keep = [[3.12, 56.83], [57.75, 63.85], [64.97, 92.08]];
const map = (t) => { let acc = 0; for (const [a, b] of keep) { if (t < a) return acc; if (t <= b) return acc + (t - a); acc += b - a; } return acc; };
const END = keep.reduce((s, [a, b]) => s + b - a, 0);
const fix = { 18: "Ciputra.", 39: "Ciputra,", 183: "Ciputra.", 31: "1", 46: "1", 79: "1", 264: "1", 304: "1", 263: "Astor", 303: "Astor", 34: "lõi", 77: "duplex.", 101: "thống", 103: "ích", 147: "dao", 127: "1m²", 153: "1m²,", 158: "40m²", 165: "ra", 184: "Nơi", 188: "hạ", 229: "sợi", 230: "may", 231: "mặc", 250: "đầu", 252: "Pristie", 280: "khai,", 281: "chất", 293: "ty", 151: "–130", 75: "penthouse", 94: "Art", 95: "Deco," };
const words = raw.words.map((w, i) => ({ ...w, start: map(w.start), end: map(w.end), word: fix[i] ?? w.word }));
const captions = wordsToCaptions(words);
const video = W + "/cut_br.mp4";
const P = { x: 0.5, y: 0.17, scale: 0.8 };
const c = (at, sec, style, top, main, sub, extra = {}) => ({ at: +map(at).toFixed(2), sec, style, top, main, sub, ...P, ...extra });
let callouts = [
  c(10.1, 4.6, "marble", "Dự án", "Astor 1", "Lõi KĐT Ciputra"),
  c(15.4, 5.0, "bignumber", "Quy mô", "40 tầng", "350 căn hộ cao cấp", { layout: "center" }),
  c(21.0, 5.2, "pearl", "Loại hình", "Studio, 2–3PN", "Penthouse · Duplex"),
  c(26.9, 6.0, "goldserif", "Kiến trúc", "Art Deco", "Riêng tư · hiện đại"),
  c(35.7, 6.6, "goldnumber", "Thanh toán sớm", "95 triệu/m²", "Đã gồm VAT + phí bảo trì"),
  c(51.5, 5.0, "bigyellow", "Studio 40m²", "4,6 tỷ", ""),
  c(58.1, 5.4, "emerald", "Hạ tầng", "Hiện hữu", "Cộng đồng cư dân quốc tế", { layout: "center" }),
  c(67.6, 5.6, "bronze", "Nền tảng từ", "Năm 1957", "Vải sợi May mặc miền Bắc", { layout: "center" }),
  c(74.1, 4.2, "warning", "Cân nhắc", "Dự án đầu tiên", "của chủ đầu tư Pristie"),
  c(78.7, 7.6, "magazine", "Thị trường sẽ", "Đánh giá", "Năng lực · chất lượng"),
  c(87.2, 4.4, "question", "Anh chị", "Đánh giá sao?", "Để lại comment nhé"),
];
callouts = withBackground(video, callouts, 2);
const hook = { at: 0, sec: 3.0, ...P };
const hookBg = withBackground(video, [hook], 2)[0].bg;
const base = JSON.parse(fs.readFileSync(new URL("./base-props.json", import.meta.url), "utf8"));
const props = { ...base, src: "v20c_d.webm", captions, durationInFrames: Math.round(END * 30) - 1, callouts, sfx: [], hookText: "Căn hộ cao cấp *tại Ciputra* chỉ với 4 tỷ?", hookSec: 3.0, hookStyle: "city", hookX: 0.5, hookY: 0.17, hookScale: 0.8, hookBg, keepTogether: ["Astor 1", "Ciputra", "Art Deco", "Thăng Long", "Pristie"], calloutSfx: 1, punchZoom: false };
fs.writeFileSync(T + "/v20c-props.json", JSON.stringify(props));
fs.writeFileSync(T + "/v20c-frames.json", JSON.stringify([{ id: "h", frame: 50 }, ...callouts.map((x, i) => ({ id: "c" + i, frame: Math.round((x.at + 1.4) * 30) }))]));
console.log(END, callouts.map((x) => `${x.at}+${x.sec} bg${x.bg}`).join(" | "), hookBg);
console.log(captions.map((x) => x.text).join("").slice(0, 600));
