// Hàng đợi "phiếu việc" để Claude giao phần dựng nặng cho máy Windows (chạy native, dùng đủ nhân CPU).
// Claude (qua thư mục đã kết nối) ghi  jobs/inbox/<id>.json  ->  app tự nhận, chạy tuần tự từng bước,
// ghi tiến độ vào  jobs/run/<id>/status.json  (+ log.txt). Kết quả nằm trong jobs/run/<id>/ hoặc thư mục xuất.
// Chỉ chạy các loại bước có sẵn dưới đây (không chạy lệnh shell tuỳ ý).
//   { "id": "parkcity", "steps": [ {"type":"probe"}, {"type":"ffmpeg","args":[...]}, ... ] }
// Biến trong chuỗi: {JOB} thư mục việc · {ROOT} mã nguồn · {PUBLIC} thư mục public dựng hình · {EXPORT} thư mục xuất (Downloads)
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DATA, ROOT } from "./paths.mjs";

const JOBS = process.env.BDS_JOBS_DIR || path.join(DATA, "jobs");
const INBOX = path.join(JOBS, "inbox");
const RUN = path.join(JOBS, "run");
const PUBLIC = path.resolve(process.env.BDS_PUBLIC || path.join(ROOT, ".work", "cloud", "public"));
const BIN = path.join(ROOT, ".work", "cloud", "bin");
const isWin = process.platform === "win32";
const PYTHON = process.env.WHISPER_PYTHON || (isWin ? "F:/Tools/Python312/python.exe" : "python3");
const DF_URL = isWin
  ? "https://github.com/Rikorose/DeepFilterNet/releases/download/v0.5.6/deep-filter-0.5.6-x86_64-pc-windows-msvc.exe"
  : "https://github.com/Rikorose/DeepFilterNet/releases/download/v0.5.6/deep-filter-0.5.6-x86_64-unknown-linux-musl";
const DF = path.join(BIN, isWin ? "deep-filter.exe" : "deep-filter");
const CPUS = os.cpus().length;

function exportDir() {
  try {
    const s = JSON.parse(fs.readFileSync(path.join(ROOT, "settings.json"), "utf8"));
    if (s.exportDir) return s.exportDir;
  } catch {}
  return path.join(os.homedir(), "Downloads");
}

function proc(cmd, args, { cwd = ROOT, env = {}, onLine } = {}) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { cwd, windowsHide: true, env: { ...process.env, PYTHONUTF8: "1", PYTHONIOENCODING: "utf-8", ...env } });
    let out = "";
    const take = (d) => {
      out += d;
      if (out.length > 200000) out = out.slice(-100000);
      if (onLine) String(d).split(/\r?\n/).forEach((l) => l.trim() && onLine(l));
    };
    p.stdout.on("data", take);
    p.stderr.on("data", take);
    p.on("error", (e) => resolve({ code: -1, out: String(e) }));
    p.on("close", (code) => resolve({ code, out }));
  });
}
async function must(cmd, args, opts, label) {
  const r = await proc(cmd, args, opts);
  if (r.code !== 0) throw new Error(`${label || path.basename(cmd)} lỗi (mã ${r.code}):\n${r.out.slice(-1500)}`);
  return r.out;
}

async function ensureSetup(log) {
  for (const [from, to] of [[path.join(ROOT, "cloud", "fonts"), path.join(PUBLIC, "fonts")], [path.join(ROOT, "assets", "sfx"), path.join(PUBLIC, "sfx")]]) {
    fs.mkdirSync(to, { recursive: true });
    for (const f of fs.readdirSync(from)) if (!fs.existsSync(path.join(to, f))) fs.copyFileSync(path.join(from, f), path.join(to, f));
  }
  fs.mkdirSync(path.join(PUBLIC, "cover"), { recursive: true });
  if (!fs.existsSync(DF)) {
    log("Tải bộ lọc ồn DeepFilterNet…");
    fs.mkdirSync(BIN, { recursive: true });
    const r = await fetch(DF_URL);
    if (!r.ok) throw new Error("Không tải được deep-filter: " + r.status);
    fs.writeFileSync(DF + ".part", Buffer.from(await r.arrayBuffer()));
    fs.renameSync(DF + ".part", DF);
    if (!isWin) fs.chmodSync(DF, 0o755);
  }
}

