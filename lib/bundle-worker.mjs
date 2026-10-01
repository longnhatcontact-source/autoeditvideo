// Đóng gói phần dựng hình (src/) trong 1 tiến trình riêng: esbuild mà chết thì chỉ chết tiến trình này,
// server không bị kẹt lỗi "The service is no longer running". Dùng: node bundle-worker.mjs <entry> <outDir>
import { bundle } from "@remotion/bundler";

const [entryPoint, outDir] = process.argv.slice(2);
try {
  const url = await bundle({ entryPoint, outDir });
  process.stdout.write(`@@BUNDLE ${url}\n`);
  process.exit(0);
} catch (e) {
  process.stderr.write(String(e?.stack || e));
  process.exit(1);
}
