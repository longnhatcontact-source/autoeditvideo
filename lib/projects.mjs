import fs from "node:fs";
import path from "node:path";
import { exportCapcut } from "./capcut.mjs";
import { captionsFromRaw, readLines } from "./captions.mjs";
import { bakeBlurs, buildBaseVideo, probe, transcribeVideo } from "./media.mjs";
import { PROJECTS_DIR, VOCAB_FILE } from "./paths.mjs";
import { renderVideo } from "./render.mjs";
import { defaultSfx, sfxPath } from "./sfx.mjs";
import { saveTemplate, templatePatch } from "./templates.mjs";
import { BRAND_DIR, getBrand } from "./brand.mjs";
import { getExportDir } from "./settings.mjs";
import { cleanCallouts, suggestCallouts } from "./callouts.mjs";

const FPS = 30;
const EMPTY_INFO = { tenDuAn: "", gia: "", dienTich: "", phongNgu: "", diaChi: "" };
const EMPTY_HOOK = { text: "", sec: 2.5 };
export const SUB_COLORS = ["#39E508", "#FFD23F", "#FF3B3B", "#FF4FD8"];
const DEFAULT_SUB_STYLE = { highlight: "#39E508", position: "thap", box: false };

const cleanSubStyle = (s, prev = DEFAULT_SUB_STYLE) => ({
  highlight: SUB_COLORS.includes(s?.highlight) ? s.highlight : prev.highlight,
  position: s?.position === "cao" || s?.position === "thap" ? s.position : prev.position,
  box: s?.box != null ? Boolean(s.box) : prev.box,
});
const AUDIO_EXT = /\.(mp3|wav|m4a|aac|ogg|flac)$/i;

export function safeName(name) {
  const s = String(name || "")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!s || s === "." || s === "..") throw new Error("Tên dự án không hợp lệ");
  return s.slice(0, 60);
}

const dirOf = (name) => path.join(PROJECTS_DIR, safeName(name));
const fileOf = (name, f) => path.join(dirOf(name), f);

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf-8");
  fs.renameSync(tmp, file);
}

const readMeta = (name) => readJson(fileOf(name, "project.json"), null);
const writeMeta = (name, meta) => writeJson(fileOf(name, "project.json"), meta);

function patchMeta(name, patch) {
  const meta = readMeta(name);
  if (!meta) throw new Error("Không thấy dự án: " + name);
  const next = { ...meta, ...patch, updatedAt: Date.now() };
  writeMeta(name, next);
  return next;
}

// ---- hàng đợi việc nặng: chạy lần lượt ----
const jobs = new Map(); // key `${name}:${kind}` -> {name, kind, progress, message, status, error, result}
let queue = Promise.resolve();

function startJob(name, kind, fn) {
  const key = `${name}:${kind}`;
  const cur = jobs.get(key);
  if (cur && (cur.status === "queued" || cur.status === "running")) throw new Error("Việc này đang chạy rồi");
  const job = { name, kind, progress: 0, message: "Đang chờ", status: "queued", error: null, result: null, startedAt: Date.now() };
  jobs.set(key, job);
  const report = (progress, message) => {
    job.progress = Math.max(0, Math.min(1, progress));
    if (message) job.message = message;
  };
  queue = queue.then(async () => {
    job.status = "running";
    try {
      job.result = await fn(report);
      job.status = "done";
      job.progress = 1;
      job.message = "Xong";
    } catch (e) {
      job.status = "error";
      job.error = String(e?.message || e);
      job.message = "Lỗi";
      console.error(`[${key}]`, e);
    }
  });
  return job;
}

export const listJobs = () => [...jobs.values()];

// ---- dự án ----
export function listProjects() {
  if (!fs.existsSync(PROJECTS_DIR)) return [];
  return fs
    .readdirSync(PROJECTS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => readMeta(d.name))
    .filter(Boolean)
    .map(({ name, status, durationSec, createdAt, updatedAt, info, error }) => ({
      name, status, durationSec, createdAt, updatedAt, tenDuAn: info?.tenDuAn ?? "", error,
    }))
    .sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
}

