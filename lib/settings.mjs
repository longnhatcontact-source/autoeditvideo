// Cài đặt chung của app (settings.json): thư mục lưu video xuất
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { SETTINGS_FILE } from "./paths.mjs";

function read() {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8"));
  } catch {
    return {};
  }
}

// Electron truyền đúng thư mục Downloads của Windows (kể cả khi đã dời sang ổ khác)
const defaultExportDir = () => process.env.BDS_DOWNLOADS || path.join(os.homedir(), "Downloads");

export function getExportDir() {
  const saved = read().exportDir;
  return saved && fs.existsSync(saved) ? saved : defaultExportDir();
}

export function setExportDir(dir) {
  const next = { ...read() };
  if (!dir) delete next.exportDir;
  else {
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) throw new Error("Không thấy thư mục: " + dir);
    next.exportDir = dir;
  }
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(next, null, 2), "utf-8");
  return { exportDir: getExportDir(), isDefault: !next.exportDir };
}

export const exportDirInfo = () => ({ exportDir: getExportDir(), isDefault: !read().exportDir });
