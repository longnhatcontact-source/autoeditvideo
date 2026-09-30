import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./paths.mjs";

export const W = 1080;
export const H = 1920;
export const FPS = 30;
const PYTHON = process.env.WHISPER_PYTHON || "F:/Tools/Python312/python.exe";
const ENC = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p"];
const AENC = ["-c:a", "aac", "-ar", "48000", "-ac", "2"];

export function run(cmd, args, onStdoutLine) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, {
      windowsHide: true,
      env: { ...process.env, PYTHONUTF8: "1", PYTHONIOENCODING: "utf-8" },
    });
    let stdout = "";
    let stderr = "";
    let buf = "";
    p.stdout.on("data", (d) => {
      stdout += d;
      if (!onStdoutLine) return;
      buf += d;
      const lines = buf.split(/\r?\n/);
      buf = lines.pop();
      lines.forEach(onStdoutLine);
    });
    p.stderr.on("data", (d) => (stderr += d));
    p.on("error", reject);
    p.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

async function ff(args, label) {
  const r = await run("ffmpeg", ["-y", "-hide_banner", ...args]);
  if (r.code !== 0) throw new Error(`ffmpeg ${label} lỗi:\n${r.stderr.slice(-600)}`);
  return r;
}

export async function probe(file) {
  const r = await run("ffprobe", [
    "-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height", "-of", "json", file,
  ]);
  const j = JSON.parse(r.stdout || "{}");
  const v = (j.streams || []).find((s) => s.codec_type === "video");
  return {
    duration: parseFloat(j.format?.duration || "0"),
    hasAudio: (j.streams || []).some((s) => s.codec_type === "audio"),
    hasVideo: Boolean(v),
    width: v?.width ?? 0,
    height: v?.height ?? 0,
  };
}

// Nền mờ phóng to phủ kín 9:16, video gốc đặt giữa
const filterFor = (crop) =>
  `[0:v]${crop ? crop + "," : ""}split=2[a][b];` +
  `[a]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},boxblur=30:5[bg];` +
  `[b]scale=${W}:${H}:force_original_aspect_ratio=decrease[fg];` +
  `[bg][fg]overlay=(W-w)/2:(H-h)/2,fps=${FPS},setsar=1[v]`;

// Dò viền đen có sẵn (bản ghi màn hình hay bị) để cắt bỏ
async function detectCrop(input, meta) {
  const ss = Math.min(10, Math.max(0, meta.duration / 3));
  const r = await run("ffmpeg", [
    "-ss", String(ss), "-i", input, "-t", "15", "-vf", "cropdetect=24:2:0", "-an", "-f", "null", "-",
  ]);
  const m = [...r.stderr.matchAll(/crop=(\d+:\d+:\d+:\d+)/g)];
  if (!m.length) return null;
  const [w, h, x, y] = m[m.length - 1][1].split(":").map(Number);
  if (w * h > meta.width * meta.height * 0.97 || w < 200 || h < 200) return null;
  return `crop=${w}:${h}:${x}:${y}`;
}

async function normalize(input, output, meta, crop) {
  const fc = filterFor(crop);
  if (meta.hasAudio) {
    await ff(["-i", input, "-filter_complex", fc, "-map", "[v]", "-map", "0:a", ...ENC, ...AENC, output], "chuẩn hoá");
  } else {
    await ff(
      ["-i", input, "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-filter_complex", fc,
        "-map", "[v]", "-map", "1:a", ...ENC, ...AENC, "-shortest", output],
      "chuẩn hoá"
    );
  }
}

async function detectSilence(file) {
  const r = await run("ffmpeg", ["-i", file, "-af", "silencedetect=noise=-30dB:d=0.7", "-f", "null", "-"]);
  const out = [];
  let start = null;
  for (const line of r.stderr.split(/\r?\n/)) {
    const s = line.match(/silence_start:\s*([0-9.]+)/);
    const e = line.match(/silence_end:\s*([0-9.]+)/);
    if (s) start = parseFloat(s[1]);
    if (e && start != null) {
      out.push({ start, end: parseFloat(e[1]) });
      start = null;
    }
  }
  if (start != null) out.push({ start, end: Infinity });
  return out;
}

// Đoạn GIỮ LẠI = phần giữa các khoảng im lặng, đệm 0.12s mỗi mép, bỏ đoạn < 0.35s
function keptSegments(duration, silences, pad = 0.12, minKeep = 0.35) {
  const kept = [];
  let cursor = 0;
  for (const s of silences) {
    if (s.start - cursor > minKeep) {
      kept.push({ start: Math.max(0, cursor - pad), end: Math.min(duration, s.start + pad) });
    }
    cursor = Math.min(duration, s.end);
  }
  if (duration - cursor > minKeep) kept.push({ start: Math.max(0, cursor - pad), end: duration });
  const merged = [];
  for (const k of kept) {
    const last = merged[merged.length - 1];
    if (last && k.start - last.end < 0.15) last.end = k.end;
    else merged.push({ ...k });
  }
  return merged.length ? merged : [{ start: 0, end: duration }];
}

/**
 * Clip thô -> 1 video 9:16 CFR 30fps (đã bỏ im lặng) tại outVideo.
 * onProgress(fraction 0..1, message)
 */