export function getProject(name) {
  const meta = readMeta(name);
  if (!meta) return null;
  const captions = readJson(fileOf(name, "captions.json"), []);
  const mtime = (f) => (fs.existsSync(fileOf(name, f)) ? Math.floor(fs.statSync(fileOf(name, f)).mtimeMs) : 0);
  return {
    ...meta,
    blurs: meta.blurs ?? [],
    hook: meta.hook ?? { ...EMPTY_HOOK },
    hideBrand: Boolean(meta.hideBrand),
    brand: brandFor(meta),
    subStyle: meta.subStyle ?? { ...DEFAULT_SUB_STYLE },
    punchZoom: Boolean(meta.punchZoom),
    overlays: meta.overlays ?? [],
    callouts: meta.callouts ?? [],
    captions,
    keepTogether: readLines(VOCAB_FILE).filter((l) => /\s/.test(l)),
    versions: { video: mtime("video.mp4"), music: meta.music ? mtime(meta.music.file) : 0 },
    jobs: listJobs().filter((j) => j.name === meta.name),
  };
}

/** Áp mẫu: thông tin, tiêu đề mở đầu, vùng che, nhạc nền; SFX tự chèn tính lại */
export function applyTemplate(name, template) {
  const meta = readMeta(name);
  if (!meta) throw new Error("Không thấy dự án: " + name);
  const patch = templatePatch(template, dirOf(name));
  if (meta.music && (!patch.music || patch.music.file !== meta.music.file)) {
    fs.rmSync(fileOf(name, meta.music.file), { force: true });
  }
  if (!patch.music) patch.music = null;
  if (meta.sfxAuto && meta.status === "ready") {
    patch.sfx = defaultSfx({ info: patch.info, hook: patch.hook, clipStarts: meta.clipStarts, durationSec: meta.durationSec });
  }
  return patchMeta(name, patch);
}

export function saveAsTemplate(name, templateName) {
  const meta = readMeta(name);
  if (!meta) throw new Error("Không thấy dự án: " + name);
  return saveTemplate(templateName, meta, dirOf(name));
}

export function createProject({ name, clips, model = "medium", removeSilence = true, template = "" }) {
  const n = safeName(name);
  if (!Array.isArray(clips) || !clips.length) throw new Error("Chưa chọn clip nào");
  if (fs.existsSync(dirOf(n))) throw new Error(`Dự án "${n}" đã có, đặt tên khác`);
  for (const c of clips) if (!fs.existsSync(c)) throw new Error("Không thấy file: " + c);
  fs.mkdirSync(dirOf(n), { recursive: true });
  const now = Date.now();
  writeMeta(n, {
    name: n, createdAt: now, updatedAt: now, clips, model, removeSilence,
    status: "processing", error: null, durationSec: 0, durationInFrames: 0, clipStarts: [],
    info: { ...EMPTY_INFO }, music: null, sfx: [], sfxAuto: true, lastRender: null, lastCapcut: null,
    blurs: [], hook: { ...EMPTY_HOOK },
  });
  if (template) applyTemplate(n, template);
  processProject(n);
  return n;
}

export function processProject(name) {
  const meta = readMeta(name);
  patchMeta(name, { status: "processing", error: null });
  return startJob(meta.name, "process", async (report) => {
    try {
      const work = fileOf(name, ".work");
      const video = fileOf(name, "video.mp4");
      const base = await buildBaseVideo(meta.clips, work, video, {
        removeSilence: meta.removeSilence,
        onProgress: (p, m) => report(p * 0.45, m),
      });
      report(0.45, "Nhận dạng giọng nói (lâu nhất, vài phút)");
      const raw = fileOf(name, "raw.json");
      await transcribeVideo(video, work, raw, {
        model: meta.model,
        vocabFile: VOCAB_FILE,
        onProgress: (p) => report(0.45 + p * 0.53, `Nhận dạng giọng nói ${Math.round(p * 100)}%`),
      });
      writeJson(fileOf(name, "captions.json"), captionsFromRaw(raw));
      const durationInFrames = Math.max(1, Math.floor(base.duration * FPS) - 1);
      const cur = readMeta(name);
      patchMeta(name, {
        status: "ready",
        durationSec: base.duration,
        durationInFrames,
        clipStarts: base.clipStarts,
        sfx: cur.sfxAuto
          ? defaultSfx({ info: cur.info, hook: cur.hook, clipStarts: base.clipStarts, durationSec: base.duration })
          : cur.sfx,
      });
    } catch (e) {
      patchMeta(name, { status: "error", error: String(e?.message || e) });
      throw e;
    }
  });
}

