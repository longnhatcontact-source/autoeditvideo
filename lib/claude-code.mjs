// Gọi Claude qua Claude Code (lệnh `claude`) đã đăng nhập bằng tài khoản Claude của người dùng:
// dùng hạn mức gói Pro/Max đang có, không cần khoá API. Chỉ dùng trên máy của chính chủ tài khoản.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const IS_WIN = process.platform === "win32";
let cache = null; // { at, ok, version, loggedIn }

function runClaude(args, { input = "", cwd, timeoutMs = 60_000 } = {}) {
  return new Promise((resolve) => {
    let out = "";
    let err = "";
    let done = false;
    // Windows: lệnh `claude` thường là claude.cmd -> phải chạy qua shell, nên tự bọc ngoặc kép các tham số
    const a = IS_WIN ? args.map((x) => (/[\s"&|<>^]/.test(x) ? `"${x.replace(/"/g, '\\"')}"` : x)) : args;
    const p = spawn("claude", a, { cwd, shell: IS_WIN, windowsHide: true, env: process.env });
    const timer = setTimeout(() => {
      if (!done) p.kill();
    }, timeoutMs);
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("error", (e) => {
      done = true;
      clearTimeout(timer);
      resolve({ code: -1, out, err: String(e?.message || e) });
    });
    p.on("close", (code) => {
      done = true;
      clearTimeout(timer);
      resolve({ code, out, err });
    });
    if (input) p.stdin.write(input);
    p.stdin.end();
  });
}

/** Máy có Claude Code và đã đăng nhập chưa (lưu đệm 1 phút) */
export async function claudeCodeStatus(force = false) {
  if (!force && cache && Date.now() - cache.at < 60_000) return cache;
  const v = await runClaude(["--version"], { timeoutMs: 15_000 });
  if (v.code !== 0) return (cache = { at: Date.now(), ok: false, version: "", loggedIn: false });
  const version = v.out.trim().split(/\s+/)[0] || "";
  // bản mới có `claude auth status` (exit 0 = đã đăng nhập); bản cũ không có thì coi như đã đăng nhập, lỗi sẽ báo lúc gọi
  const a = await runClaude(["auth", "status"], { timeoutMs: 15_000 });
  const unknownCmd = /unknown|not.*command|did you mean/i.test(a.err + a.out);
  const loggedIn = a.code === 0 || unknownCmd;
  return (cache = { at: Date.now(), ok: true, version, loggedIn });
}

/**
 * Hỏi Claude qua Claude Code. content: chuỗi hoặc mảng khối {type:"text"} / {type:"image", path}.
 * Ảnh được đưa qua đường dẫn file để Claude tự mở bằng công cụ Read.
 */
export async function askClaudeCode(system, content, { model = "sonnet", timeoutMs = 5 * 60_000 } = {}) {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "bds-claude-"));
  try {
    const sysFile = path.join(work, "system.txt");
    fs.writeFileSync(sysFile, system, "utf8");
    const blocks = typeof content === "string" ? [{ type: "text", text: content }] : content;
    const parts = [];
    const images = [];
    for (const b of blocks) {
      if (b.type === "text") parts.push(b.text);
      else if (b.type === "image" && b.path && fs.existsSync(b.path)) {
        const dest = path.join(work, path.basename(b.path));
        fs.copyFileSync(b.path, dest);
        images.push(dest);
        parts.push(`[Ảnh: ${dest}]`);
      }
    }
    const prompt =
      (images.length
        ? `Trước tiên hãy dùng công cụ Read để xem lần lượt ${images.length} ảnh khung hình được nêu bên dưới, rồi mới trả lời.\n\n`
        : "") +
      parts.join("\n") +
      "\n\nChỉ trả về JSON đúng định dạng đã yêu cầu, không giải thích thêm.";
    const args = [
      "-p",
      // câu lệnh ASCII (cửa sổ lệnh Windows hay làm hỏng dấu tiếng Việt); nội dung thật đi qua stdin (UTF-8)
      "Follow the instructions in the piped input.",
      "--output-format",
      "json",
      "--model",
      model,
      "--system-prompt-file",
      sysFile,
      "--allowedTools",
      "Read",
      "--max-turns",
      String(images.length + 4),
    ];
    const r = await runClaude(args, { input: prompt, cwd: work, timeoutMs });
    if (r.code !== 0) {
      const msg = (r.err || r.out).trim().slice(-400);
      if (/log ?in|auth|credential|unauthori/i.test(msg)) throw new Error("Claude Code chưa đăng nhập. Mở cửa sổ lệnh, gõ: claude  rồi đăng nhập tài khoản Claude.");
      if (/usage limit|rate limit|limit reached/i.test(msg)) throw new Error("Đã chạm hạn mức gói Claude, đợi chu kỳ mới rồi bấm Tự dựng lại.");
      throw new Error("Claude Code báo lỗi: " + msg);
    }
    let res;
    try {
      res = JSON.parse(r.out);
    } catch {
      res = { result: r.out };
    }
    if (res.is_error) throw new Error("Claude Code báo lỗi: " + String(res.result || res.subtype || "").slice(0, 300));
    const text = String(res.result ?? "");
    try {
      return JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
    } catch {
      throw new Error("Không đọc được kết quả từ Claude Code, bấm thử lại");
    }
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}
