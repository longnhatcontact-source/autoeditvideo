import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
// Bản cài (.exe): dữ liệu người dùng nằm ngoài thư mục cài (BDS_DATA_DIR = AppData\Roaming\...),
// cập nhật/gỡ app không mất dự án. Bản chạy từ mã nguồn: như cũ, nằm cạnh code.
export const DATA = process.env.BDS_DATA_DIR || ROOT;
fs.mkdirSync(DATA, { recursive: true });
export const PROJECTS_DIR = path.join(DATA, "projects");
export const VOCAB_FILE = path.join(DATA, "tu-khoa.txt");
export const FIX_FILE = path.join(DATA, "sua-tu.txt");
export const SETTINGS_FILE = path.join(DATA, "settings.json");
// lần đầu chạy bản cài: chép danh sách từ khoá / sửa chữ mẫu ra thư mục dữ liệu
for (const f of ["tu-khoa.txt", "sua-tu.txt"]) {
  const dst = path.join(DATA, f);
  const src = path.join(ROOT, f);
  if (DATA !== ROOT && !fs.existsSync(dst) && fs.existsSync(src)) fs.copyFileSync(src, dst);
}

// Thư mục tạm riêng cho Remotion (ngoài AppData\Local\Temp: thư mục đó từng bị xoá giữa lúc render
// -> lỗi "Error opening output ... remotion-audio-mixing"). Đường dẫn phải không dấu cho Chrome/ffmpeg.
const ascii = (p) => /^[\x20-\x7e]+$/.test(p);
const besideLauncher = path.join(path.dirname(path.dirname(ROOT)), "BDSVideoStudio", "tmp");
export const TMP_DIR = process.env.BDS_TMP_DIR || (ascii(besideLauncher) ? besideLauncher : null);

// Python có faster-whisper: biến WHISPER_PYTHON > F:/Tools/Python312 (máy anh Nhật) > Python 3.12/3.13 cài bằng bộ cài/winget > "python"/"python3"
import { spawnSync } from "node:child_process";
import os from "node:os";
let _py = null;
export function findPython() {
  if (_py) return _py;
  const la = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
  const cands = [
    process.env.WHISPER_PYTHON,
    "F:/Tools/Python312/python.exe",
    path.join(la, "Programs", "Python", "Python312", "python.exe"),
    path.join(la, "Programs", "Python", "Python313", "python.exe"),
    "C:/Program Files/Python312/python.exe",
    "C:/Program Files/Python313/python.exe",
    process.platform === "win32" ? "python" : "python3",
  ].filter(Boolean);
  for (const c of cands) {
    if (path.isAbsolute(c) && !fs.existsSync(c)) continue;
    const r = spawnSync(c, ["-c", "import faster_whisper"], { windowsHide: true, timeout: 60000 });
    if (r.status === 0) return (_py = c);
  }
  return (_py = cands.find((c) => !path.isAbsolute(c) || fs.existsSync(c)) || "python");
}