const cleanBlurs = (list) =>
  (Array.isArray(list) ? list : [])
    .map((b) => {
      const c = (v) => Math.min(1, Math.max(0, Number(v) || 0));
      const x = c(b.x);
      const y = c(b.y);
      return { x, y, w: Math.min(1 - x, c(b.w)), h: Math.min(1 - y, c(b.h)) };
    })
    .filter((b) => b.w > 0.005 && b.h > 0.005);

const cleanHook = (h, prev = EMPTY_HOOK) => ({
  text: typeof h?.text === "string" ? h.text.slice(0, 160) : prev.text,
  sec: h?.sec != null ? Math.min(6, Math.max(1, Number(h.sec) || prev.sec)) : prev.sec,
});

function brandFor(meta) {
  const b = getBrand();
  return { ...b, show: b.enabled && !meta.hideBrand && Boolean(b.text || b.logo) };
}

export function updateProject(name, { info, captions, music, sfx, blurs, hook, hideBrand, subStyle, punchZoom, overlays, callouts }) {
  const meta = readMeta(name);
  if (!meta) throw new Error("Không thấy dự án: " + name);
  const patch = {};
  if (overlays) patch.overlays = cleanOverlays(name, overlays);
  if (callouts) patch.callouts = cleanCallouts(callouts, meta.durationSec || Infinity);
  if (punchZoom != null) patch.punchZoom = Boolean(punchZoom);
  if (subStyle) patch.subStyle = cleanSubStyle(subStyle, meta.subStyle ?? DEFAULT_SUB_STYLE);
  if (hideBrand != null) patch.hideBrand = Boolean(hideBrand);
  if (info) patch.info = { ...EMPTY_INFO, ...meta.info, ...info };
  if (hook) patch.hook = cleanHook(hook, meta.hook ?? EMPTY_HOOK);
  if (blurs) patch.blurs = cleanBlurs(blurs);
  // SFX tự chèn chạy lại theo thông tin/tiêu đề mới cho tới khi người dùng tự sửa SFX
  if ((info || hook) && meta.sfxAuto && !sfx) {
    patch.sfx = defaultSfx({
      info: patch.info ?? meta.info,
      hook: patch.hook ?? meta.hook,
      clipStarts: meta.clipStarts,
      durationSec: meta.durationSec,
    });
  }
  if (sfx) {
    patch.sfx = sfx
      .filter((s) => s && typeof s.id === "string")
      .map((s) => ({ id: s.id, at: Math.max(0, Number(s.at) || 0), volume: Math.min(1, Math.max(0, Number(s.volume) || 0)) }))
      .sort((a, b) => a.at - b.at);
    patch.sfxAuto = false;
  }
  if (music && meta.music) {
    patch.music = {
      ...meta.music,
      volume: music.volume != null ? Math.min(1, Math.max(0, Number(music.volume))) : meta.music.volume,
      duck: music.duck != null ? Boolean(music.duck) : meta.music.duck,
    };
  }
  if (captions) writeJson(fileOf(name, "captions.json"), captions);
  return patchMeta(name, patch);
}

const IMAGE_EXT = /\.(png|jpe?g|webp)$/i;
const VIDEO_EXT = /\.(mp4|mov|m4v|webm|mkv)$/i;

