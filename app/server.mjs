// Server của app: API + phát file video/nhạc/SFX + giao diện (ui/dist)
// Chạy: node app/server.mjs [--port 5190]  -> in "@@PORT <n>" khi sẵn sàng
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import express from "express";
import { FIX_FILE, PROJECTS_DIR, ROOT, VOCAB_FILE } from "../lib/paths.mjs";
import {
  addOverlay, applyTemplate, capcutProject, compositionProps, createProject, deleteProject, getProject, listJobs, listProjects,
  processProject, projectDir, reapplyFixes, renderProject, saveAsTemplate, setMusic, suggestProjectCallouts, updateProject,
} from "../lib/projects.mjs";
import { deleteTemplate, listTemplates } from "../lib/templates.mjs";
import { BRAND_DIR, getBrand, saveBrand, setBrandLogo } from "../lib/brand.mjs";
import { aiInfo, exportDirInfo, setAiConfig, setExportDir } from "../lib/settings.mjs";
import { addCustomSfx, listSfx, SFX_DIR } from "../lib/sfx.mjs";
import { checkUserFile, displayName, emailOf, isAdmin, prefixOf, receiveUpload, WEB_MODE } from "../lib/web.mjs";

const argPort = process.argv.indexOf("--port");
const PORT = argPort > 0 ? Number(process.argv[argPort + 1]) : Number(process.env.PORT || 0);
fs.mkdirSync(PROJECTS_DIR, { recursive: true });

const app = express();
app.use(express.json({ limit: "20mb" }));
// Remotion (render + Player) tải media bằng fetch khác origin -> cần CORS
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges");
  next();
});

