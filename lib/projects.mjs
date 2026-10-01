import fs from "node:fs";
import path from "node:path";
import { exportCapcut } from "./capcut.mjs";
import { applyFixes, captionsFromRaw, normWord, readLines } from "./captions.mjs";
import { planVideo } from "./planner.mjs";
import { ruleCallouts, ruleCover, ruleHook } from "./autoedit.mjs";
import { bakeBlurs, buildBaseVideo, probe, run as runCmd, transcribeVideo } from "./media.mjs";
import { PROJECTS_DIR, VOCAB_FILE } from "./paths.mjs";
import { renderCoverImage, renderVideo } from "./render.mjs";
import { audioPeaks, keptRanges, makeRemap, normalizeRanges, remapSpan } from "./timeline.mjs";
import { defaultSfx, sfxPath } from "./sfx.mjs";
import { getAiConfig } from "./settings.mjs";
import { claudeCodeStatus } from "./claude-code.mjs";
import { withBackground } from "./contrast.mjs";
import { saveTemplate, templatePatch } from "./templates.mjs";
import { BRAND_DIR, getBrand } from "./brand.mjs";
import { getExportDir } from "./settings.mjs";
import { CALLOUT_STYLES, cleanCallouts, suggestCallouts, suggestCover } from "./callouts.mjs";

const FPS = 30;
const EMPTY_INFO = { tenDuAn: "", gia: "", dienTich: "", phongNgu: "", diaChi: "" };
const EMPTY_HOOK = { text: "", sec: 2.5, style: "gold", x: 0.5, y: 0.3, scale: 1 };
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
    hook: cleanHook(meta.hook ?? {}, meta.hook ?? EMPTY_HOOK),
    hideBrand: Boolean(meta.hideBrand),
    brand: brandFor(meta),
    subStyle: meta.subStyle ?? { ...DEFAULT_SUB_STYLE },
    punchZoom: Boolean(meta.punchZoom),
    calloutSfx: numIn(meta.calloutSfx, 0, 1, 0.8),
    overlays: meta.overlays ?? [],
    // kèm độ sáng nền sau từng khối chữ (nền sáng -> chữ tự có viền tối)
    cutUndo: cutHistory(name).length,
    callouts: withBackground(fileOf(name, "video.mp4"), cleanCallouts(meta.callouts, meta.durationSec || Infinity), mtime("video.mp4")),
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

// địa chỉ server (để tự xuất video / ảnh bìa ngay sau khi tự dựng)
let MEDIA_BASE = "";
export const setMediaBase = (b) => (MEDIA_BASE = b);