const STEPS = {
  async setup(_s, ctx) {
    await ensureSetup(ctx.log);
  },
  async probe(_s, ctx) {
    const info = { platform: process.platform, cpus: CPUS, cpu: os.cpus()[0]?.model, memGB: Math.round(os.totalmem() / 2 ** 30), node: process.version, root: ROOT, public: PUBLIC, export: exportDir() };
    info.ffmpeg = (await proc("ffmpeg", ["-hide_banner", "-version"])).out.split(/\r?\n/)[0];
    info.encoders = (await proc("ffmpeg", ["-hide_banner", "-encoders"])).out.match(/libx264|libvpx-vp9|h264_nvenc|h264_qsv|h264_amf/g)?.filter((v, i, a) => a.indexOf(v) === i);
    info.python = (await proc(PYTHON, ["-c", "import sys,faster_whisper;print(sys.version.split()[0],faster_whisper.__version__)"])).out.trim();
    info.deepFilter = fs.existsSync(DF);
    fs.writeFileSync(path.join(ctx.dir, "probe.json"), JSON.stringify(info, null, 1));
  },
  async ffmpeg(s, ctx) {
    await must("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...s.args.map(ctx.sub)], {}, "ffmpeg");
  },
  // lọc ồn: giống cloud/denoise.sh
  async denoise(s, ctx) {
    await ensureSetup(ctx.log);
    const tmp = path.join(ctx.dir, "_dn");
    fs.mkdirSync(tmp, { recursive: true });
    const src = path.join(tmp, "src.wav");
    await must("ffmpeg", ["-y", "-v", "error", "-i", ctx.sub(s.in), "-vn", "-ac", "1", "-ar", "48000", "-af", "highpass=f=90", "-c:a", "pcm_s16le", src]);
    await must(DF, ["--pf", "-D", "-o", path.join(tmp, "out"), src], {}, "deep-filter");
    await must("ffmpeg", ["-y", "-v", "error", "-i", path.join(tmp, "out", "src.wav"), "-af",
      "highpass=f=100,acompressor=threshold=-24dB:ratio=2.5:attack=8:release=160:makeup=1,volume=15dB,alimiter=limit=0.87:attack=3:release=60:level=disabled",
      "-ar", "48000", "-ac", "2", ctx.sub(s.out)]);
    fs.rmSync(tmp, { recursive: true, force: true });
  },
  // nhận giọng nói: faster-whisper medium (cùng model với bản cloud)
  async transcribe(s, ctx) {
    await must(PYTHON, [path.join(ROOT, "cloud", "transcribe.py"), ctx.sub(s.in), ctx.sub(s.out), s.model || process.env.BDS_WHISPER_MODEL || "medium"], { onLine: ctx.log }, "nhận giọng nói");
  },
  async broll(s, ctx) {
    await must(PYTHON, [path.join(ROOT, "cloud", "broll.py"), ctx.sub(s.base), ctx.sub(s.plan), ctx.sub(s.out)], {}, "chèn cảnh bổ trợ");
  },
  // đưa video vào public dạng VP9 webm (như cloud/to-webm.sh), dùng nhiều luồng
  async webm(s, ctx) {
    await ensureSetup(ctx.log);
    const a = s.audio ? ["-i", ctx.sub(s.audio), "-map", "0:v", "-map", "1:a", "-shortest"] : [];
    await must("ffmpeg", ["-y", "-v", "error", "-i", ctx.sub(s.in), ...a, "-c:v", "libvpx-vp9", "-crf", "24", "-b:v", "0", "-deadline", "realtime", "-cpu-used", "6",
      "-row-mt", "1", "-threads", String(Math.min(CPUS, 16)), "-tile-columns", "2", "-c:a", "libopus", "-b:a", "160k", path.join(PUBLIC, s.name)]);
  },
  // dựng hình: cloud/render.mjs (video lite|net · stills · cover)
  async render(s, ctx) {
    await ensureSetup(ctx.log);
    const args = [path.join(ROOT, "cloud", "render.mjs"), s.mode, ctx.sub(s.props), ...[s.a3, s.a4].filter(Boolean).map(ctx.sub)];
    await must(process.execPath, args, { env: { BDS_PUBLIC: PUBLIC, BDS_CONCURRENCY: String(s.concurrency || Math.max(2, Math.min(CPUS - 2, 8))), ...(s.stillScale ? { STILL_SCALE: String(s.stillScale) } : {}) }, onLine: (l) => /%|DONE|Error/.test(l) && ctx.log(l) }, "dựng hình");
  },
  // đo độ sáng nền sau các khung chữ ở nhiều vị trí y (để chọn chỗ đặt chữ)
  async bggrid(s, ctx) {
    const { withBackground } = await import("./contrast.mjs");
    const items = JSON.parse(fs.readFileSync(ctx.sub(s.items), "utf8"));
    const ys = s.ys || [0.14, 0.18, 0.22, 0.58, 0.62, 0.66, 0.7, 0.74, 0.78];
    const out = items.map((c) => ({ at: c.at, sec: c.sec, bg: Object.fromEntries(ys.map((y) => [y, withBackground(ctx.sub(s.video), [{ ...c, x: 0.5, y, scale: c.scale || 0.86 }], Date.now())[0].bg])) }));
    fs.writeFileSync(ctx.sub(s.out), JSON.stringify(out, null, 1));
  },
  async copy(s, ctx) {
    const to = ctx.sub(s.to);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(ctx.sub(s.from), to);
  },
};

let busy = false;
async function runJob(file) {
  const job = JSON.parse(fs.readFileSync(file, "utf8"));
  const id = String(job.id || path.basename(file, ".json")).replace(/[^\w.-]/g, "_");
  const dir = path.join(RUN, id);
  fs.mkdirSync(dir, { recursive: true });
  fs.renameSync(file, path.join(dir, `job-${Date.now()}.json`));
  const status = { id, state: "running", startedAt: new Date().toISOString(), cpus: CPUS, steps: [] };
  const save = () => fs.writeFileSync(path.join(dir, "status.json"), JSON.stringify(status, null, 1));
  const logFile = path.join(dir, "log.txt");
  const log = (l) => fs.appendFileSync(logFile, `[${new Date().toLocaleTimeString()}] ${l}\n`);
  const vars = { JOB: dir, ROOT, PUBLIC, EXPORT: exportDir() };
  const sub = (v) => String(v).replace(/\{(JOB|ROOT|PUBLIC|EXPORT)\}/g, (_, k) => vars[k]);
  save();
  const t0 = Date.now();
  for (const [i, s] of (job.steps || []).entries()) {
    const fn = STEPS[s.type];
    const rec = { i, type: s.type, label: s.label || "", state: "running" };
    status.steps.push(rec);
    status.step = i;
    save();
    const t = Date.now();
    log(`▶ ${i} ${s.type} ${s.label || ""}`);
    try {
      if (!fn) throw new Error("Không có loại bước: " + s.type);
      await fn(s, { dir, log, sub });
      rec.state = "done";
    } catch (e) {
      rec.state = "error";
      status.state = "error";
      status.error = String(e?.message || e).slice(-3000);
      log("✖ " + status.error);
    }
    rec.sec = Math.round((Date.now() - t) / 100) / 10;
    save();
    if (status.state === "error") break;
  }
  if (status.state !== "error") status.state = "done";
  status.totalSec = Math.round((Date.now() - t0) / 100) / 10;
  status.finishedAt = new Date().toISOString();
  save();
  log(`■ ${status.state} sau ${status.totalSec}s`);
}

async function tick() {
  if (busy) return;
  let files = [];
  try {
    files = fs.readdirSync(INBOX).filter((f) => f.endsWith(".json")).sort();
  } catch {
    return;
  }
  if (!files.length) return;
  busy = true;
  try {
    await runJob(path.join(INBOX, files[0]));
  } catch (e) {
    console.error("[jobs]", e);
  } finally {
    busy = false;
  }
}

export function startJobWorker() {
  fs.mkdirSync(INBOX, { recursive: true });
  fs.mkdirSync(RUN, { recursive: true });
  fs.writeFileSync(path.join(JOBS, "worker.json"), JSON.stringify({ alive: new Date().toISOString(), pid: process.pid, cpus: CPUS, platform: process.platform, root: ROOT }, null, 1));
  setInterval(() => {
    try {
      fs.writeFileSync(path.join(JOBS, "worker.json"), JSON.stringify({ alive: new Date().toISOString(), pid: process.pid, cpus: CPUS, platform: process.platform, root: ROOT, busy }, null, 1));
    } catch {}
    tick();
  }, 3000);
  console.log(`[jobs] nhận phiếu việc ở ${INBOX}`);
}
