import fs from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { ROOT, TMP_DIR } from "./paths.mjs";

// Remotion lấy thư mục tạm theo biến TEMP/TMP -> trỏ sang thư mục riêng, dọn sạch mỗi lần mở app
if (TMP_DIR) {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
  fs.mkdirSync(TMP_DIR, { recursive: true });
  process.env.TEMP = TMP_DIR;
  process.env.TMP = TMP_DIR;
}

let bundlePromise = null;

// Bundle 1 lần mỗi phiên chạy (composition không đổi khi app đang mở)
function getBundle() {
  if (!bundlePromise) {
    bundlePromise = bundle({ entryPoint: path.join(ROOT, "src", "index.ts") }).catch((e) => {
      bundlePromise = null;
      throw e;
    });
  }
  return bundlePromise;
}

async function renderOnce(inputProps, outputLocation, onProgress, lite) {
  const serveUrl = await getBundle();
  const composition = await selectComposition({ serveUrl, id: "BdsVideo", inputProps });
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    // bản nhẹ: 720×1280, nén mạnh hơn (~10MB/phút rưỡi) để gửi duyệt nhanh; bản nét: 1080×1920
    ...(lite ? { scale: 2 / 3, crf: 28 } : { crf: 20 }),
    outputLocation,
    inputProps,
    // máy ít RAM: giới hạn số tab render song song
    concurrency: 4,
    onProgress: ({ progress }) => onProgress(progress, "Đang xuất video"),
  });
}

/** inputProps: props của composition BdsVideo (src/musicSrc/sfx là URL http). Lỗi thì tự thử lại 1 lần. */
export async function renderVideo(inputProps, outputLocation, onProgress = () => {}, { lite = false } = {}) {
  onProgress(0, "Chuẩn bị");
  try {
    await renderOnce(inputProps, outputLocation, onProgress, lite);
  } catch (e) {
    console.error("[render] lỗi, thử lại 1 lần:", e?.message || e);
    fs.rmSync(outputLocation, { force: true });
    if (TMP_DIR) fs.mkdirSync(TMP_DIR, { recursive: true });
    onProgress(0, "Gặp lỗi, đang thử lại");
    await renderOnce(inputProps, outputLocation, onProgress, lite);
  }
  return outputLocation;
}

/** Ảnh bìa 1080×1920 (composition BiaVideo, khung 90 khi hiệu ứng chữ đã chạy xong) */
export async function renderCoverImage(inputProps, outputLocation) {
  const serveUrl = await getBundle();
  const composition = await selectComposition({ serveUrl, id: "BiaVideo", inputProps });
  await renderStill({ composition, serveUrl, output: outputLocation, frame: 90, inputProps, imageFormat: "png" });
  return outputLocation;
}
