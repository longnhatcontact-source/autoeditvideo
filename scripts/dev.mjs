// Chế độ phát triển: sửa code là app tự cập nhật, không cần build lại / mở lại.
//   npm run dev        -> server tự khởi động lại khi sửa lib/ app/ src/  +  giao diện & khung xem trước cập nhật tức thì
//   npm run dev:sync   -> như trên, thêm: cứ 30 giây kiểm tra GitHub, có bản mới thì tự "git pull"
// Tuỳ chọn: --no-app  (không mở cửa sổ Electron, mở http://localhost:5191 bằng trình duyệt)
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const SYNC = args.includes("--sync");
const NO_APP = args.includes("--no-app");
const SERVER_PORT = 5190;
const UI_PORT = 5191;
const isWin = process.platform === "win32";

const children = [];
const log = (tag, color) => (d) => {
  for (const line of String(d).split(/\r?\n/)) if (line.trim()) console.log(`\x1b[${color}m[${tag}]\x1b[0m ${line}`);
};
function run(tag, color, cmd, cmdArgs, opts = {}) {
  const p = spawn(cmd, cmdArgs, { cwd: ROOT, shell: isWin && !path.isAbsolute(cmd), ...opts });
  p.stdout?.on("data", log(tag, color));
  p.stderr?.on("data", log(tag, color));
  p.on("exit", (code) => log(tag, color)(`đã tắt (mã ${code})`));
  children.push(p);
  return p;
}

// 1) Server API: Node tự khởi động lại khi file trong lib/ app/ src/ thay đổi.
//    (src/ vì bản xuất MP4 đóng gói composition 1 lần mỗi phiên server)
//    Lưu ý: server khởi động lại thì việc đang xuất MP4 / xử lý video dở sẽ bị huỷ.
const watch = isWin || process.platform === "darwin"
  ? ["--watch-path=./lib", "--watch-path=./app", "--watch-path=./src", "--watch-preserve-output"]
  : ["--watch", "--watch-preserve-output"];
run("server", "36", process.execPath, [...watch, "app/server.mjs", "--port", String(SERVER_PORT)]);

// 2) Giao diện (Vite): sửa ui/ hoặc src/ là khung xem trước cập nhật ngay, không mất trạng thái
run("giao-dien", "35", process.execPath, [path.join(ROOT, "node_modules", "vite", "bin", "vite.js"), "--config", "ui/vite.config.ts", "--port", String(UI_PORT), "--strictPort"]);

// 3) Cửa sổ app (Electron) trỏ vào Vite để vẫn có hộp chọn file
async function waitFor(url, ms = 60000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      const r = await fetch(url);
      if (r.status < 500) return true;
    } catch {
      /* chưa lên */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

if (!NO_APP) {
  const ok = (await waitFor(`http://127.0.0.1:${SERVER_PORT}/api/jobs`)) && (await waitFor(`http://localhost:${UI_PORT}/`));
  if (!ok) console.log("Không chờ được server / giao diện. Xem lỗi ở trên.");
  else {
    const electron = path.join(ROOT, "node_modules", "electron", "cli.js");
    if (!fs.existsSync(electron)) console.log("Chưa cài Electron: chạy  node node_modules/electron/install.js  rồi thử lại.");
    else {
      const app = run("app", "33", process.execPath, [electron, "."], {
        env: { ...process.env, BDS_DEV_URL: `http://localhost:${UI_PORT}`, BDS_DEV_API: `http://127.0.0.1:${SERVER_PORT}` },
      });
      app.on("exit", () => stop());
    }
  }
} else {
  console.log(`\nMở trình duyệt: http://localhost:${UI_PORT}\n`);
}

// 4) Tự lấy bản mới từ GitHub (chỉ khi máy KHÔNG có thay đổi chưa commit, chỉ fast-forward)
if (SYNC) {
  const git = (...a) => spawnSync("git", a, { cwd: ROOT, encoding: "utf8" });
  const tick = () => {
    // npm install hay tự sửa package-lock.json -> trả về bản trên GitHub, không coi là "đang sửa dở"
    const changed = git("status", "--porcelain").stdout.trim().split(/\r?\n/).filter(Boolean);
    if (changed.length && changed.every((l) => l.endsWith("package-lock.json"))) git("checkout", "--", "package-lock.json");
    else if (changed.length) return; // đang sửa dở -> không đụng
    if (git("fetch", "--quiet").status !== 0) return;
    const behind = Number(git("rev-list", "--count", "HEAD..@{u}").stdout.trim() || 0);
    if (!behind) return;
    const r = git("pull", "--ff-only", "--quiet");
    const msg = r.status === 0 ? `đã lấy ${behind} thay đổi mới từ GitHub — app tự cập nhật` : `không pull được: ${r.stderr.trim()}`;
    log("github", "32")(msg);
    if (r.status === 0 && git("diff", "--name-only", "HEAD@{1}", "HEAD", "--", "package.json").stdout.trim()) {
      log("github", "32")("package.json thay đổi: tắt dev (Ctrl+C), chạy  npm install  rồi mở lại.");
    }
  };
  log("github", "32")("bật tự cập nhật: kiểm tra mỗi 30 giây");
  setInterval(tick, 30000);
  tick();
}

let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  for (const c of children) {
    if (c.exitCode === null) {
      if (isWin) spawnSync("taskkill", ["/pid", String(c.pid), "/T", "/F"]);
      else c.kill();
    }
  }
  process.exit(0);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