// ---- người dùng (chế độ web: email từ Cloudflare Access) ----
app.use((req, res, next) => {
  if (!/^\/(api|media|sfx|brand)\//.test(req.path)) return next();
  const email = emailOf(req);
  if (!email) return res.status(401).json({ error: "Chưa đăng nhập" });
  req.user = { email, prefix: prefixOf(email), admin: isAdmin(email) };
  next();
});
const own = (req, name) => !WEB_MODE || String(name).startsWith(req.user.prefix);
const onlyAdmin = (req) => {
  if (!req.user.admin) throw new Error("Chỉ quản trị viên được đổi cài đặt này");
};
const notOnWeb = () => {
  if (WEB_MODE) throw new Error("Chức năng này chỉ có trên app máy tính");
};
// dự án người khác = coi như không có
app.param("name", (req, res, next, name) => (own(req, name) ? next() : res.status(404).json({ error: "Không thấy dự án" })));

const noCache = { etag: false, lastModified: true, cacheControl: false, dotfiles: "deny" };
app.use("/media", (req, res, next) => {
  const first = decodeURIComponent(req.path.split("/")[1] || "");
  return own(req, first) ? next() : res.status(404).end();
});
app.use("/media", express.static(PROJECTS_DIR, noCache));
app.use("/sfx", express.static(SFX_DIR, noCache));
app.use("/brand", express.static(BRAND_DIR, noCache));

let base = "";
const wrap = (fn) => async (req, res) => {
  try {
    const out = await fn(req, res);
    if (!res.headersSent) res.json(out ?? { ok: true });
  } catch (e) {
    res.status(400).json({ error: String(e?.message || e) });
  }
};
const need = (name) => {
  const p = getProject(name);
  if (!p) throw new Error("Không thấy dự án: " + name);
  return p;
};

app.get(
  "/api/me",
  wrap((req) => ({ email: req.user.email, admin: req.user.admin, web: WEB_MODE, prefix: req.user.prefix }))
);
app.post(
  "/api/upload",
  wrap(async (req) => receiveUpload(req, req.user.email))
);
app.get("/api/projects", wrap((req) => listProjects().filter((p) => own(req, p.name))));
app.post(
  "/api/projects",
  wrap((req) => {
    const body = { ...req.body };
    if (WEB_MODE) {
      body.name = req.user.prefix + displayName(String(body.name || "")).trim();
      body.clips = (body.clips || []).map((c) => checkUserFile(req.user.email, c));
    }
    return { name: createProject(body) };
  })
);
app.get("/api/projects/:name", wrap((req) => need(req.params.name)));
app.put("/api/projects/:name", wrap((req) => (updateProject(req.params.name, req.body), need(req.params.name))));
app.delete("/api/projects/:name", wrap((req) => deleteProject(req.params.name)));
app.get("/api/projects/:name/props", wrap((req) => (need(req.params.name), compositionProps(req.params.name, base))));
app.post("/api/projects/:name/reprocess", wrap((req) => (need(req.params.name), processProject(req.params.name))));
app.post(
  "/api/projects/:name/music",
  wrap((req) => (setMusic(req.params.name, checkUserFile(req.user.email, req.body.path)), need(req.params.name)))
);
app.delete("/api/projects/:name/music", wrap((req) => (setMusic(req.params.name, null), need(req.params.name))));
app.post("/api/projects/:name/refix", wrap((req) => (reapplyFixes(req.params.name), need(req.params.name))));
app.post(
  "/api/projects/:name/render",
  wrap((req) =>
    renderProject(req.params.name, base, WEB_MODE ? path.join(projectDir(req.params.name), "exports") : null)
  )
);
app.post("/api/projects/:name/capcut", wrap((req) => (notOnWeb(), capcutProject(req.params.name))));
// tải bản MP4 đã xuất về máy người dùng
app.get("/api/projects/:name/download", (req, res) => {
  const p = getProject(req.params.name);
  if (!p?.lastRender || !fs.existsSync(p.lastRender)) return res.status(404).json({ error: "Chưa có bản xuất" });
  res.download(p.lastRender, `${displayName(p.name)}.mp4`);
});
app.post(
  "/api/projects/:name/open",
  wrap((req) => {
    notOnWeb();
    const p = need(req.params.name);
    const target = req.body?.what === "render" && p.lastRender ? p.lastRender : projectDir(p.name);
    const args = fs.existsSync(target) && fs.statSync(target).isFile() ? [`/select,${target}`] : [target];
    spawn("explorer.exe", args, { detached: true, stdio: "ignore" }).unref();
  })
);

app.post(
  "/api/projects/:name/overlays",
  wrap(
    async (req) => (
      await addOverlay(req.params.name, checkUserFile(req.user.email, req.body.path), req.body.at, req.body.sec),
      need(req.params.name)
    )
  )
);
app.post(
  "/api/projects/:name/template",
  wrap((req) => (applyTemplate(req.params.name, req.body.template), need(req.params.name)))
);
app.post(
  "/api/projects/:name/callouts/suggest",
  wrap(async (req) => ({ callouts: await suggestProjectCallouts(req.params.name) }))
);
app.get("/api/ai", wrap(() => aiInfo()));
app.put("/api/ai", wrap((req) => (onlyAdmin(req), setAiConfig(req.body || {}))));
app.get("/api/export-dir", wrap(() => exportDirInfo()));
app.put("/api/export-dir", wrap((req) => (notOnWeb(), setExportDir(req.body.dir || ""))));
app.get("/api/brand", wrap(() => getBrand()));
app.put("/api/brand", wrap((req) => (onlyAdmin(req), saveBrand(req.body))));
app.post(
  "/api/brand/logo",
  wrap((req) => (onlyAdmin(req), setBrandLogo(req.body.path ? checkUserFile(req.user.email, req.body.path) : "")))
);
app.get("/api/templates", wrap(() => listTemplates()));
app.post(
  "/api/templates",
  wrap((req) => {
    if (!own(req, req.body.fromProject)) throw new Error("Không thấy dự án");
    return saveAsTemplate(req.body.fromProject, req.body.name), listTemplates();
  })
);
app.delete("/api/templates/:tpl", wrap((req) => (onlyAdmin(req), deleteTemplate(req.params.tpl), listTemplates())));

app.get("/api/jobs", wrap((req) => listJobs().filter((j) => own(req, j.name))));
app.get("/api/sfx", wrap(() => listSfx()));
app.post(
  "/api/sfx",
  wrap((req) => ({ id: addCustomSfx(checkUserFile(req.user.email, req.body.path)), list: listSfx() }))
);

app.get(
  "/api/settings",
  wrap(() => ({
    vocab: fs.existsSync(VOCAB_FILE) ? fs.readFileSync(VOCAB_FILE, "utf-8") : "",
    fixes: fs.existsSync(FIX_FILE) ? fs.readFileSync(FIX_FILE, "utf-8") : "",
  }))
);
app.put(
  "/api/settings",
  wrap((req) => {
    onlyAdmin(req);
    if (typeof req.body.vocab === "string") fs.writeFileSync(VOCAB_FILE, req.body.vocab, "utf-8");
    if (typeof req.body.fixes === "string") fs.writeFileSync(FIX_FILE, req.body.fixes, "utf-8");
  })
);

const UI_DIR = path.join(ROOT, "ui", "dist");
app.use(express.static(UI_DIR));
app.get(/^\/(?!api|media|sfx|brand).*/, (req, res) => {
  const index = path.join(UI_DIR, "index.html");
  if (fs.existsSync(index)) res.sendFile(index);
  else res.status(404).send("Chưa build giao diện: chạy npm run build:ui");
});

const server = app.listen(PORT, "127.0.0.1", () => {
  const { port } = server.address();
  base = `http://127.0.0.1:${port}`;
  console.log(`@@PORT ${port}`);
  console.log(`BĐS Video Studio: ${base}`);
});
