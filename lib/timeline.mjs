// Cắt bỏ đoạn video + dời mọi mốc thời gian theo; sóng âm cho dòng thời gian.
import fs from "node:fs";
import { spawn } from "node:child_process";

/** gộp + sắp xếp các đoạn cắt [{from,to}] (giây), bỏ đoạn quá ngắn */
export function normalizeRanges(ranges, duration) {
  const list = (Array.isArray(ranges) ? ranges : [])
    .map((r) => ({ from: Math.max(0, Number(r?.from) || 0), to: Math.min(duration, Number(r?.to) || 0) }))
    .filter((r) => r.to - r.from >= 0.05)
    .sort((a, b) => a.from - b.from);
  const out = [];
  for (const r of list) {
    const last = out[out.length - 1];
    if (last && r.from <= last.to + 0.02) last.to = Math.max(last.to, r.to);
    else out.push({ ...r });
  }
  return out;
}

/** đoạn được giữ lại (phần bù của các đoạn cắt) */
export function keptRanges(cuts, duration) {
  const keep = [];
  let t = 0;
  for (const c of cuts) {
    if (c.from > t) keep.push({ from: t, to: c.from });
    t = Math.max(t, c.to);
  }
  if (duration > t + 0.02) keep.push({ from: t, to: duration });
  return keep;
}

/** hàm đổi thời gian cũ -> mới. inside: thời điểm nằm trong đoạn bị cắt (trả về điểm nối) */
export function makeRemap(cuts) {
  return (t) => {
    let removed = 0;
    for (const c of cuts) {
      if (t >= c.to) removed += c.to - c.from;
      else if (t > c.from) return { t: Math.max(0, c.from - removed), inside: true };
      else break;
    }
    return { t: Math.max(0, t - removed), inside: false };
  };
}

/** dời 1 khối có [at, at+sec]: phần bị cắt mất thì co lại; mất hết thì trả null */
export function remapSpan(at, sec, remap, minSec = 0.3) {
  const start = remap(at);
  const a = start.t;
  let len = remap(at + sec).t - a;
  // chữ bắt đầu trong đoạn bị cắt: dời về điểm nối, giữ đủ thời gian để kịp đọc (tối đa như cũ, ít nhất 2.5s)
  if (start.inside) len = Math.max(len, Math.min(sec, 2.5));
  return len < minSec ? null : { at: Math.round(a * 100) / 100, sec: Math.round(len * 100) / 100 };
}

/** ffmpeg filter giữ các đoạn + nối lại (có fade tiếng 20ms ở mỗi chỗ nối cho khỏi lụp bụp) */
export function cutFilter(keep) {
  let fc = "";
  keep.forEach((k, i) => {
    const d = k.to - k.from;
    fc +=
      `[0:v]trim=${k.from.toFixed(3)}:${k.to.toFixed(3)},setpts=PTS-STARTPTS[v${i}];` +
      `[0:a]atrim=${k.from.toFixed(3)}:${k.to.toFixed(3)},asetpts=PTS-STARTPTS,` +
      `afade=t=in:d=0.02,afade=t=out:st=${Math.max(0, d - 0.02).toFixed(3)}:d=0.02[a${i}];`;
  });
  fc += keep.map((_, i) => `[v${i}][a${i}]`).join("") + `concat=n=${keep.length}:v=1:a=1[v][a]`;
  return fc;
}

/** sóng âm: độ to lớn nhất mỗi 50ms (0..1) */
export function audioPeaks(video, step = 0.05) {
  return new Promise((resolve, reject) => {
    const rate = 8000;
    const per = Math.round(rate * step);
    const p = spawn("ffmpeg", ["-v", "error", "-i", video, "-vn", "-ac", "1", "-ar", String(rate), "-f", "s16le", "-"], {
      windowsHide: true,
    });
    const peaks = [];
    let cur = 0;
    let n = 0;
    let rest = Buffer.alloc(0);
    p.stdout.on("data", (chunk) => {
      const buf = rest.length ? Buffer.concat([rest, chunk]) : chunk;
      const usable = buf.length - (buf.length % 2);
      for (let i = 0; i < usable; i += 2) {
        const v = Math.abs(buf.readInt16LE(i));
        if (v > cur) cur = v;
        if (++n === per) {
          peaks.push(Math.round((cur / 32768) * 100) / 100);
          cur = 0;
          n = 0;
        }
      }
      rest = buf.subarray(usable);
    });
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve({ step, peaks }) : reject(new Error("Không đọc được âm thanh"))));
  });
}

export const copyIfExists = (a, b) => fs.existsSync(a) && fs.copyFileSync(a, b);