/** Chèn ảnh/clip minh hoạ: copy vào projects/<tên>/overlays/, đo kích thước */
export async function addOverlay(name, srcFile, at, sec) {
  const meta = readMeta(name);
  if (!meta) throw new Error("Không thấy dự án: " + name);
  const kind = IMAGE_EXT.test(srcFile) ? "image" : VIDEO_EXT.test(srcFile) ? "video" : null;
  if (!kind) throw new Error("Chỉ nhận ảnh (png/jpg/webp) hoặc clip (mp4/mov/webm)");
  if (!fs.existsSync(srcFile)) throw new Error("Không thấy file: " + srcFile);
  const dir = fileOf(name, "overlays");
  fs.mkdirSync(dir, { recursive: true });
  const file = `${Date.now()}${path.extname(srcFile).toLowerCase()}`;
  fs.copyFileSync(srcFile, path.join(dir, file));
  const m = await probe(path.join(dir, file));
  const item = {
    file,
    original: path.basename(srcFile),
    kind,
    at: Math.max(0, Math.min(Number(at) || 0, meta.durationSec - 0.5)),
    sec: Math.max(0.5, Math.min(Number(sec) || 3, kind === "video" ? m.duration || 3 : 20)),
    w: m.width || 1080,
    h: m.height || 1080,
  };
  return patchMeta(name, { overlays: [...(meta.overlays ?? []), item].sort((a, b) => a.at - b.at) });
}

// Không xoá file khi bỏ khỏi danh sách: để hoàn tác (Ctrl+Z) còn khôi phục được
function cleanOverlays(name, list) {
  const dir = fileOf(name, "overlays");
  return (Array.isArray(list) ? list : [])
    .filter((o) => typeof o?.file === "string" && /^[\w.-]+$/.test(o.file) && fs.existsSync(path.join(dir, o.file)))
    .map((o) => ({
      file: o.file,
      original: String(o.original ?? o.file),
      kind: o.kind === "video" ? "video" : "image",
      at: Math.max(0, Number(o.at) || 0),
      sec: Math.max(0.5, Math.min(20, Number(o.sec) || 3)),
      w: Number(o.w) || 1080,
      h: Number(o.h) || 1080,
    }));
}

export function setMusic(name, srcFile) {
  const meta = readMeta(name);
  if (!meta) throw new Error("Không thấy dự án: " + name);
  if (srcFile == null) {
    if (meta.music) fs.rmSync(fileOf(name, meta.music.file), { force: true });
    return patchMeta(name, { music: null });
  }
  if (!AUDIO_EXT.test(srcFile)) throw new Error("Chỉ nhận file nhạc mp3/wav/m4a/aac/ogg/flac");
  if (!fs.existsSync(srcFile)) throw new Error("Không thấy file: " + srcFile);
  if (meta.music) fs.rmSync(fileOf(name, meta.music.file), { force: true });
  const file = "music" + path.extname(srcFile).toLowerCase();
  fs.copyFileSync(srcFile, fileOf(name, file));
  return patchMeta(name, {
    music: { file, original: path.basename(srcFile), volume: meta.music?.volume ?? 0.25, duck: meta.music?.duck ?? true },
  });
}

export function reapplyFixes(name) {
  const raw = fileOf(name, "raw.json");
  if (!fs.existsSync(raw)) throw new Error("Dự án chưa có phụ đề gốc");
  const captions = captionsFromRaw(raw);
  writeJson(fileOf(name, "captions.json"), captions);
  return captions;
}

export function deleteProject(name) {
  const d = dirOf(name);
  if (!fs.existsSync(d)) return;
  if (listJobs().some((j) => j.name === safeName(name) && (j.status === "running" || j.status === "queued"))) {
    throw new Error("Dự án đang xử lý, chờ xong rồi xoá");
  }
  fs.rmSync(d, { recursive: true, force: true });
}

