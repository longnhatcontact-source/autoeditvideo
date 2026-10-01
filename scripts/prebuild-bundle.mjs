// Đóng gói sẵn phần dựng hình (src/) -> prebuilt/bundle, đưa lên GitHub cùng code.
// Máy dùng app không phải tự đóng gói (tránh lỗi esbuild trên Windows). Chạy lại mỗi khi sửa src/:
//   node scripts/prebuild-bundle.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { srcHash } from "../lib/srcstamp.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(ROOT, "prebuilt", "bundle");
const emptyPublic = fs.mkdtempSync(path.join(os.tmpdir(), "bds-pub-"));
fs.rmSync(out, { recursive: true, force: true });
await bundle({
  entryPoint: path.join(ROOT, "src", "index.ts"),
  outDir: out,
  publicDir: emptyPublic,
  webpackOverride: (c) => ({ ...c, devtool: false }),
});
for (const f of fs.readdirSync(out)) if (f.endsWith(".map")) fs.rmSync(path.join(out, f));
fs.writeFileSync(path.join(out, "STAMP"), srcHash(path.join(ROOT, "src")));
const size = fs.readdirSync(out).reduce((a, f) => a + (fs.statSync(path.join(out, f)).isFile() ? fs.statSync(path.join(out, f)).size : 0), 0);
console.log(`prebuilt/bundle: ${(size / 1e6).toFixed(1)} MB, stamp ${fs.readFileSync(path.join(out, "STAMP"), "utf8")}`);
