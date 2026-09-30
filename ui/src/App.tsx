import { useCallback, useEffect, useState } from "react";
import { api, type Job, type ProjectSummary } from "./api";
import { NewProject } from "./NewProject";
import { ProjectView } from "./ProjectView";
import { Settings } from "./Settings";

type View = { kind: "project"; name: string } | { kind: "new" } | { kind: "settings" } | { kind: "empty" };

const STATUS: Record<ProjectSummary["status"], string> = {
  processing: "Đang xử lý",
  ready: "Sẵn sàng",
  error: "Lỗi",
};

export function App() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [view, setView] = useState<View>({ kind: "empty" });
  const [serverDown, setServerDown] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [p, j] = await Promise.all([api.projects(), api.jobs()]);
      setProjects(p);
      setJobs(j);
      setServerDown(false);
      return p;
    } catch {
      setServerDown(true);
      return [];
    }
  }, []);

  useEffect(() => {
    refresh().then((p) => {
      if (p.length) setView((v) => (v.kind === "empty" ? { kind: "project", name: p[0].name } : v));
      else setView({ kind: "new" });
    });
  }, [refresh]);

  const busy = jobs.some((j) => j.status === "running" || j.status === "queued");
  useEffect(() => {
    const t = setInterval(refresh, busy ? 1000 : 5000);
    return () => clearInterval(t);
  }, [busy, refresh]);

  const jobFor = (name: string) => jobs.find((j) => j.name === name && (j.status === "running" || j.status === "queued"));

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="logo">▶</span>
          <div>
            <b>BĐS Video Studio</b>
            <small>Clip thô → video TikTok</small>
          </div>
        </div>
        <button className="btn primary block" onClick={() => setView({ kind: "new" })}>
          + Video mới
        </button>
        <div className="plist">
          {projects.map((p) => {
            const j = jobFor(p.name);
            const active = view.kind === "project" && view.name === p.name;
            return (
              <button
                key={p.name}
                className={`pitem ${active ? "active" : ""}`}
                onClick={() => setView({ kind: "project", name: p.name })}
              >
                <span className="pname">{p.name}</span>
                <span className={`badge ${p.status}`}>
                  {j ? `${Math.round(j.progress * 100)}%` : STATUS[p.status]}
                </span>
                {p.tenDuAn ? <small>{p.tenDuAn}</small> : null}
              </button>
            );
          })}
          {!projects.length ? <p className="muted pad">Chưa có video nào.</p> : null}
        </div>
        <button className="btn ghost block" onClick={() => setView({ kind: "settings" })}>
          ⚙ Cài đặt
        </button>
      </aside>

      <main className="main">
        {serverDown ? (
          <div className="alert error">Mất kết nối tới phần xử lý. Đóng app và mở lại.</div>
        ) : null}
        {view.kind === "new" ? (
          <NewProject
            existing={projects.map((p) => p.name)}
            onCreated={async (name) => {
              await refresh();
              setView({ kind: "project", name });
            }}
          />
        ) : null}
        {view.kind === "settings" ? <Settings /> : null}
        {view.kind === "project" ? (
          <ProjectView
            key={view.name}
            name={view.name}
            jobs={jobs.filter((j) => j.name === view.name)}
            onChanged={refresh}
            onDeleted={async () => {
              const p = await refresh();
              setView(p.length ? { kind: "project", name: p[0].name } : { kind: "new" });
            }}
          />
        ) : null}
      </main>
    </div>
  );
}