/** Props cho composition; mediaBase = "http://127.0.0.1:port" */
export function compositionProps(name, mediaBase) {
  const p = getProject(name);
  const enc = encodeURIComponent(p.name);
  return {
    src: `${mediaBase}/media/${enc}/video.mp4?v=${p.versions.video}`,
    ...EMPTY_INFO,
    ...p.info,
    captions: p.captions,
    musicSrc: p.music ? `${mediaBase}/media/${enc}/${encodeURIComponent(p.music.file)}?v=${p.versions.music}` : "",
    musicVolume: p.music?.volume ?? 0.25,
    musicDuck: p.music?.duck ?? true,
    sfx: (p.sfx || []).map((s) => ({ src: `${mediaBase}/sfx/${s.id.split("/").map(encodeURIComponent).join("/")}`, at: s.at, volume: s.volume })),
    durationInFrames: p.durationInFrames,
    keepTogether: p.keepTogether,
    blurs: p.blurs,
    hookText: p.hook.text,
    hookSec: p.hook.sec,
    brandText: p.brand.show ? p.brand.text : "",
    brandLogoSrc: p.brand.show && p.brand.logo ? `${mediaBase}/brand/${encodeURIComponent(p.brand.logo)}` : "",
    brandPosition: p.brand.position,
    subHighlight: p.subStyle.highlight,
    subPosition: p.subStyle.position,
    subBox: p.subStyle.box,
    punchZoom: p.punchZoom,
    overlays: p.overlays.map((o) => ({
      src: `${mediaBase}/media/${enc}/overlays/${encodeURIComponent(o.file)}`,
      at: o.at,
      sec: o.sec,
      kind: o.kind,
    })),
    callouts: p.callouts,
  };
}

/** Gợi ý chữ nhấn bằng Claude (chỉ trả về, chưa lưu — người dùng duyệt trong app) */
export async function suggestProjectCallouts(name) {
  const p = getProject(name);
  if (!p) throw new Error("Không thấy dự án: " + name);
  if (p.status !== "ready") throw new Error("Dự án chưa xử lý xong");
  return suggestCallouts({
    captions: p.captions,
    info: p.info,
    hookSec: p.hook?.text?.trim() ? p.hook.sec : 0,
    durationSec: p.durationSec,
  });
}

export function renderProject(name, mediaBase) {
  const meta = readMeta(name);
  if (meta?.status !== "ready") throw new Error("Dự án chưa xử lý xong");
  return startJob(meta.name, "render", async (report) => {
    // mặc định lưu vào Downloads, đổi được trong app (settings.json)
    const outDir = getExportDir();
    fs.mkdirSync(outDir, { recursive: true });
    // kèm ngày giờ để lần xuất sau không ghi đè bản trước
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}h${pad(d.getMinutes())}`;
    const out = path.join(outDir, `${meta.name} ${stamp}.mp4`);
    await renderVideo(compositionProps(name, mediaBase), out, report);
    const { duration } = await probe(out);
    patchMeta(name, { lastRender: out });
    return { path: out, durationSec: duration };
  });
}

export function capcutProject(name) {
  const meta = readMeta(name);
  if (meta?.status !== "ready") throw new Error("Dự án chưa xử lý xong");
  return startJob(meta.name, "capcut", async (report) => {
    let videoPath = fileOf(name, "video.mp4");
    const blurs = meta.blurs ?? [];
    if (blurs.length) {
      report(0.1, "Làm mờ vùng che cho bản CapCut (khoảng 1–2 phút)");
      videoPath = fileOf(name, "video_capcut.mp4");
      await bakeBlurs(fileOf(name, "video.mp4"), videoPath, blurs);
    }
    report(0.8, "Tạo draft CapCut");
    const res = await exportCapcut({
      name: meta.name,
      videoPath,
      hook: meta.hook ?? EMPTY_HOOK,
      subStyle: meta.subStyle ?? DEFAULT_SUB_STYLE,
      punchZoom: Boolean(meta.punchZoom),
      overlays: (meta.overlays ?? []).map((o) => ({ ...o, path: path.join(fileOf(name, "overlays"), o.file) })),
      brand: (() => {
        const b = brandFor(meta);
        return b.show ? { text: b.text, logo: b.logo ? path.join(BRAND_DIR, b.logo) : "", position: b.position } : null;
      })(),
      captions: readJson(fileOf(name, "captions.json"), []),
      keepTogether: readLines(VOCAB_FILE).filter((l) => /\s/.test(l)),
      durationSec: meta.durationSec,
      info: meta.info,
      music: meta.music ? { path: fileOf(name, meta.music.file), volume: meta.music.volume } : null,
      sfx: (meta.sfx || []).map((s) => ({ path: sfxPath(s.id), at: s.at, volume: s.volume })),
      workDir: fileOf(name, ".work"),
    });
    patchMeta(name, { lastCapcut: res.draftDir });
    return res;
  });
}

export const projectDir = dirOf;