export function createProject({ name, clips, model = "medium", removeSilence = true, template = "", script = "", autoEdit = true }) {
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
    // tự dựng hoàn chỉnh: sửa chữ nghe nhầm, tiêu đề, chữ nhấn, ảnh bìa, rồi tự xuất bản nhẹ + ảnh bìa
    autoEdit: Boolean(autoEdit), script: String(script || "").slice(0, 8000),
    subStyle: { highlight: "#FFD23F", position: "thap", box: false }, punchZoom: true, calloutSfx: 0.8,
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
      if (cur.autoEdit) {
        await autoEditProject(name, (p, m) => report(0.98, m));
        // tự xuất bản nhẹ + ảnh bìa (xếp hàng sau việc này)
        if (MEDIA_BASE) {
          setTimeout(() => {
            try {
              renderProject(name, MEDIA_BASE, { lite: true });
              renderProjectCover(name, MEDIA_BASE);
            } catch (e) {
              console.warn("Tự xuất lỗi:", e?.message || e);
            }
          }, 0);
        }
      }
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

const numIn = (v, lo, hi, def) => (v != null && Number.isFinite(Number(v)) ? Math.min(hi, Math.max(lo, Number(v))) : def);
const cleanHook = (h, prev = EMPTY_HOOK) => {
  const p = { ...EMPTY_HOOK, ...prev };
  return {
    text: typeof h?.text === "string" ? h.text.slice(0, 160) : p.text,
    sec: h?.sec != null ? Math.min(6, Math.max(1, Number(h.sec) || p.sec)) : p.sec,
    style: CALLOUT_STYLES.includes(h?.style) ? h.style : p.style,
    x: numIn(h?.x, 0.1, 0.9, p.x),
    y: numIn(h?.y, 0.05, 0.95, p.y),
    scale: numIn(h?.scale, 0.5, 1.5, p.scale),
  };
};

function brandFor(meta) {
  const b = getBrand();
  return { ...b, show: b.enabled && !meta.hideBrand && Boolean(b.text || b.logo) };
}

export function updateProject(name, { info, captions, music, sfx, blurs, hook, hideBrand, subStyle, punchZoom, overlays, callouts, calloutSfx }) {
  const meta = readMeta(name);
  if (!meta) throw new Error("Không thấy dự án: " + name);
  const patch = {};
  if (overlays) patch.overlays = cleanOverlays(name, overlays);
  if (callouts) patch.callouts = cleanCallouts(callouts, meta.durationSec || Infinity);
  if (punchZoom != null) patch.punchZoom = Boolean(punchZoom);
  if (calloutSfx != null) patch.calloutSfx = numIn(calloutSfx, 0, 1, 0.8);
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

const toRules = (pairs) =>
  (pairs || [])
    .map(([a, b]) => ({ from: a.trim().split(/\s+/).map(normWord).filter(Boolean), to: b.trim().split(/\s+/).filter(Boolean) }))
    .filter((r) => r.from.length)
    .sort((x, y) => y.from.length - x.from.length);

export function reapplyFixes(name) {
  const raw = fileOf(name, "raw.json");
  if (!fs.existsSync(raw)) throw new Error("Dự án chưa có phụ đề gốc");
  // giữ cả các chỗ Claude đã sửa lúc tự dựng
  const captions = applyFixes(captionsFromRaw(raw), toRules(readMeta(name)?.autoFixes));
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
    sfxBase: `${mediaBase}/sfx`,
    calloutSfx: p.calloutSfx,
    durationInFrames: p.durationInFrames,
    keepTogether: p.keepTogether,
    blurs: p.blurs,
    hookText: p.hook.text,
    hookSec: p.hook.sec,
    hookStyle: p.hook.style,
    hookX: p.hook.x,
    hookY: p.hook.y,
    hookScale: p.hook.scale,
    hookBg: p.hook.text?.trim()
      ? withBackground(fileOf(name, "video.mp4"), [{ at: 0, sec: p.hook.sec, x: p.hook.x, y: p.hook.y, scale: p.hook.scale }])[0]?.bg
      : undefined,
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

export function renderProject(name, mediaBase, { lite = false } = {}) {
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
    const out = path.join(outDir, `${meta.name} ${stamp}${lite ? " (ban nhe)" : ""}.mp4`);
    await renderVideo(compositionProps(name, mediaBase), out, report, { lite });
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

// ---- dòng thời gian: sóng âm, cắt đoạn, hoàn tác cắt ----

/** sóng âm của video dự án (lưu đệm theo lần sửa video) */
export async function projectPeaks(name) {
  const video = fileOf(name, "video.mp4");
  if (!fs.existsSync(video)) throw new Error("Dự án chưa có video");
  const v = Math.floor(fs.statSync(video).mtimeMs);
  const cacheFile = fileOf(name, "peaks.json");
  const cached = readJson(cacheFile, null);
  if (cached?.v === v) return cached;
  const p = { v, ...(await audioPeaks(video)) };
  writeJson(cacheFile, p);
  return p;
}

const CUT_HISTORY = ".cut-history";

/** Cắt bỏ các đoạn [{from,to}] khỏi video, dời phụ đề / chữ nhấn / SFX / ảnh chèn theo. Lưu bản cũ để hoàn tác. */
export function cutProject(name, ranges) {
  const meta = readMeta(name);
  if (meta?.status !== "ready") throw new Error("Dự án chưa xử lý xong");
  const cuts = normalizeRanges(ranges, meta.durationSec);
  if (!cuts.length) throw new Error("Chưa chọn đoạn nào để cắt");
  const keep = keptRanges(cuts, meta.durationSec);
  if (!keep.length) throw new Error("Không thể cắt hết cả video");
  return startJob(meta.name, "cut", async (report) => {
    const video = fileOf(name, "video.mp4");
    // lưu bản trước khi cắt (video + dữ liệu) để hoàn tác
    const hist = path.join(fileOf(name, CUT_HISTORY), String(Date.now()));
    fs.mkdirSync(hist, { recursive: true });
    for (const f of ["video.mp4", "captions.json", "raw.json", "project.json"]) {
      if (fs.existsSync(fileOf(name, f))) fs.copyFileSync(fileOf(name, f), path.join(hist, f));
    }
    report(0.1, "Đang cắt video");
    // cắt từng đoạn giữ lại ra file riêng rồi nối (1 filter nhiều trim trên cùng video rất tốn RAM)
    const tmpDir = fileOf(name, ".cut-tmp");
    fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.mkdirSync(tmpDir, { recursive: true });
    const tmp = fileOf(name, "video.cut.mp4");
    try {
      const parts = [];
      for (const [i, k] of keep.entries()) {
        const part = path.join(tmpDir, `p${i}.mp4`);
        const d = k.to - k.from;
        const r = await runCmd("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-ss", k.from.toFixed(3), "-i", video, "-t", d.toFixed(3),
          "-af", `afade=t=in:d=0.02,afade=t=out:st=${Math.max(0, d - 0.03).toFixed(3)}:d=0.03`,
          "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", "-r", String(FPS),
          "-c:a", "aac", "-ar", "48000", "-ac", "2", part]);
        if (r.code !== 0) throw new Error("Cắt video lỗi:\n" + r.stderr.slice(-500));
        parts.push(part);
        report(0.1 + (0.7 * (i + 1)) / keep.length, `Đang cắt video (${i + 1}/${keep.length})`);
      }
      const list = path.join(tmpDir, "list.txt");
      fs.writeFileSync(list, parts.map((f) => `file '${f.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`).join("\n"));
      const r = await runCmd("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", "-movflags", "+faststart", tmp]);
      if (r.code !== 0) throw new Error("Nối video lỗi:\n" + r.stderr.slice(-500));
    } catch (e) {
      fs.rmSync(hist, { recursive: true, force: true }); // cắt hỏng: không để lại mốc hoàn tác giả
      fs.rmSync(tmp, { force: true });
      throw e;
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
    fs.renameSync(tmp, video);
    report(0.85, "Dời phụ đề, chữ nhấn, SFX");
    const remap = makeRemap(cuts);
    const shiftCaps = (caps) =>
      caps
        .filter((c) => !remap((c.startMs + c.endMs) / 2000).inside)
        .map((c) => {
          const s = Math.round(remap(c.startMs / 1000).t * 1000);
          const e = Math.max(s + 60, Math.round(remap(c.endMs / 1000).t * 1000));
          return { ...c, startMs: s, endMs: e, timestampMs: Math.round((s + e) / 2) };
        });
    writeJson(fileOf(name, "captions.json"), shiftCaps(readJson(fileOf(name, "captions.json"), [])));
    const raw = readJson(fileOf(name, "raw.json"), null);
    if (raw?.words) {
      raw.words = raw.words
        .filter((w) => !remap((w.start + w.end) / 2).inside)
        .map((w) => ({ ...w, start: remap(w.start).t, end: Math.max(remap(w.start).t + 0.06, remap(w.end).t) }));
      if (Array.isArray(raw.segments)) raw.segments = [];
      writeJson(fileOf(name, "raw.json"), raw);
    }
    const { duration } = await probe(video);
    const cur = readMeta(name);
    patchMeta(name, {
      durationSec: duration,
      durationInFrames: Math.max(1, Math.floor(duration * FPS) - 1),
      clipStarts: (cur.clipStarts ?? []).map((t) => remap(t)).filter((x) => !x.inside).map((x) => x.t),
      callouts: (cur.callouts ?? []).map((c) => { const sp = remapSpan(c.at, c.sec, remap); return sp && { ...c, ...sp }; }).filter(Boolean),
      sfx: (cur.sfx ?? []).filter((x) => !remap(x.at).inside).map((x) => ({ ...x, at: Math.round(remap(x.at).t * 100) / 100 })),
      overlays: (cur.overlays ?? []).map((o) => { const sp = remapSpan(o.at, o.sec, remap, 0.5); return sp && { ...o, ...sp }; }).filter(Boolean),
    });
    return { removedSec: cuts.reduce((a, c) => a + c.to - c.from, 0), durationSec: duration };
  });
}

export function cutHistory(name) {
  const dir = fileOf(name, CUT_HISTORY);
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((d) => /^\d+$/.test(d)).sort() : [];
}

/** quay lại trạng thái trước lần cắt gần nhất */
export function undoCut(name) {
  const list = cutHistory(name);
  if (!list.length) throw new Error("Chưa có lần cắt nào để hoàn tác");
  const dir = path.join(fileOf(name, CUT_HISTORY), list[list.length - 1]);
  for (const f of ["video.mp4", "captions.json", "raw.json", "project.json"]) {
    if (fs.existsSync(path.join(dir, f))) fs.copyFileSync(path.join(dir, f), fileOf(name, f));
  }
  fs.rmSync(dir, { recursive: true, force: true });
  patchMeta(name, {}); // cập nhật updatedAt
  return getProject(name);
}

// ---- ảnh bìa ----
const cleanCover = (c, durationSec) => ({
  title: String(c?.title ?? "").slice(0, 120),
  style: CALLOUT_STYLES.slice(0, 8).includes(c?.style) ? c.style : "luxgold",
  points: (Array.isArray(c?.points) ? c.points : []).map((p) => String(p).slice(0, 48)).filter((p) => p.trim()).slice(0, 4),
  sec: Math.min(Math.max(0, Number(c?.sec) || 0), Math.max(0, (durationSec || 1) - 0.2)),
});

export function saveCover(name, cover) {
  const meta = readMeta(name);
  if (!meta) throw new Error("Không thấy dự án: " + name);
  return patchMeta(name, { cover: cleanCover({ ...meta.cover, ...cover }, meta.durationSec) });
}

/** Claude đọc lời thoại -> tiêu đề, ý chính, khung nền cho ảnh bìa (không gửi video, chỉ gửi chữ) */
export async function suggestProjectCover(name) {
  const p = getProject(name);
  if (p?.status !== "ready") throw new Error("Dự án chưa xử lý xong");
  const c = await suggestCover({ captions: p.captions, hookText: p.hook?.text || "", durationSec: p.durationSec });
  return saveCover(name, c).cover;
}

/** Xuất ảnh bìa PNG vào thư mục xuất (Downloads). auto=true: Claude tự viết chữ nếu chưa có */
export function renderProjectCover(name, mediaBase, { auto = false } = {}) {
  const meta = readMeta(name);
  if (meta?.status !== "ready") throw new Error("Dự án chưa xử lý xong");
  return startJob(meta.name, "cover", async (report) => {
    let cover = meta.cover;
    if (!cover?.title?.trim() || auto) {
      report(0.1, "Claude đang đọc nội dung để viết chữ bìa");
      cover = await suggestProjectCover(name);
    }
    cover = cleanCover(cover, meta.durationSec);
    report(0.4, "Lấy khung nền");
    const bg = fileOf(name, "cover_bg.jpg");
    const r = await runCmd("ffmpeg", ["-y", "-hide_banner", "-ss", cover.sec.toFixed(2), "-i", fileOf(name, "video.mp4"), "-frames:v", "1",
      "-vf", "scale=1080:1920", "-q:v", "2", bg]);
    if (r.code !== 0) throw new Error("Không lấy được khung nền:\n" + r.stderr.slice(-300));
    report(0.6, "Dựng ảnh bìa");
    const outDir = getExportDir();
    fs.mkdirSync(outDir, { recursive: true });
    const out = path.join(outDir, `${meta.name} - anh bia.png`);
    await renderCoverImage(
      {
        title: cover.title,
        titleStyle: cover.style,
        background: `${mediaBase}/media/${encodeURIComponent(meta.name)}/cover_bg.jpg?v=${Date.now()}`,
        scenes: [],
        footer: "",
        footerStrong: "",
        points: cover.points,
      },
      out,
    );
    patchMeta(name, { lastCover: out });
    return { path: out, cover };
  });
}

// ---- tự dựng hoàn chỉnh ----

/**
 * Lên toàn bộ phần chữ: có khoá Claude thì Claude đọc lời thoại + kịch bản + khung hình;
 * không có (hoặc lỗi) thì dùng quy tắc. force=true: ghi đè tiêu đề / chữ nhấn / ảnh bìa đang có.
 */
export async function autoEditProject(name, report = () => {}, { force = false } = {}) {
  const meta = readMeta(name);
  const captions = readJson(fileOf(name, "captions.json"), []);
  const dur = meta.durationSec;
  const hookSec = meta.hook?.sec ?? EMPTY_HOOK.sec;
  const patch = {};
  let plan = null;
  const cc = await claudeCodeStatus();
  if (getAiConfig().key || (cc.ok && cc.loggedIn)) {
    try {
      report(0.98, "Claude đang đọc nội dung, lên chữ cho video (1–3 phút)");
      plan = await planVideo({
        video: fileOf(name, "video.mp4"),
        captions,
        script: meta.script || "",
        durationSec: dur,
        workDir: fileOf(name, ".work"),
        hookSec,
      });
    } catch (e) {
      console.warn("Claude tự dựng lỗi, dùng quy tắc:", e?.message || e);
      patch.autoNote = "Claude lỗi (" + String(e?.message || e).slice(0, 120) + ") — đã dựng bằng quy tắc, nên xem lại chữ nhấn.";
    }
  } else {
    patch.autoNote = "Chưa có Claude (Claude Code chưa đăng nhập, không có khoá API) — chữ nhấn chọn bằng quy tắc, nên xem lại trước khi xuất bản nét.";
  }

  if (plan) {
    patch.autoFixes = plan.fixes;
    if (plan.fixes.length) writeJson(fileOf(name, "captions.json"), applyFixes(captions, toRules(plan.fixes)));
    if (plan.hook && (force || !meta.hook?.text?.trim())) patch.hook = { ...EMPTY_HOOK, ...meta.hook, ...plan.hook, sec: hookSec };
    if (force || !(meta.callouts ?? []).length) patch.callouts = plan.callouts;
    if (force || !meta.cover?.title) patch.cover = plan.cover;
    patch.checks = plan.checks;
    patch.autoNote = "";
  } else {
    const vocab = readLines(VOCAB_FILE);
    const hookText = meta.hook?.text?.trim() || ruleHook({ captions, script: meta.script || "" });
    const callouts = ruleCallouts({ captions, durationSec: dur, hookSec: hookText ? hookSec : 0, vocab });
    if (force || !meta.hook?.text?.trim()) patch.hook = { ...EMPTY_HOOK, ...meta.hook, text: hookText, style: "redbold", y: 0.28, scale: 0.85 };
    if (force || !(meta.callouts ?? []).length) patch.callouts = callouts;
    if (force || !meta.cover?.title) patch.cover = ruleCover({ hookText, callouts, durationSec: dur });
    patch.checks = sentencesFromCaptionsWithNumbers(captions);
  }
  // SFX tự chèn tính lại theo tiêu đề mới
  if (meta.sfxAuto) patch.sfx = defaultSfx({ info: meta.info, hook: patch.hook ?? meta.hook, clipStarts: meta.clipStarts, durationSec: dur });
  return patchMeta(name, patch);
}

function sentencesFromCaptionsWithNumbers(captions) {
  const out = [];
  let cur = [];
  const flush = () => {
    const t = cur.map((c) => c.text.trim()).join(" ");
    if (/\d/.test(t)) out.push(`[${(cur[0].startMs / 1000).toFixed(0)}s] ${t}`);
    cur = [];
  };
  captions.forEach((c, i) => {
    if (cur.length && c.startMs - captions[i - 1].endMs > 700) flush();
    cur.push(c);
    if (/[.?!]$/.test(c.text.trim()) || cur.length > 18) flush();
  });
  if (cur.length) flush();
  return out.slice(0, 12);
}

/** chạy lại tự dựng (ghi đè) theo yêu cầu */
export function reAutoEdit(name) {
  const meta = readMeta(name);
  if (meta?.status !== "ready") throw new Error("Dự án chưa xử lý xong");
  return startJob(meta.name, "auto", async (report) => {
    // bắt đầu lại từ phụ đề gốc để không sửa chồng
    if (fs.existsSync(fileOf(name, "raw.json"))) writeJson(fileOf(name, "captions.json"), captionsFromRaw(fileOf(name, "raw.json")));
    await autoEditProject(name, report, { force: true });
    return { ok: true };
  });
}
