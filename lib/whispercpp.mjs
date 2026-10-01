// Nhận dạng giọng nói bằng whisper.cpp (dùng cho bản cài .exe: không cần Python).
// BDS_WHISPER_DIR = thư mục chứa whisper-cli.exe; model ggml tự tải lần đầu về <dữ liệu>/models.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DATA } from "./paths.mjs";
import { run } from "./media.mjs";

const MODEL_URL = (m) => `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-${m}.bin`;
const MODEL_SIZE = { small: 487601967, medium: 1533763059 };

export const whisperCppAvailable = () => {
  const d = process.env.BDS_WHISPER_DIR;
  return Boolean(d && fs.existsSync(path.join(d, process.platform === "win32" ? "whisper-cli.exe" : "whisper-cli")));
};

/** tải model ggml (1 lần), có tiến độ; tải dở thì tải lại */
export async function ensureModel(model, onProgress = () => {}) {
  const dir = path.join(DATA, "models");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `ggml-${model}.bin`);
  if (fs.existsSync(file) && (!MODEL_SIZE[model] || fs.statSync(file).size >= MODEL_SIZE[model] * 0.98)) return file;
  const tmp = file + ".part";
  const res = await fetch(MODEL_URL(model));
  if (!res.ok || !res.body) throw new Error(`Không tải được model nhận giọng (${res.status}). Kiểm tra mạng rồi thử lại.`);
  const total = Number(res.headers.get("content-length")) || MODEL_SIZE[model] || 0;
  const out = fs.createWriteStream(tmp);
  let got = 0;
  for await (const chunk of res.body) {
    got += chunk.length;
    if (!out.write(chunk)) await new Promise((r) => out.once("drain", r));
    if (total) onProgress(got / total);
  }
  await new Promise((r) => out.end(r));
  fs.renameSync(tmp, file);
  return file;
}

/** wav 16k mono -> raw.json {duration, words:[{start,end,word,prob}], segments} giống bản faster-whisper */
export async function transcribeWhisperCpp(wav, model, rawJson, { onProgress = () => {}, onStatus = () => {} } = {}) {
  onStatus("Tải model nhận giọng (chỉ lần đầu, ~1.5 GB)");
  const modelFile = await ensureModel(model, (p) => onStatus(`Tải model nhận giọng (chỉ lần đầu) ${Math.round(p * 100)}%`));
  onStatus("Nhận dạng giọng nói");
  const exe = path.join(process.env.BDS_WHISPER_DIR, process.platform === "win32" ? "whisper-cli.exe" : "whisper-cli");
  const outBase = rawJson.replace(/\.json$/, "") + "_wcpp";
  const threads = String(Math.max(2, Math.min(8, os.cpus().length - 1)));
  // -ml 1 -sow: mỗi đoạn = 1 từ (có mốc thời gian từng từ), -oj: ghi JSON
  const args = ["-m", modelFile, "-f", wav, "-l", "vi", "-t", threads, "-ml", "1", "-sow", "-oj", "-of", outBase, "-pp", "-bs", "5"];
  const r = await run(exe, args, (line) => {
    const m = line.match(/progress\s*=\s*(\d+)%/);
    if (m) onProgress(Number(m[1]) / 100);
  });
  // whisper-cli in tiến độ ra stderr
  for (const m of (r.stderr || "").matchAll(/progress\s*=\s*(\d+)%/g)) onProgress(Number(m[1]) / 100);
  const jf = outBase + ".json";
  if (r.code !== 0 || !fs.existsSync(jf)) throw new Error("Nhận dạng giọng nói lỗi:\n" + (r.stderr || r.stdout).slice(-600));
  const j = JSON.parse(fs.readFileSync(jf, "utf8"));
  fs.rmSync(jf, { force: true });
  const words = [];
  for (const it of j.transcription || []) {
    const w = String(it.text || "").trim();
    if (!w || /^\[.*\]$/.test(w)) continue;
    words.push({ start: it.offsets.from / 1000, end: it.offsets.to / 1000, word: w, prob: null });
  }
  const duration = words.length ? words[words.length - 1].end : 0;
  fs.writeFileSync(rawJson, JSON.stringify({ duration, language: "vi", words, segments: [] }), "utf8");
}
