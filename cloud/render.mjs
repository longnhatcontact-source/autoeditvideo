// Dựng hình trong phiên cloud (không cần app, không cần mạng tới Google Fonts).
//   node cloud/render.mjs video  <props.json> <ra.mp4> [lite|net]     (lite: 720x1280 crf 28 · net: 1080x1920 crf 20)
//   node cloud/render.mjs stills <props.json> <frames.json> <thư-mục-ra>   frames.json: [{"id":"c0","frame":120},...]
//   node cloud/render.mjs cover  <cover-props.json> <ra.png>
// Thư mục public (video nguồn .webm, fonts, sfx): biến BDS_PUBLIC, mặc định .work/cloud/public (cloud/setup.sh tạo sẵn).
import { bundle } from "@remotion/bundler";
import { openBrowser, renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = path.resolve(process.env.BDS_PUBLIC || path.join(ROOT, ".work/cloud/public"));
const OFFLINE = path.join(ROOT, "cloud/load-font.offline.ts");
const [mode, propsFile, a3, a4] = process.argv.slice(2);
if (!mode || !propsFile) { console.error("Xem cách dùng ở đầu file cloud/render.mjs"); process.exit(1); }

function findBrowser() {
  if (process.env.BDS_BROWSER) return process.env.BDS_BROWSER;
  try {
    const p = execSync("find /opt/pw-browsers -name headless_shell -type f 2>/dev/null | sort | tail -1").toString().trim();
    if (p) return p;
  } catch {}
  return undefined; // để Remotion tự tải (cần mạng)
}
// dọn gói tạm cũ của Remotion (mỗi lần đóng gói chép cả public, dễ đầy ổ)
for (const d of fs.readdirSync(os.tmpdir())) if (d.startsWith("remotion-webpack-bundle-")) fs.rmSync(path.join(os.tmpdir(), d), { recursive: true, force: true });

const inputProps = JSON.parse(fs.readFileSync(propsFile, "utf8"));
const serveUrl = await bundle({
  entryPoint: path.join(ROOT, "src/index.ts"),
  publicDir: PUBLIC,
  webpackOverride: (c) => ({ ...c, resolve: { ...c.resolve, alias: { ...(c.resolve?.alias || {}), [path.join(ROOT, "src/load-font.ts")]: OFFLINE, [path.join(ROOT, "src/load-font")]: OFFLINE } } }),
});
const browserExecutable = findBrowser();
const browser = await openBrowser("chrome", { browserExecutable });
const concurrency = Math.max(1, Math.min(os.cpus().length, 4));
try {
  if (mode === "video") {
    const composition = await selectComposition({ serveUrl, id: "BdsVideo", inputProps, puppeteerInstance: browser });
    await renderMedia({ composition, serveUrl, codec: "h264", ...(a4 === "net" ? { crf: 20 } : { scale: 2 / 3, crf: 28 }), outputLocation: a3, inputProps, concurrency, puppeteerInstance: browser });
  } else if (mode === "stills") {
    const frames = JSON.parse(fs.readFileSync(a3, "utf8"));
    fs.mkdirSync(a4, { recursive: true });
    const composition = await selectComposition({ serveUrl, id: "BdsVideo", inputProps, puppeteerInstance: browser });
    for (const f of frames) await renderStill({ composition, serveUrl, output: path.join(a4, `${f.id}.jpg`), frame: f.frame, inputProps, imageFormat: "jpeg", jpegQuality: 80, scale: 0.4, puppeteerInstance: browser });
  } else if (mode === "cover") {
    const composition = await selectComposition({ serveUrl, id: "BiaVideo", inputProps, puppeteerInstance: browser });
    await renderStill({ composition, serveUrl, output: a3, frame: 90, inputProps, puppeteerInstance: browser });
  } else throw new Error("mode phải là video | stills | cover");
} finally {
  await browser.close({ silent: true });
}
console.log("DONE");
