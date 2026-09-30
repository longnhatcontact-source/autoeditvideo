import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
export const PROJECTS_DIR = path.join(ROOT, "projects");
export const VOCAB_FILE = path.join(ROOT, "tu-khoa.txt");
export const FIX_FILE = path.join(ROOT, "sua-tu.txt");
export const SETTINGS_FILE = path.join(ROOT, "settings.json");

// Thư mục tạm riêng cho Remotion (ngoài AppData\Local\Temp: thư mục đó từng bị xoá giữa lúc render
// -> lỗi "Error opening output ... remotion-audio-mixing"). Đường dẫn phải không dấu cho Chrome/ffmpeg.
const ascii = (p) => /^[\x20-\x7e]+$/.test(p);
const besideLauncher = path.join(path.dirname(path.dirname(ROOT)), "BDSVideoStudio", "tmp");
export const TMP_DIR = ascii(besideLauncher) ? besideLauncher : null;
