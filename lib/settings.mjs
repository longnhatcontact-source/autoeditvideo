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

// ---- khoá API Claude cho nút "Gợi ý chữ nhấn" ----
// Lưu trong settings.json trên máy (không đưa lên git). Biến môi trường ANTHROPIC_API_KEY được ưu tiên nếu có.
export const DEFAULT_AI_MODEL = "claude-sonnet-5-5";

export function getAiConfig() {
  const s = read();
  return {
    key: process.env.ANTHROPIC_API_KEY || s.anthropicKey || "",
    model: s.aiModel || DEFAULT_AI_MODEL,
    // tắt Claude: tự dựng chỉ dùng quy tắc (không gọi Claude Code, không gọi khoá API)
    off: Boolean(s.aiOff),
  };
}

/** Thông tin cho giao diện: không bao giờ trả khoá đầy đủ */
export function aiInfo() {
  const { key, model, off } = getAiConfig();
  return {
    off,
    hasKey: Boolean(key),
    fromEnv: Boolean(process.env.ANTHROPIC_API_KEY),
    keyHint: key ? `…${key.slice(-4)}` : "",
    model,
  };
}

export function setAiConfig({ key, model, off }) {
  const next = { ...read() };
  if (typeof off === "boolean") {
    if (off) next.aiOff = true;
    else delete next.aiOff;
  }
  if (typeof key === "string") {
    const k = key.trim();
    if (k && !/^sk-ant-[\w-]{10,}$/.test(k)) throw new Error("Khoá API không đúng dạng (bắt đầu bằng sk-ant-)");
    if (k) next.anthropicKey = k;
    else delete next.anthropicKey;
  }
  if (typeof model === "string") {
    const m = model.trim();
    if (m && !/^claude-[\w.-]+$/.test(m)) throw new Error("Tên model không hợp lệ");
    if (m && m !== DEFAULT_AI_MODEL) next.aiModel = m;
    else delete next.aiModel;
  }
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(next, null, 2), "utf-8");
  return aiInfo();
}
