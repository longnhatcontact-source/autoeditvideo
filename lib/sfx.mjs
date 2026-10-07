import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./paths.mjs";

export const SFX_DIR = path.join(ROOT, "assets", "sfx");
export const CUSTOM_SFX_DIR = path.join(SFX_DIR, "custom");

const BUILTIN = [
  ["swoosh-fast-1.mp3", "Whoosh nhanh", "Chuyển cảnh"],
  ["fast-whoosh.mp3", "Whoosh mạnh", "Chuyển cảnh"],
  ["simple-whoosh-1.mp3", "Whoosh nhẹ", "Chuyển cảnh"],
  ["simple-whoosh-2.mp3", "Whoosh ngắn", "Chuyển cảnh"],
  ["swoosh-quick-low.mp3", "Whoosh trầm", "Chuyển cảnh"],
  ["swish-2.mp3", "Vút", "Chuyển cảnh"],
  ["swish-3.mp3", "Vút dài", "Chuyển cảnh"],
  ["swish-slicing.mp3", "Chém gió", "Chuyển cảnh"],
  ["short-whoosh-metal.mp3", "Whoosh kim loại", "Chuyển cảnh"],
  ["whoosh-coarse-harsh.mp3", "Whoosh gắt", "Chuyển cảnh"],
  ["whoosh_real.mp3", "Whoosh", "Chuyển cảnh"],
  ["swipe.mp3", "Lướt", "Chuyển cảnh"],
  ["swoosh-crash.mp3", "Whoosh + va", "Nhấn mạnh"],
  ["swoosh-fast-with-thud.mp3", "Whoosh + bịch", "Nhấn mạnh"],
  ["swoosh-sharp-hit-2.mp3", "Whoosh + đập", "Nhấn mạnh"],
  ["impact-hit-1.mp3", "Đập mạnh", "Nhấn mạnh"],
  ["impact-hit-3.mp3", "Đập vừa", "Nhấn mạnh"],
  ["impact-hit-4.mp3", "Đập vang", "Nhấn mạnh"],
  ["impact-hit-launch.mp3", "Đập bật", "Nhấn mạnh"],
  ["boom.wav", "Bùm", "Nhấn mạnh"],
  ["pop_real.mp3", "Pop", "Bật lên"],
  ["pop-sound.mp3", "Pop vang", "Bật lên"],
  ["ui-sound-4.mp3", "Bíp UI 1", "Bật lên"],
  ["ui-sound-6.mp3", "Bíp UI 2", "Bật lên"],
  ["ui-sound-8.mp3", "Bíp UI 3", "Bật lên"],
  ["button-pressed.mp3", "Bấm nút", "Bật lên"],
  ["ding.wav", "Ting", "Tiền / chốt"],
  ["chime.mp3", "Chuông", "Tiền / chốt"],
  ["apple-pay-success.mp3", "Thanh toán xong", "Tiền / chốt"],
  ["camera-1.mp3", "Chụp ảnh 1", "Máy ảnh"],
  ["camera-2.mp3", "Chụp ảnh 2", "Máy ảnh"],
  // bộ tiếng cho chữ nhấn (scripts/synth-sfx.py tự tổng hợp; kn-* là Kenney Interface Sounds, CC0 — xem KENNEY-LICENSE.txt)
  ["cn-typing-06.mp3", "Gõ phím (6 phím)", "Chữ nhấn"],
  ["cn-typing-10.mp3", "Gõ phím (10 phím)", "Chữ nhấn"],
  ["cn-typing-14.mp3", "Gõ phím (14 phím)", "Chữ nhấn"],
  ["cn-typing-20.mp3", "Gõ phím (20 phím)", "Chữ nhấn"],
  ["cn-typing-28.mp3", "Gõ phím (28 phím)", "Chữ nhấn"],
  ["cn-key.mp3", "1 phím", "Chữ nhấn"],
  ["cn-click.mp3", "Click chuột", "Chữ nhấn"],
  ["cn-whoosh-fast.mp3", "Vút nhanh", "Chữ nhấn"],
  ["cn-whoosh-soft.mp3", "Vút mềm", "Chữ nhấn"],
  ["cn-pop.mp3", "Pop bong bóng", "Chữ nhấn"],
  ["cn-ting.mp3", "Ting nhẹ", "Chữ nhấn"],
  ["cn-shimmer.mp3", "Lấp lánh", "Chữ nhấn"],
  ["cn-stamp.mp3", "Đóng dấu", "Chữ nhấn"],
  ["cn-neon.mp3", "Đèn neon bật", "Chữ nhấn"],
  ["cn-riser.mp3", "Dâng lên", "Chữ nhấn"],
  ["kn-glass.mp3", "Ting thuỷ tinh", "Chữ nhấn"],
  ["kn-pluck.mp3", "Gảy nhẹ", "Chữ nhấn"],
  ["kn-select.mp3", "Tích chọn", "Chữ nhấn"],
  ["kn-confirm.mp3", "Xác nhận", "Chữ nhấn"],
  ["kn-switch.mp3", "Công tắc", "Chữ nhấn"],
];

