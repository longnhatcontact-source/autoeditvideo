import fs from "node:fs";
import path from "node:path";
import { keepPhrases, makePages, numberFlags, toPages, ZOOM_SCALE, zoomMoments } from "./captions-core.mjs";
import { run } from "./media.mjs";
import { ROOT } from "./paths.mjs";

const PYTHON = process.env.WHISPER_PYTHON || "F:/Tools/Python312/python.exe";

/**
 * Tạo draft CapCut "BDS_<name>" (tiền tố để không ghi đè draft tự làm).
 * music: {path, volume} | null ; sfx: [{path, at, volume}]
 */
export async function exportCapcut({
  name, videoPath, hook, brand, subStyle, punchZoom, overlays = [], captions, keepTogether = [], durationSec, info, music, sfx, workDir,
}) {
  const keep = keepPhrases(keepTogether);
  const spec = {
    zooms: punchZoom
      ? zoomMoments(makePages(captions, keep)).map((z) => ({ start: z.startMs / 1000, end: z.endMs / 1000 }))
      : [],
    zoomScale: ZOOM_SCALE,
    overlays: overlays.map(({ path: p, at, sec, kind, w, h }) => ({ path: p, at, sec, kind, w, h })),
    draftName: `BDS_${name}`,
    videoPath,
    hook: hook?.text?.trim() ? hook : null,
    brand,
    subStyle,
    pages: toPages(captions, durationSec, keep).map(({ from, to, start, end, text }) => {
      const words = captions.slice(from, to).map((c) => c.text.trim());
      const nums = numberFlags(words);
      return {
        start,
        end,
        text,
        words: captions
          .slice(from, to)
          .map((c, k) => ({ text: words[k], start: c.startMs / 1000, end: c.endMs / 1000, num: nums[k] })),
      };
    }),
    info,
    music,
    sfx,
  };
  fs.mkdirSync(workDir, { recursive: true });
  const specFile = path.join(workDir, "capcut_spec.json");
  fs.writeFileSync(specFile, JSON.stringify(spec), "utf-8");
  if (process.env.BDS_WHISPER_DIR && !process.env.WHISPER_PYTHON) {
    throw new Error("Bản cài này chưa hỗ trợ xuất sang CapCut. Anh chị sửa trực tiếp trong app rồi bấm Xuất MP4 nhé.");
  }
  const r = await run(PYTHON, [path.join(ROOT, "scripts", "capcut_export.py"), specFile]);
  let res;
  try {
    res = JSON.parse((r.stdout || "").trim().split(/\r?\n/).pop());
  } catch {
    throw new Error("Xuất CapCut lỗi:\n" + (r.stderr || r.stdout).slice(-800));
  }
  if (!res.ok) throw new Error("Xuất CapCut lỗi: " + res.error);
  return { ...res, pages: spec.pages.length };
}
