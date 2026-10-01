// Đóng gói phần dựng hình (src/) trong 1 tiến trình riêng: esbuild mà chết thì chỉ chết tiến trình này,
// server không bị kẹt lỗi "The service is no longer running". Dùng: node bundle-worker.mjs <entry> <outDir>
import { bundle } from "@remotion/bundler";

const [entryPoint, outDir] = process.argv.slice(2);
try {
  const url = await bundle({ entryPoint, outDir });
  process.stdout.write(`@@BUNDLE ${url}\n`);
  process.exit(0);
} catch (e) {
  const msg = String(e?.stack || e) + "\n" + JSON.stringify(e?.errors ?? e?.details ?? null);
  try {
    (await import("node:fs")).writeFileSync((await import("node:path")).join(outDir, "..", "bundle-error.log"), msg);
  } catch {}
  process.stderr.write(msg);
  process.exit(1);
}