const AUDIO_EXT = /\.(mp3|wav|m4a|aac|ogg)$/i;

/** Thư viện SFX theo danh mục (assets/sfx/library.json): tên, nhóm, dùng khi nào, nguồn + giấy phép từng file */
function readLibrary() {
  try {
    const lib = JSON.parse(fs.readFileSync(path.join(SFX_DIR, "library.json"), "utf8"));
    const groups = lib.meta?.groups ?? {};
    return (lib.sounds ?? [])
      .filter((s) => s.status === "downloaded" && s.file && fs.existsSync(path.join(SFX_DIR, s.file)))
      .map((s) => ({ id: s.file, label: s.name, group: groups[s.group] ?? s.group, hint: s.use_when, tone: s.tone }));
  } catch {
    return [];
  }
}

/** Danh sách SFX: id = đường dẫn tương đối trong assets/sfx (dùng làm URL /sfx/<id>) */
export function listSfx() {
  const items = readLibrary();
  const seen = new Set(items.map((i) => i.id));
  for (const [file, label, group] of BUILTIN) {
    if (!seen.has(file) && fs.existsSync(path.join(SFX_DIR, file))) items.push({ id: file, label, group });
  }
  if (fs.existsSync(CUSTOM_SFX_DIR)) {
    for (const f of fs.readdirSync(CUSTOM_SFX_DIR)) {
      if (AUDIO_EXT.test(f)) items.push({ id: `custom/${f}`, label: f.replace(AUDIO_EXT, ""), group: "Của tôi" });
    }
  }
  return items;
}

export function sfxPath(id) {
  const p = path.resolve(SFX_DIR, id);
  if (!p.startsWith(path.resolve(SFX_DIR) + path.sep)) throw new Error("SFX không hợp lệ");
  return p;
}

export function addCustomSfx(srcFile) {
  if (!AUDIO_EXT.test(srcFile)) throw new Error("Chỉ nhận file âm thanh mp3/wav/m4a/aac/ogg");
  fs.mkdirSync(CUSTOM_SFX_DIR, { recursive: true });
  const dest = path.join(CUSTOM_SFX_DIR, path.basename(srcFile));
  fs.copyFileSync(srcFile, dest);
  return `custom/${path.basename(srcFile)}`;
}

// khớp InfoOverlay.tsx: thẻ giá vào lúc 0.5s (+ thời lượng tiêu đề mở đầu), ở lại 5.5s
const CARD_IN_SEC = 0.5;
const CARD_SHOW_SEC = 5.5;

/**
 * SFX tự chèn: pop khi hiện tên dự án, whoosh khi thẻ giá vào/ra, whoosh ở chỗ nối clip.
 * Tiêu đề mở đầu + chữ nhấn tự có tiếng theo kiểu chữ (Callouts.tsx › calloutSounds) nên không chèn ở đây.
 */
export function defaultSfx({ info, hook, clipStarts = [], durationSec }) {
  // SFX chỉ gắn vào chữ nhấn (anh Nhật chốt 7/10): không tự chèn tiếng ở đầu video / thẻ giá / chỗ nối clip nữa
  if (!process.env.BDS_AUTO_SFX) return [];
  const list = [];
  const hookSec = hook?.text?.trim() ? hook.sec : 0;
  if (!hookSec && info?.tenDuAn) list.push({ id: "pop_real.mp3", at: 0.15, volume: 0.6 });
  if (info?.gia) {
    const cardIn = CARD_IN_SEC + hookSec;
    list.push({ id: "swoosh-fast-1.mp3", at: cardIn, volume: 0.6 });
    if (durationSec > cardIn + CARD_SHOW_SEC + 1) list.push({ id: "simple-whoosh-1.mp3", at: cardIn + CARD_SHOW_SEC, volume: 0.45 });
  }
  for (const t of clipStarts) {
    if (t > 0.5 && t < durationSec - 0.5) list.push({ id: "fast-whoosh.mp3", at: Math.max(0, t - 0.2), volume: 0.5 });
  }
  return list.sort((a, b) => a.at - b.at);
}
