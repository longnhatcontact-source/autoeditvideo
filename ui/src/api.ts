import type { Caption } from "@remotion/captions";

export type Info = { tenDuAn: string; gia: string; dienTich: string; phongNgu: string; diaChi: string };
export type Sfx = { id: string; at: number; volume: number };
export type Blur = { x: number; y: number; w: number; h: number };
export type OverlayItem = {
  file: string;
  original: string;
  kind: "image" | "video";
  at: number;
  sec: number;
  w: number;
  h: number;
};
export type Hook = { text: string; sec: number; style: CalloutStyle; x: number; y: number; scale: number };
export type CalloutStyle =
  | "city"
  | "bigyellow"
  | "redbold"
  | "sea"
  | "marble"
  | "luxgold"
  | "neonsea"
  | "orangegold"
  | "red" | "neon" | "gold" | "type" | "banner" | "pop" | "outline" | "editorial" | "stamp";
export type Callout = {
  at: number;
  sec: number;
  style: CalloutStyle;
  top: string;
  main: string;
  sub: string;
  x: number;
  y: number;
  scale: number;
};
export type AiInfo = { hasKey: boolean; fromEnv: boolean; keyHint: string; model: string };
export type SubStyle = { highlight: string; position: "thap" | "cao"; box: boolean };
export type BrandPosition = "duoi-video" | "tren-phai" | "tren-trai";
export type Brand = { enabled: boolean; text: string; logo: string; position: BrandPosition };
export type Music = { file: string; original: string; volume: number; duck: boolean };
export type Job = {
  name: string;
  kind: "process" | "render" | "capcut";
  progress: number;
  message: string;
  status: "queued" | "running" | "done" | "error";
  error: string | null;
  result: { path?: string; draftName?: string; draftDir?: string; pages?: number; durationSec?: number } | null;
};
export type ProjectSummary = {
  name: string;
  status: "processing" | "ready" | "error";
  durationSec: number;
  tenDuAn: string;
  error: string | null;
};
export type Project = ProjectSummary & {
  clips: string[];
  durationInFrames: number;
  info: Info;
  music: Music | null;
  sfx: Sfx[];
  captions: Caption[];
  keepTogether: string[];
  blurs: Blur[];
  hook: Hook;
  hideBrand: boolean;
  brand: Brand & { show: boolean };
  subStyle: SubStyle;
  punchZoom: boolean;
  calloutSfx: number;
  overlays: OverlayItem[];
  callouts: Callout[];
  versions: { video: number; music: number };
  jobs: Job[];
  lastRender: string | null;
  lastCapcut: string | null;
};
export type SfxItem = { id: string; label: string; group: string };
export type Template = { name: string; tenDuAn: string; gia: string; music: string | null; blurs: number; hook: string };

