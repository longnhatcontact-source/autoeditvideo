// Cửa sổ app: bật server xử lý (Node của máy) rồi mở giao diện
const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const LOG = path.join(ROOT, "projects", "app.log");
let server = null;
let baseUrl = null;
let win = null;
let quitting = false;

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
}

function findNode() {
  const candidates = [
    process.env.BDS_NODE,
    path.join(process.env.ProgramFiles || "C:\\Program Files", "nodejs", "node.exe"),
  ].filter(Boolean);
  return candidates.find((p) => fs.existsSync(p)) || "node";
}

function startServer() {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(LOG), { recursive: true });
    const log = fs.createWriteStream(LOG, { flags: "a" });
    log.write(`\n=== ${new Date().toISOString()} ===\n`);
    server = spawn(findNode(), [path.join(ROOT, "app", "server.mjs"), "--port", "0"], {
      cwd: ROOT,
      windowsHide: true,
      // BDS_DOWNLOADS: thư mục Downloads thật của Windows = nơi lưu video xuất mặc định
      env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined, BDS_DOWNLOADS: app.getPath("downloads") },
    });
    let buf = "";
    const timeout = setTimeout(() => reject(new Error("Phần xử lý không khởi động được (quá 30 giây)")), 30000);
    server.stdout.on("data", (d) => {
      log.write(d);
      buf += d;
      const m = buf.match(/@@PORT (\d+)/);
      if (m && !baseUrl) {
        clearTimeout(timeout);
        baseUrl = `http://127.0.0.1:${m[1]}`;
        resolve(baseUrl);
      }
    });
    server.stderr.on("data", (d) => log.write(d));
    server.on("error", (e) => {
      clearTimeout(timeout);
      reject(e);
    });
    server.on("exit", (code) => {
      log.write(`server exit ${code}\n`);
      if (!quitting && baseUrl) {
        dialog.showErrorBox("BĐS Video Studio", `Phần xử lý bị tắt (mã ${code}). Xem log: ${LOG}\nMở lại app để tiếp tục.`);
      }
    });
  });
}

async function runningJobs() {
  try {
    const jobs = await (await fetch(`${baseUrl}/api/jobs`)).json();
    return jobs.filter((j) => j.status === "running" || j.status === "queued");
  } catch {
    return [];
  }
}

function createWindow(url) {
  win = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: "#17110f",
    title: "BĐS Video Studio",
    icon: path.join(__dirname, "icon.ico"),
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, sandbox: true },
  });
  win.loadURL(url);
  // link ngoài mở bằng trình duyệt
  win.webContents.setWindowOpenHandler(({ url: u }) => {
    shell.openExternal(u);
    return { action: "deny" };
  });
  win.on("close", async (e) => {
    if (quitting) return;
    e.preventDefault();
    const busy = await runningJobs();
    if (busy.length) {
      const { response } = await dialog.showMessageBox(win, {
        type: "warning",
        buttons: ["Vẫn đóng", "Ở lại"],
        defaultId: 1,
        cancelId: 1,
        message: "Đang có việc chạy dở",
        detail: busy.map((j) => `• ${j.name}: ${j.message} (${Math.round(j.progress * 100)}%)`).join("\n") +
          "\n\nĐóng app bây giờ thì việc đó sẽ bị huỷ.",
      });
      if (response !== 0) return;
    }
    quitting = true;
    win.close();
  });
}

ipcMain.handle("pick-folder", async (_e, { defaultPath }) => {
  const r = await dialog.showOpenDialog(win, {
    title: "Chọn thư mục lưu video xuất",
    defaultPath,
    properties: ["openDirectory", "createDirectory"],
  });
  return r.canceled ? "" : r.filePaths[0];
});

ipcMain.handle("pick-files", async (_e, { multi, kind }) => {
  const filters =
    kind === "audio"
      ? [{ name: "Âm thanh", extensions: ["mp3", "wav", "m4a", "aac", "ogg", "flac"] }]
      : kind === "image"
        ? [{ name: "Ảnh", extensions: ["png", "jpg", "jpeg", "webp"] }]
        : kind === "media"
          ? [{ name: "Ảnh hoặc clip", extensions: ["png", "jpg", "jpeg", "webp", "mp4", "mov", "webm", "m4v"] }]
          : [{ name: "Video", extensions: ["mp4", "mov", "mkv", "avi", "webm", "m4v"] }];
  const r = await dialog.showOpenDialog(win, {
    properties: multi ? ["openFile", "multiSelections"] : ["openFile"],
    filters: [...filters, { name: "Tất cả", extensions: ["*"] }],
  });
  return r.canceled ? [] : r.filePaths;
});

// Chế độ dev (npm run dev): server + giao diện đã chạy sẵn, app chỉ mở cửa sổ trỏ vào Vite
const DEV_URL = process.env.BDS_DEV_URL;

app.whenReady().then(async () => {
  try {
    if (DEV_URL) {
      baseUrl = process.env.BDS_DEV_API || "http://127.0.0.1:5190";
      createWindow(DEV_URL);
      return;
    }
    const url = await startServer();
    createWindow(url);
  } catch (e) {
    dialog.showErrorBox("BĐS Video Studio", `Không mở được: ${e.message}\nXem log: ${LOG}`);
    app.quit();
  }
});

app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => {
  quitting = true;
});
app.on("quit", () => {
  if (server && !server.killed) server.kill();
});
