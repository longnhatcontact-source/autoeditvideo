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
];

const AUDIO_EXT = /\.(mp3|wav|m4a|aac|ogg)$/i;

/** Danh sách SFX: id = đường dẫn tương đối trong assets/sfx (dùng làm URL /sfx/<id>) */
export function listSfx() {
  const items = BUILTIN.filter(([f]) => fs.existsSync(path.join(SFX_DIR, f))).map(([file, label, group]) => ({
    id: file,
    label,
    group,
  }));
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

/** SFX tự chèn: đập khi hiện tiêu đề mở đầu (hoặc pop khi hiện tên dự án), whoosh khi thẻ giá vào/ra, whoosh ở chỗ nối clip */
export function defaultSfx({ info, hook, clipStarts = [], durationSec }) {
  const list = [];
  const hookSec = hook?.text?.trim() ? hook.sec : 0;
  if (hookSec) list.push({ id: "swoosh-sharp-hit-2.mp3", at: 0, volume: 0.55 });
  else if (info?.tenDuAn) list.push({ id: "pop_real.mp3", at: 0.15, volume: 0.6 });
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