export async function buildBaseVideo(clips, workDir, outVideo, { removeSilence = true, onProgress = () => {} } = {}) {
  fs.mkdirSync(workDir, { recursive: true });
  const parts = [];
  const clipStarts = [];
  let elapsed = 0;
  for (let i = 0; i < clips.length; i++) {
    clipStarts.push(elapsed);
    const n = i + 1;
    const tag = `Clip ${n}/${clips.length}`;
    const base = i / clips.length;
    const step = 1 / clips.length;
    if (!fs.existsSync(clips[i])) throw new Error("Không thấy file: " + clips[i]);
    const meta = await probe(clips[i]);
    if (!meta.hasVideo) throw new Error("File không có hình: " + path.basename(clips[i]));

    onProgress(base, `${tag}: dò viền đen`);
    const crop = await detectCrop(clips[i], meta);
    onProgress(base + step * 0.1, `${tag}: chuyển sang khung dọc 9:16${crop ? " (đã cắt viền đen)" : ""}`);
    const norm = path.join(workDir, `norm_${n}.mp4`);
    await normalize(clips[i], norm, meta, crop);
    const normMeta = await probe(norm);

    let segs = [{ start: 0, end: normMeta.duration }];
    if (removeSilence && meta.hasAudio) {
      onProgress(base + step * 0.7, `${tag}: tìm đoạn im lặng`);
      segs = keptSegments(normMeta.duration, await detectSilence(norm));
    }
    elapsed += segs.reduce((s, x) => s + Math.max(0.1, x.end - x.start), 0);
    if (segs.length === 1 && segs[0].start === 0 && segs[0].end >= normMeta.duration) {
      parts.push(norm);
      continue;
    }
    for (let j = 0; j < segs.length; j++) {
      onProgress(base + step * (0.75 + (0.25 * j) / segs.length), `${tag}: cắt đoạn ${j + 1}/${segs.length}`);
      const out = path.join(workDir, `seg_${n}_${j + 1}.mp4`);
      await ff(["-ss", String(segs[j].start), "-i", norm, "-t", String(Math.max(0.1, segs[j].end - segs[j].start)),
        ...ENC, ...AENC, out], "cắt đoạn");
      parts.push(out);
    }
  }

  onProgress(1, "Ghép video");
  const list = path.join(workDir, "concat.txt");
  fs.writeFileSync(list, parts.map((f) => `file '${f.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`).join("\n"), "utf-8");
  // không B-frame + keyframe mỗi giây: Remotion đọc frame ổn định
  await ff(
    ["-f", "concat", "-safe", "0", "-i", list, "-r", String(FPS), "-fps_mode", "cfr",
      ...ENC, "-bf", "0", "-g", String(FPS), ...AENC, "-movflags", "+faststart", outVideo],
    "ghép"
  );
  for (const f of fs.readdirSync(workDir)) {
    if (/^(norm|seg)_.*\.mp4$/.test(f)) fs.rmSync(path.join(workDir, f), { force: true });
  }
  return { ...(await probe(outVideo)), clipStarts };
}

/** Làm mờ cố định các vùng (0..1) vào video — dùng cho CapCut vì CapCut không nhận vùng mờ từ app */
export async function bakeBlurs(input, output, boxes) {
  const even = (v) => Math.max(2, Math.round(v / 2) * 2);
  const parts = [];
  let last = "0:v";
  boxes.forEach((b, i) => {
    const x = even(b.x * W);
    const y = even(b.y * H);
    const w = Math.min(even(b.w * W), W - x);
    const h = Math.min(even(b.h * H), H - y);
    parts.push(
      `[${last}]split[m${i}][c${i}]`,
      `[c${i}]crop=${w}:${h}:${x}:${y},boxblur=luma_radius=18:luma_power=3[b${i}]`,
      `[m${i}][b${i}]overlay=${x}:${y}[v${i}]`
    );
    last = `v${i}`;
  });
  await ff(
    ["-i", input, "-filter_complex", parts.join(";"), "-map", `[${last}]`, "-map", "0:a?",
      ...ENC, "-bf", "0", "-g", String(FPS), "-c:a", "copy", "-movflags", "+faststart", output],
    "làm mờ vùng"
  );
}

/** Nhận dạng giọng nói -> ghi rawJson (words có timestamp). onProgress(0..1) */
export async function transcribeVideo(video, workDir, rawJson, { model = "medium", vocabFile, onProgress = () => {} } = {}) {
  const wav = path.join(workDir, "audio.wav");
  await ff(["-i", video, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", wav], "tách audio");
  const args = [path.join(ROOT, "scripts", "transcribe.py"), wav, model, rawJson];
  if (vocabFile && fs.existsSync(vocabFile)) args.push(vocabFile);
  const r = await run(PYTHON, args, (line) => {
    const m = line.match(/^@@P (\d+(?:\.\d+)?)/);
    if (m) onProgress(Math.min(1, parseFloat(m[1])));
  });
  fs.rmSync(wav, { force: true });
  if (r.code !== 0 || !fs.existsSync(rawJson)) {
    throw new Error("Nhận dạng giọng nói lỗi:\n" + (r.stderr || r.stdout).slice(-600));
  }
}
