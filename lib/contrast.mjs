// Đo độ sáng nền phía sau mỗi khối chữ nhấn (0 tối … 1 trắng) để chữ tự thêm viền tối khi nền sáng.
import { spawnSync } from "node:child_process";
import fs from "node:fs";

const W = 1080;
const H = 1920;
const BOX = { w: 960, h: 460 }; // khớp OVERLAY_BOX / cỡ khối chữ (Callouts.tsx)
const cache = new Map();

function lumaAt(video, t, x, y, scale) {
  const w = Math.min(W, Math.round(BOX.w * scale));
  const h = Math.min(H, Math.round(BOX.h * scale));
  const cx = Math.round(Math.min(W - w, Math.max(0, x * W - w / 2)));
  const cy = Math.round(Math.min(H - h, Math.max(0, y * H - h / 2)));
  const r = spawnSync(
    "ffmpeg",
    ["-v", "error", "-ss", t.toFixed(2), "-i", video, "-frames:v", "1", "-vf", `scale=${W}:${H},crop=${w}:${h}:${cx}:${cy},scale=48:-1,format=gray`, "-f", "rawvideo", "-"],
    { maxBuffer: 1 << 20 },
  );
  if (r.status !== 0 || !r.stdout?.length) return null;
  let sum = 0;
  for (const v of r.stdout) sum += v;
  return sum / r.stdout.length / 255;
}

/** Gắn c.bg cho từng chữ nhấn (lấy 3 khung: đầu, giữa, cuối; lấy giá trị sáng nhất). Lỗi thì bỏ qua. */
export function withBackground(video, callouts, version = 0) {
  if (!video || !fs.existsSync(video)) return callouts;
  return callouts.map((c) => {
    const key = [video, version, c.at, c.sec, c.x, c.y, c.scale].join("|");
    if (!cache.has(key)) {
      const ts = [c.at + 0.3, c.at + c.sec / 2, c.at + Math.max(0.4, c.sec - 0.3)];
      const vals = ts.map((t) => lumaAt(video, t, c.x, c.y, c.scale)).filter((v) => v != null);
      cache.set(key, vals.length ? Math.round(Math.max(...vals) * 100) / 100 : undefined);
    }
    const bg = cache.get(key);
    return bg == null ? c : { ...c, bg };
  });
}