async function call<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Lỗi ${res.status}`);
  return data as T;
}

const P = (name: string) => `/api/projects/${encodeURIComponent(name)}`;

export const api = {
  projects: () => call<ProjectSummary[]>("GET", "/api/projects"),
  project: (name: string) => call<Project>("GET", P(name)),
  exportDir: () => call<{ exportDir: string; isDefault: boolean }>("GET", "/api/export-dir"),
  setExportDir: (dir: string) => call<{ exportDir: string; isDefault: boolean }>("PUT", "/api/export-dir", { dir }),
  brand: () => call<Brand>("GET", "/api/brand"),
  saveBrand: (b: Partial<Brand>) => call<Brand>("PUT", "/api/brand", b),
  setBrandLogo: (path: string) => call<Brand>("POST", "/api/brand/logo", { path }),
  templates: () => call<Template[]>("GET", "/api/templates"),
  saveTemplate: (name: string, fromProject: string) => call<Template[]>("POST", "/api/templates", { name, fromProject }),
  deleteTemplate: (name: string) => call<Template[]>("DELETE", `/api/templates/${encodeURIComponent(name)}`),
  applyTemplate: (project: string, template: string) =>
    call<Project>("POST", `${P(project)}/template`, { template }),
  create: (body: { name: string; clips: string[]; model: string; removeSilence: boolean; template: string }) =>
    call<{ name: string }>("POST", "/api/projects", body),
  update: (
    name: string,
    body: Partial<{
      info: Info;
      captions: Caption[];
      sfx: Sfx[];
      music: Partial<Music>;
      blurs: Blur[];
      hook: Hook;
      hideBrand: boolean;
      subStyle: SubStyle;
      punchZoom: boolean;
      calloutSfx: number;
      overlays: OverlayItem[];
      callouts: Callout[];
    }>,
  ) =>
    call<Project>("PUT", P(name), body),
  remove: (name: string) => call("DELETE", P(name)),
  reprocess: (name: string) => call<Job>("POST", `${P(name)}/reprocess`),
  addOverlay: (name: string, path: string, at: number, sec: number) =>
    call<Project>("POST", `${P(name)}/overlays`, { path, at, sec }),
  setMusic: (name: string, path: string) => call<Project>("POST", `${P(name)}/music`, { path }),
  removeMusic: (name: string) => call<Project>("DELETE", `${P(name)}/music`),
  refix: (name: string) => call<Project>("POST", `${P(name)}/refix`),
  render: (name: string) => call<Job>("POST", `${P(name)}/render`),
  capcut: (name: string) => call<Job>("POST", `${P(name)}/capcut`),
  open: (name: string, what: "render" | "project") => call("POST", `${P(name)}/open`, { what }),
  suggestCallouts: (name: string) => call<{ callouts: Callout[] }>("POST", `${P(name)}/callouts/suggest`),
  ai: () => call<AiInfo>("GET", "/api/ai"),
  saveAi: (body: { key?: string; model?: string }) => call<AiInfo>("PUT", "/api/ai", body),
  jobs: () => call<Job[]>("GET", "/api/jobs"),
  sfx: () => call<SfxItem[]>("GET", "/api/sfx"),
  addSfx: (path: string) => call<{ id: string; list: SfxItem[] }>("POST", "/api/sfx", { path }),
  settings: () => call<{ vocab: string; fixes: string }>("GET", "/api/settings"),
  saveSettings: (body: { vocab?: string; fixes?: string }) => call("PUT", "/api/settings", body),
};

export const mediaUrl = (project: string, file: string, v: number) =>
  `/media/${encodeURIComponent(project)}/${encodeURIComponent(file)}?v=${v}`;
export const overlayUrl = (project: string, file: string) =>
  `/media/${encodeURIComponent(project)}/overlays/${encodeURIComponent(file)}`;
export const brandUrl = (file: string) => `/brand/${encodeURIComponent(file)}`;
export const sfxUrl = (id: string) => `/sfx/${id.split("/").map(encodeURIComponent).join("/")}`;

// Cửa sổ Electron có hộp chọn file thật; mở bằng trình duyệt thì nhập đường dẫn
type PickKind = "video" | "audio" | "image" | "media";
type Bridge = {
  pickFiles: (opts: { multi: boolean; kind: PickKind }) => Promise<string[]>;
  pickFolder: (opts: { defaultPath: string }) => Promise<string>;
};

export async function pickFolder(defaultPath: string): Promise<string> {
  if (bridge) return bridge.pickFolder({ defaultPath });
  return (window.prompt("Dán đường dẫn thư mục lưu video", defaultPath) || "").trim().replace(/^"|"$/g, "");
}
const bridge = (window as unknown as { bds?: Bridge }).bds;

export async function pickFiles(kind: PickKind, multi: boolean): Promise<string[]> {
  if (bridge) return bridge.pickFiles({ multi, kind });
  const s = window.prompt(
    multi ? "Dán đường dẫn file (mỗi file 1 dòng hoặc cách nhau bằng dấu |)" : "Dán đường dẫn file",
  );
  if (!s) return [];
  return s
    .split(/[\n|]/)
    .map((x) => x.trim().replace(/^"|"$/g, ""))
    .filter(Boolean);
}

export const fmtTime = (sec: number) => {
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
};
