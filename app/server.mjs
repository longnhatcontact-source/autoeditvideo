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
  cutProject,
  projectPeaks,
  renderProjectCover,
  saveCover,
  suggestProjectCover,
  undoCut,
  reAutoEdit,
  setMediaBase,
} from "../lib/projects.mjs";
import { deleteTemplate, listTemplates } from "../lib/templates.mjs";
import { BRAND_DIR, getBrand, saveBrand, setBrandLogo } from "../lib/brand.mjs";
import { aiInfo, exportDirInfo, setAiConfig, setExportDir } from "../lib/settings.mjs";
import { addCustomSfx, listSfx, SFX_DIR } from "../lib/sfx.mjs";

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

const noCache = { etag: false, lastModified: true, cacheControl: false, dotfiles: "deny" };
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

app.get("/api/projects", wrap(() => listProjects()));
app.post("/api/projects", wrap((req) => ({ name: createProject(req.body) })));
app.get("/api/projects/:name", wrap((req) => need(req.params.name)));
app.put("/api/projects/:name", wrap((req) => (updateProject(req.params.name, req.body), need(req.params.name))));
app.delete("/api/projects/:name", wrap((req) => deleteProject(req.params.name)));
app.get("/api/projects/:name/props", wrap((req) => (need(req.params.name), compositionProps(req.params.name, base))));
app.post("/api/projects/:name/reprocess", wrap((req) => (need(req.params.name), processProject(req.params.name))));
app.post("/api/projects/:name/music", wrap((req) => (setMusic(req.params.name, req.body.path), need(req.params.name))));
app.delete("/api/projects/:name/music", wrap((req) => (setMusic(req.params.name, null), need(req.params.name))));
app.post("/api/projects/:name/refix", wrap((req) => (reapplyFixes(req.params.name), need(req.params.name))));
app.post("/api/projects/:name/render", wrap((req) => renderProject(req.params.name, base, { lite: Boolean(req.body?.lite) })));
// tự dựng lại toàn bộ chữ (Claude / quy tắc)
app.post("/api/projects/:name/autoedit", wrap((req) => reAutoEdit(req.params.name)));
// dòng thời gian
app.get("/api/projects/:name/peaks", wrap((req) => projectPeaks(req.params.name)));
app.post("/api/projects/:name/cut", wrap((req) => cutProject(req.params.name, req.body?.ranges)));
app.post("/api/projects/:name/cut/undo", wrap((req) => undoCut(req.params.name)));
// ảnh bìa
app.put("/api/projects/:name/cover", wrap((req) => (saveCover(req.params.name, req.body || {}), need(req.params.name))));
app.post("/api/projects/:name/cover/suggest", wrap((req) => suggestProjectCover(req.params.name)));
app.post("/api/projects/:name/cover/render", wrap((req) => renderProjectCover(req.params.name, base, { auto: Boolean(req.body?.auto) })));
app.post("/api/projects/:name/capcut", wrap((req) => capcutProject(req.params.name)));
app.post(
  "/api/projects/:name/open",
  wrap((req) => {
    const p = need(req.params.name);
    const target =
      req.body?.what === "render" && p.lastRender
        ? p.lastRender
        : req.body?.what === "cover" && p.lastCover
          ? p.lastCover
          : projectDir(p.name);
    const args = fs.existsSync(target) && fs.statSync(target).isFile() ? [`/select,${target}`] : [target];
    spawn("explorer.exe", args, { detached: true, stdio: "ignore" }).unref();
  })
);

app.post(
  "/api/projects/:name/overlays",
  wrap(async (req) => (await addOverlay(req.params.name, req.body.path, req.body.at, req.body.sec), need(req.params.name)))
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
app.put("/api/ai", wrap((req) => setAiConfig(req.body || {})));
app.get("/api/export-dir", wrap(() => exportDirInfo()));
app.put("/api/export-dir", wrap((req) => setExportDir(req.body.dir || "")));
app.get("/api/brand", wrap(() => getBrand()));
app.put("/api/brand", wrap((req) => saveBrand(req.body)));
app.post("/api/brand/logo", wrap((req) => setBrandLogo(req.body.path || "")));
app.get("/api/templates", wrap(() => listTemplates()));
app.post("/api/templates", wrap((req) => (saveAsTemplate(req.body.fromProject, req.body.name), listTemplates())));
app.delete("/api/templates/:name", wrap((req) => (deleteTemplate(req.params.name), listTemplates())));

app.get("/api/jobs", wrap(() => listJobs()));
app.get("/api/sfx", wrap(() => listSfx()));
app.post("/api/sfx", wrap((req) => ({ id: addCustomSfx(req.body.path), list: listSfx() })));

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
  setMediaBase(base);
  console.log(`@@PORT ${port}`);
  console.log(`BĐS Video Studio: ${base}`);
});
