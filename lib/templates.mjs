// Mẫu dự án: thông tin BĐS + tiêu đề mở đầu + vùng che + kiểu phụ đề + nhạc nền, dùng lại cho video mới
import fs from "node:fs";
import path from "node:path";
import { DATA as ROOT } from "./paths.mjs";

export const TEMPLATES_DIR = path.join(ROOT, "templates");

function safe(name) {
  const s = String(name || "").replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim();
  if (!s || s === "." || s === "..") throw new Error("Tên mẫu không hợp lệ");
  return s.slice(0, 60);
}

const dirOf = (name) => path.join(TEMPLATES_DIR, safe(name));

function read(name) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dirOf(name), "template.json"), "utf-8"));
  } catch {
    return null;
  }
}

export function listTemplates() {
  if (!fs.existsSync(TEMPLATES_DIR)) return [];
  return fs
    .readdirSync(TEMPLATES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => read(d.name))
    .filter(Boolean)
    .map((t) => ({
      name: t.name,
      tenDuAn: t.info?.tenDuAn ?? "",
      gia: t.info?.gia ?? "",
      music: t.music?.original ?? null,
      blurs: t.blurs?.length ?? 0,
      hook: t.hook?.text ?? "",
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "vi"));
}

/** Lưu mẫu từ 1 dự án (meta = project.json, projectDir = thư mục dự án) */
export function saveTemplate(name, meta, projectDir) {
  const n = safe(name);
  const dir = dirOf(n);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  let music = null;
  if (meta.music && fs.existsSync(path.join(projectDir, meta.music.file))) {
    fs.copyFileSync(path.join(projectDir, meta.music.file), path.join(dir, meta.music.file));
    music = { ...meta.music };
  }
  const t = {
    name: n,
    savedAt: Date.now(),
    info: meta.info,
    hook: meta.hook ?? { text: "", sec: 2.5 },
    blurs: meta.blurs ?? [],
    subStyle: meta.subStyle ?? null,
    punchZoom: Boolean(meta.punchZoom),
    music,
  };
  fs.writeFileSync(path.join(dir, "template.json"), JSON.stringify(t, null, 2), "utf-8");
  return t;
}

export function deleteTemplate(name) {
  fs.rmSync(dirOf(name), { recursive: true, force: true });
}

/** Trả về phần cần ghi vào project.json; copy file nhạc của mẫu sang thư mục dự án */
export function templatePatch(name, projectDir) {
  const t = read(name);
  if (!t) throw new Error("Không thấy mẫu: " + name);
  const patch = { info: t.info, hook: t.hook, blurs: t.blurs, template: t.name };
  if (t.subStyle) patch.subStyle = t.subStyle;
  if (t.punchZoom != null) patch.punchZoom = t.punchZoom;
  if (t.music) {
    fs.copyFileSync(path.join(dirOf(t.name), t.music.file), path.join(projectDir, t.music.file));
    patch.music = { ...t.music };
  }
  return patch;
}
