import type { Caption } from "@remotion/captions";
import { Player, type PlayerRef } from "@remotion/player";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CaptionedVideo } from "../../src/CaptionedVideo";
import {
  api,
  brandUrl,
  fmtTime,
  mediaUrl,
  sfxUrl,
  type Blur,
  type Callout,
  type Hook,
  overlayUrl,
  pickFolder,
  type Info,
  type Job,
  type Music,
  type OverlayItem,
  type Project,
  type Sfx,
  type SubStyle,
  type Template,
} from "./api";
import { BlurEditor } from "./BlurEditor";
import { CalloutMover } from "./CalloutMover";
import { CalloutsTab, OLD_STYLE_OPTIONS, STYLE_OPTIONS } from "./CalloutsTab";
import { CaptionsTab } from "./CaptionsTab";
import { OverlayTab } from "./OverlayTab";
import { SoundTab } from "./SoundTab";
import { CoverTab } from "./CoverTab";
import { Timeline } from "./Timeline";

const FPS = 30;
type Tab = "info" | "captions" | "callouts" | "sound" | "overlay" | "cover";

const INFO_FIELDS: [keyof Info, string, string][] = [
  ["tenDuAn", "Tên dự án (băng trên cùng)", "Le Parc Place - Park City Hà Đông"],
  ["gia", "Giá (thẻ giá)", "98 triệu/m²"],
  ["dienTich", "Diện tích", "68m²"],
  ["phongNgu", "Phòng ngủ", "2PN"],
  ["diaChi", "Địa chỉ", "Hà Đông, Hà Nội"],
];

export function ProjectView({
  name,
  jobs,
  onChanged,
  onDeleted,
}: {
  name: string;
  jobs: Job[];
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const [project, setProject] = useState<Project | null>(null);
  const [info, setInfo] = useState<Info | null>(null);
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [sfx, setSfx] = useState<Sfx[]>([]);
  const [music, setMusic] = useState<Music | null>(null);
  const [blurs, setBlurs] = useState<Blur[]>([]);
  const [hook, setHook] = useState<Hook>({ text: "", sec: 2.5, style: "gold", x: 0.5, y: 0.3, scale: 1 });
  // đang dời khối chữ nào trên khung xem trước: "hook" = tiêu đề, số = chữ nhấn thứ i
  const [moving, setMoving] = useState<"hook" | number | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [hideBrand, setHideBrand] = useState(false);
  const [punchZoom, setPunchZoom] = useState(false);
  const [calloutSfx, setCalloutSfx] = useState(0.8);
  const [overlays, setOverlays] = useState<OverlayItem[]>([]);
  const [callouts, setCallouts] = useState<Callout[]>([]);
  const [subStyle, setSubStyle] = useState<SubStyle>({ highlight: "#39E508", position: "thap", box: false });
  const showBrand = Boolean(project?.brand.enabled && !hideBrand && (project.brand.text || project.brand.logo));
  const [tab, setTab] = useState<Tab>("info");
  const [error, setError] = useState("");
  const [frame, setFrame] = useState(0);
  const playerRef = useRef<PlayerRef>(null);

  const load = useCallback(async () => {
    const p = await api.project(name);
    setProject(p);
    setInfo(p.info);
    setCaptions(p.captions);
    setSfx(p.sfx);
    setMusic(p.music);
    setBlurs(p.blurs);
    setHook(p.hook);
    setHideBrand(p.hideBrand);
    setSubStyle(p.subStyle);
    setPunchZoom(p.punchZoom);
    setCalloutSfx(p.calloutSfx ?? 0.8);
    setOverlays(p.overlays);
    setCallouts(p.callouts ?? []);
  }, [name]);

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);

  // nhãn SFX cho dòng thời gian
  const [sfxNames, setSfxNames] = useState<Record<string, string>>({});
  useEffect(() => {
    api
      .sfx()
      .then((l) => setSfxNames(Object.fromEntries(l.map((x) => [x.id, x.label]))))
      .catch(() => {});
  }, []);

  // cắt đoạn / làm ảnh bìa xong -> tải lại dự án (video, mốc thời gian, ảnh bìa đã đổi)
  const cutJob = jobs.find((j) => j.kind === "cut");
  const autoJob = jobs.find((j) => j.kind === "auto");
  const autoStatus = autoJob?.status;
  useEffect(() => {
    if (autoStatus === "done") load().catch(() => {});
  }, [autoStatus, load]);
  const coverJob = jobs.find((j) => j.kind === "cover");
  const cutStatus = cutJob?.status;
  const coverStatus = coverJob?.status;
  useEffect(() => {
    if (cutStatus === "done" || coverStatus === "done") load().catch(() => {});
  }, [cutStatus, coverStatus, load]);

  // Xử lý xong / lỗi -> tải lại dữ liệu dự án
  const processJob = jobs.find((j) => j.kind === "process");
  const processStatus = processJob?.status;
  useEffect(() => {
    if (processStatus === "done" || processStatus === "error") load();
  }, [processStatus, load]);

  // ---- tự lưu (0.6s sau lần sửa cuối) ----
  const pending = useRef<Parameters<typeof api.update>[1]>({});
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [saveState, setSaveState] = useState<"" | "saving" | "saved">("");

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    const body = pending.current;
    pending.current = {};
    if (!Object.keys(body).length) return;
    setSaveState("saving");
    try {
      const p = await api.update(name, body);
      setProject(p);
      if ((body.info || body.hook) && !body.sfx) setSfx(p.sfx); // SFX tự chèn theo thông tin/tiêu đề
      setSaveState("saved");
      onChanged();
    } catch (e) {
      setError((e as Error).message);
      setSaveState("");
    }
  }, [name, onChanged]);

  const queueSave = useCallback(
    (patch: Parameters<typeof api.update>[1]) => {
      pending.current = { ...pending.current, ...patch };
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, 600);
    },
    [flush],
  );

  useEffect(() => () => void flush(), [flush]);

  // ---- hoàn tác / làm lại ----
  type Snap = {
    info: Info;
    captions: Caption[];
    sfx: Sfx[];
    blurs: Blur[];
    hook: Hook;
    subStyle: SubStyle;
    overlays: OverlayItem[];
    callouts: Callout[];
  };
  const current = useRef<Snap | null>(null);
  current.current = info ? { info, captions, sfx, blurs, hook, subStyle, overlays, callouts } : null;
  const history = useRef<{ past: Snap[]; future: Snap[]; lastKey: string; lastAt: number }>({
    past: [],
    future: [],
    lastKey: "",
    lastAt: 0,
  });
  const [, bump] = useState(0);

  // gọi TRƯỚC mỗi lần sửa; gõ liên tục cùng 1 ô (trong 1.5s) chỉ tính 1 bước
  const remember = (key: string) => {
    const h = history.current;
    const now = Date.now();
    if (!current.current || (key === h.lastKey && now - h.lastAt < 1500)) {
      h.lastAt = now;
      return;
    }
    h.past.push(current.current);
    if (h.past.length > 100) h.past.shift();
    h.future = [];
    h.lastKey = key;
    h.lastAt = now;
    bump((n) => n + 1);
  };

  const applySnap = (s: Snap) => {
    const cur = current.current!;
    const patch: Parameters<typeof api.update>[1] = {};
    const differs = (k: keyof Snap) => JSON.stringify(s[k]) !== JSON.stringify(cur[k]);
    if (differs("info")) (setInfo(s.info), (patch.info = s.info));
    if (differs("captions")) (setCaptions(s.captions), (patch.captions = s.captions));
    if (differs("sfx")) (setSfx(s.sfx), (patch.sfx = s.sfx));
    if (differs("blurs")) (setBlurs(s.blurs), (patch.blurs = s.blurs));
    if (differs("hook")) (setHook(s.hook), (patch.hook = s.hook));
    if (differs("subStyle")) (setSubStyle(s.subStyle), (patch.subStyle = s.subStyle));
    if (differs("overlays")) (setOverlays(s.overlays), (patch.overlays = s.overlays));
    if (differs("callouts")) (setCallouts(s.callouts), (patch.callouts = s.callouts));
    queueSave(patch);
  };

  const undo = () => {
    const h = history.current;
    const prev = h.past.pop();
    if (!prev || !current.current) return;
    h.future.push(current.current);
    h.lastKey = "";
    applySnap(prev);
    bump((n) => n + 1);
  };
  const redo = () => {
    const h = history.current;
    const next = h.future.pop();
    if (!next || !current.current) return;
    h.past.push(current.current);
    h.lastKey = "";
    applySnap(next);
    bump((n) => n + 1);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      // trong ô chữ thì để Ctrl+Z mặc định của ô chữ
      const tag = (document.activeElement?.tagName ?? "").toUpperCase();
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) (e.preventDefault(), undo());
      else if (k === "y" || (k === "z" && e.shiftKey)) (e.preventDefault(), redo());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const changeInfo = (k: keyof Info, v: string) => {
    remember(`info.${k}`);
    const next = { ...info!, [k]: v };
    setInfo(next);
    queueSave({ info: next });
  };
  const changeCaptions = (c: Caption[]) => {
    remember(`captions.${Date.now()}`);
    setCaptions(c);
    queueSave({ captions: c });
  };
  // không sắp xếp lại ở đây: đang gõ số giây mà dòng nhảy chỗ rất khó chịu
  const changeSfx = (s: Sfx[], key = `sfx.${Date.now()}`) => {
    remember(key);
    setSfx(s);
    queueSave({ sfx: s });
  };
  const changeBlurs = (b: Blur[]) => {
    remember(`blurs.${Date.now()}`);
    setBlurs(b);
    queueSave({ blurs: b });
  };
  const changeHook = (h: Partial<Hook>) => {
    remember(`hook.${Object.keys(h).join()}`);
    const next = { ...hook, ...h };
    setHook(next);
    queueSave({ hook: next });
  };
  const changeOverlays = (o: OverlayItem[], key = `ov.${Date.now()}`) => {
    remember(key);
    setOverlays(o);
    queueSave({ overlays: o });
  };
  const changeCallouts = (c: Callout[], key = `co.${Date.now()}`) => {
    remember(key);
    setCallouts(c);
    queueSave({ callouts: c });
  };
  const addOverlay = async (path: string, at: number, sec: number) => {
    await flush();
    remember(`ov.add.${Date.now()}`);
    const p = await api.addOverlay(name, path, at, sec);
    setOverlays(p.overlays);
  };
  const changeSubStyle = (s: Partial<SubStyle>) => {
    remember(`sub.${Date.now()}`);
    const next = { ...subStyle, ...s };
    setSubStyle(next);
    queueSave({ subStyle: next });
  };
  const changeMusic = (m: Partial<Music>) => {
    if (!music) return;
    setMusic({ ...music, ...m });
    queueSave({ music: m });
  };

  // ---- khung xem trước ----
  const inputProps = useMemo(() => {
    if (!project || !info) return null;
    return {
      src: mediaUrl(project.name, "video.mp4", project.versions.video),
      ...info,
      captions,
      musicSrc: music ? mediaUrl(project.name, music.file, project.versions.music) : "",
      musicVolume: music?.volume ?? 0.25,
      musicDuck: music?.duck ?? true,
      sfx: sfx.map((s) => ({ src: sfxUrl(s.id), at: s.at, volume: s.volume })),
      durationInFrames: project.durationInFrames,
      keepTogether: project.keepTogether,
      blurs,
      hookText: hook.text,
      hookSec: hook.sec,
      hookStyle: hook.style,
      hookX: hook.x,
      hookY: hook.y,
      hookScale: hook.scale,
      brandText: showBrand ? project.brand.text : "",
      brandLogoSrc: showBrand && project.brand.logo ? brandUrl(project.brand.logo) : "",
      brandPosition: project.brand.position,
      subHighlight: subStyle.highlight,
      subPosition: subStyle.position,
      subBox: subStyle.box,
      punchZoom,
      sfxBase: "/sfx",
      calloutSfx,
      overlays: overlays.map((o) => ({ src: overlayUrl(project.name, o.file), at: o.at, sec: o.sec, kind: o.kind })),
      callouts,
    };
  }, [project, info, captions, music, sfx, blurs, hook, showBrand, subStyle, punchZoom, calloutSfx, overlays, callouts]);

  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;
    const onFrame = (e: { detail: { frame: number } }) => setFrame(e.detail.frame);
    p.addEventListener("frameupdate", onFrame);
    return () => p.removeEventListener("frameupdate", onFrame);
  }, [inputProps !== null]);

  const seek = (sec: number) => {
    playerRef.current?.seekTo(Math.round(sec * FPS));
  };

  // bật chế độ dời chữ: dừng video ở lúc chữ đã hiện rõ
  const startMove = (target: "hook" | number) => {
    setDrawing(false);
    playerRef.current?.pause();
    if (target === "hook") seek(Math.min(1.2, Math.max(0.3, hook.sec - 0.4)));
    else if (callouts[target]) seek(callouts[target].at + Math.min(1.3, callouts[target].sec - 0.4));
    setMoving(target);
  };
  const movingItem =
    moving === "hook" ? hook : typeof moving === "number" && callouts[moving] ? callouts[moving] : null;
  const moveTo = (patch: Partial<{ x: number; y: number; scale: number }>) => {
    if (moving === "hook") changeHook(patch);
    else if (typeof moving === "number")
      changeCallouts(
        callouts.map((c, k) => (k === moving ? { ...c, ...patch } : c)),
        `co.${moving}.pos`,
      );
  };

  // ---- xuất ----
  const renderJob = jobs.find((j) => j.kind === "render");
  const capcutJob = jobs.find((j) => j.kind === "capcut");
  const running = (j?: Job) => j?.status === "running" || j?.status === "queued";

  const run = async (fn: () => Promise<unknown>) => {
    setError("");
    try {
      await flush();
      await fn();
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (!project || !info) {
    return <div className="page">{error ? <div className="alert error">{error}</div> : "Đang tải..."}</div>;
  }

  const header = (
    <header className="phead">
      <div>
        <h1>{project.name}</h1>
        <small className="muted">
          {project.status === "ready" ? `${fmtTime(project.durationSec)} · ${project.clips.length} clip` : null}
          {saveState === "saving" ? " · Đang lưu…" : saveState === "saved" ? " · Đã lưu" : ""}
        </small>
      </div>
      <div className="actions">
        {project.status === "ready" ? (
          <>
            <button className="btn ghost" disabled={!history.current.past.length} onClick={undo} title="Hoàn tác (Ctrl+Z)">
              ↶
            </button>
            <button className="btn ghost" disabled={!history.current.future.length} onClick={redo} title="Làm lại (Ctrl+Y)">
              ↷
            </button>
          </>
        ) : null}
        <button className="btn ghost" onClick={() => api.open(project.name, "project")}>
          📁 Thư mục
        </button>
        <button
          className="btn ghost danger"
          disabled={running(processJob) || running(renderJob) || running(capcutJob)}
          onClick={() => {
            if (window.confirm(`Xoá video "${project.name}"? File trong thư mục dự án sẽ bị xoá (clip gốc không bị đụng tới).`))
              run(async () => {
                await api.remove(project.name);
                onDeleted();
              });
          }}
        >
          Xoá
        </button>
      </div>
    </header>
  );

  if (project.status !== "ready") {
    return (
      <div className="page">
        {header}
        {project.status === "processing" || running(processJob) ? (
          <div className="card">
            <h3>Đang xử lý video…</h3>
            <Progress job={processJob} />
          </div>
        ) : (
          <div className="card">
            <div className="alert error">Xử lý lỗi: {project.error || processJob?.error}</div>
            <button className="btn primary" onClick={() => run(() => api.reprocess(project.name))}>
              Thử lại
            </button>
          </div>
        )}
        {error ? <div className="alert error">{error}</div> : null}
      </div>
    );
  }

  return (
    <div className="page">
      {header}
      {error ? (
        <div className="alert error" onClick={() => setError("")}>
          {error}
        </div>
      ) : null}
      <AutoBanner
        project={project}
        job={autoJob}
        renderJob={renderJob}
        onRedo={() => {
          if (!window.confirm("Tự dựng lại sẽ thay tiêu đề, chữ nổi bật, ảnh bìa hiện tại bằng bản mới. Tiếp tục?")) return;
          run(() => api.reAutoEdit(project.name));
        }}
      />
      <div className="workspace">
        <div className="preview">
          {inputProps ? (
            <div className="playerwrap">
              <Player
                ref={playerRef}
                component={CaptionedVideo}
                inputProps={inputProps}
                durationInFrames={project.durationInFrames}
                fps={FPS}
                compositionWidth={1080}
                compositionHeight={1920}
                style={{ width: "100%", aspectRatio: "9 / 16", borderRadius: 12, overflow: "hidden" }}
                controls={!drawing && movingItem === null}
                acknowledgeRemotionLicense
              />
              {drawing ? <BlurEditor boxes={blurs} onChange={changeBlurs} /> : null}
              {!drawing && movingItem ? (
                <CalloutMover item={movingItem} onChange={moveTo} onDone={() => setMoving(null)} />
              ) : null}
            </div>
          ) : null}
          <div className="row between blurbar">
            <button
              className={`btn small ${drawing ? "primary" : "ghost"}`}
              onClick={() => {
                if (!drawing) playerRef.current?.pause();
                setMoving(null);
                setDrawing(!drawing);
              }}
            >
              {drawing ? "✓ Xong che vùng" : "🔲 Che vùng (SĐT, chữ dính sẵn)"}
            </button>
            {blurs.length ? (
              <span className="muted small">
                Đang che {blurs.length} vùng{" "}
                <button className="link" onClick={() => changeBlurs([])}>
                  bỏ hết
                </button>
              </span>
            ) : null}
          </div>
          <div className="exports">
            <button
              className="btn"
              disabled={running(renderJob)}
              onClick={() => run(() => api.render(project.name, true))}
              title="720p, nhẹ ~10MB — gửi duyệt nhanh"
            >
              ⬇ Bản nhẹ
            </button>
            <button
              className="btn primary"
              disabled={running(renderJob)}
              onClick={() => run(() => api.render(project.name))}
              title="1080p — để đăng"
            >
              ⬇ Bản nét
            </button>
            <button
              className="btn"
              disabled={running(capcutJob)}
              onClick={() => {
                if (
                  project.lastCapcut &&
                  !window.confirm(
                    `Đã có draft BDS_${project.name} trong CapCut. Xuất lại sẽ GHI ĐÈ mọi chỉnh sửa bạn đã làm trên draft đó. Tiếp tục?`,
                  )
                )
                  return;
                run(() => api.capcut(project.name));
              }}
            >
              ✂ Xuất sang CapCut
            </button>
          </div>
          <ExportDirLine />
          <ExportStatus job={renderJob} kind="render" onOpen={() => api.open(project.name, "render")} />
          <ExportStatus job={capcutJob} kind="capcut" />
        </div>

        <div className="panel">
          <nav className="tabs">
            <button className={tab === "info" ? "on" : ""} onClick={() => setTab("info")}>
              Thông tin
            </button>
            <button className={tab === "captions" ? "on" : ""} onClick={() => setTab("captions")}>
              Phụ đề
            </button>
            <button className={tab === "callouts" ? "on" : ""} onClick={() => setTab("callouts")}>
              Chữ nhấn{callouts.length ? ` (${callouts.length})` : ""}
            </button>
            <button className={tab === "sound" ? "on" : ""} onClick={() => setTab("sound")}>
              Nhạc & SFX
            </button>
            <button className={tab === "overlay" ? "on" : ""} onClick={() => setTab("overlay")}>
              Ảnh chèn{overlays.length ? ` (${overlays.length})` : ""}
            </button>
            <button className={tab === "cover" ? "on" : ""} onClick={() => setTab("cover")}>
              Ảnh bìa
            </button>
          </nav>

          {tab === "info" ? (
            <div className="tabbody">
              <TemplateBar
                project={project.name}
                suggestName={info.tenDuAn.split(" - ")[0].trim()}
                onBeforeSave={flush}
                onApply={(template) =>
                  run(async () => {
                    await flush();
                    await api.applyTemplate(project.name, template);
                    await load();
                  })
                }
              />
              <HookEditor
                hook={hook}
                info={info}
                onChange={changeHook}
                onPreview={() => seek(0)}
                moving={moving === "hook"}
                onMove={() => (moving === "hook" ? setMoving(null) : startMove("hook"))}
              />
              {INFO_FIELDS.map(([k, label, ph]) => (
                <label key={k} className="field">
                  <span>{label}</span>
                  <input value={info[k]} placeholder={ph} onChange={(e) => changeInfo(k, e.target.value)} />
                </label>
              ))}
              <label className="check" style={{ marginBottom: 10 }}>
                <input
                  type="checkbox"
                  checked={punchZoom}
                  onChange={(e) => {
                    setPunchZoom(e.target.checked);
                    queueSave({ punchZoom: e.target.checked });
                  }}
                />
                Zoom nhẹ ở chỗ nhấn mạnh (câu có số liệu, đầu ý mới) — video đỡ tĩnh
              </label>
              {project.brand.enabled ? (
                <label className="check" style={{ marginBottom: 10 }}>
                  <input
                    type="checkbox"
                    checked={!hideBrand}
                    onChange={(e) => {
                      setHideBrand(!e.target.checked);
                      queueSave({ hideBrand: !e.target.checked });
                    }}
                  />
                  Hiện tên kênh / logo ({project.brand.text || "logo"}) — sửa trong ⚙ Cài đặt
                </label>
              ) : null}
              <p className="muted small">
                Ô nào để trống thì không hiện trên video. Không có ô số điện thoại (tránh bị TikTok hạn chế).
              </p>
            </div>
          ) : null}

          {tab === "captions" ? (
            <CaptionsTab
              captions={captions}
              subStyle={subStyle}
              onSubStyle={changeSubStyle}
              keepTogether={project.keepTogether}
              durationSec={project.durationSec}
              currentSec={frame / FPS}
              onChange={changeCaptions}
              onSeek={seek}
              onAddSfx={(at) => {
                changeSfx([...sfx, { id: "pop_real.mp3", at, volume: 0.6 }]);
                setTab("sound");
              }}
              onRefix={() =>
                run(async () => {
                  if (!window.confirm("Áp dụng lại bảng sửa từ? Những chữ bạn tự sửa tay trong video này sẽ bị thay bằng bản gốc.")) return;
                  const p = await api.refix(project.name);
                  setCaptions(p.captions);
                })
              }
            />
          ) : null}

          {tab === "callouts" ? (
            <>
            <label className="check" style={{ marginBottom: 10, gap: 10 }}>
              🔊 Tiếng đi kèm chữ (gõ phím, vút, pop, con dấu…)
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={calloutSfx}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setCalloutSfx(v);
                  queueSave({ calloutSfx: v });
                }}
              />
              <span>{calloutSfx ? `${Math.round(calloutSfx * 100)}%` : "Tắt"}</span>
            </label>
            <CalloutsTab
              project={project.name}
              items={callouts}
              currentSec={frame / FPS}
              durationSec={project.durationSec}
              onChange={changeCallouts}
              onSeek={seek}
              onBeforeSuggest={flush}
              moving={typeof moving === "number" ? moving : null}
              onMove={(i) => (moving === i ? setMoving(null) : startMove(i))}
            />
            </>
          ) : null}

          {tab === "overlay" ? (
            <OverlayTab
              project={project.name}
              items={overlays}
              currentSec={frame / FPS}
              durationSec={project.durationSec}
              onAdd={addOverlay}
              onChange={changeOverlays}
              onSeek={seek}
            />
          ) : null}

          {tab === "sound" ? (
            <SoundTab
              project={project}
              music={music}
              sfx={sfx}
              currentSec={frame / FPS}
              onMusic={changeMusic}
              onPickMusic={(path) =>
                run(async () => {
                  await flush();
                  const p = await api.setMusic(project.name, path);
                  setProject(p);
                  setMusic(p.music);
                })
              }
              onRemoveMusic={() =>
                run(async () => {
                  const p = await api.removeMusic(project.name);
                  setProject(p);
                  setMusic(null);
                })
              }
              onSfx={changeSfx}
              onSeek={seek}
            />
          ) : null}

          {tab === "cover" ? (
            <CoverTab
              project={project}
              currentSec={frame / FPS}
              job={coverJob}
              onSeek={seek}
              onBeforeRun={flush}
              onChanged={onChanged}
            />
          ) : null}
        </div>
      </div>

      <Timeline
        project={project.name}
        version={project.versions.video}
        durationSec={project.durationSec}
        currentSec={frame / FPS}
        hook={hook}
        callouts={callouts}
        sfx={sfx}
        sfxLabel={(id) => sfxNames[id] ?? id}
        cutUndo={project.cutUndo ?? 0}
        busy={running(cutJob) || running(renderJob)}
        onSeek={seek}
        onCallouts={changeCallouts}
        onHook={changeHook}
        onSfx={changeSfx}
        onCut={(ranges) => {
          const sec = ranges.reduce((a, r) => a + r.to - r.from, 0);
          if (!window.confirm(`Cắt bỏ ${ranges.length} đoạn (${sec.toFixed(1)} giây)? Phụ đề, chữ nhấn, SFX sẽ tự dời theo. Có thể hoàn tác.`)) return;
          playerRef.current?.pause();
          run(() => api.cut(project.name, ranges));
        }}
        onUndoCut={() =>
          run(async () => {
            await api.undoCut(project.name);
            await load();
          })
        }
      />
      {running(cutJob) ? (
        <div className="card">
          <Progress job={cutJob} />
        </div>
      ) : cutJob?.status === "error" ? (
        <div className="alert error">Cắt lỗi: {cutJob.error}</div>
      ) : null}
    </div>
  );
}

/** Kết quả tự dựng: ghi chú + các câu cần soát số liệu + nút tự dựng lại */
function AutoBanner({ project, job, renderJob, onRedo }: { project: Project; job?: Job; renderJob?: Job; onRedo: () => void }) {
  const [open, setOpen] = useState(true);
  const running = job?.status === "running" || job?.status === "queued";
  const checks = project.checks ?? [];
  if (!project.autoEdit && !checks.length && !project.autoNote && !running) return null;
  return (
    <div className="card soft autobanner">
      <div className="row between">
        <b>
          ✨ Tự dựng{" "}
          {running ? `— ${job?.message ?? "đang chạy"}` : renderJob?.status === "running" || renderJob?.status === "queued" ? "xong — đang xuất bản nhẹ…" : "xong"}
        </b>
        <div className="row">
          {checks.length ? (
            <button className="btn small ghost" onClick={() => setOpen(!open)}>
              {open ? "Ẩn" : `Cần soát (${checks.length})`}
            </button>
          ) : null}
          <button className="btn small" disabled={running} onClick={onRedo}>
            Tự dựng lại
          </button>
        </div>
      </div>
      {project.autoNote ? <div className="small warn">{project.autoNote}</div> : null}
      {open && checks.length ? (
        <>
          <div className="small muted" style={{ marginTop: 6 }}>
            Soát lại các câu có số liệu / pháp lý trước khi đăng:
          </div>
          <ul className="checks">
            {checks.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

/** Nơi lưu video MP4 xuất ra: mặc định Downloads, đổi được */
function ExportDirLine() {
  const [dir, setDir] = useState<{ exportDir: string; isDefault: boolean } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.exportDir().then(setDir).catch(() => {});
  }, []);

  const change = async () => {
    setError("");
    const picked = await pickFolder(dir?.exportDir ?? "");
    if (!picked) return;
    try {
      setDir(await api.setExportDir(picked));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (!dir) return null;
  const short = dir.exportDir.split(/[\\/]/).filter(Boolean).slice(-2).join("\\");
  return (
    <div className="exportdir small">
      <span title={dir.exportDir}>
        💾 Lưu MP4 vào: <b>{dir.isDefault ? "Downloads" : short}</b>
      </span>
      <button className="link" onClick={change}>
        Đổi…
      </button>
      {!dir.isDefault ? (
        <button className="link" onClick={async () => setDir(await api.setExportDir(""))}>
          về Downloads
        </button>
      ) : null}
      {error ? <div className="alert error">{error}</div> : null}
    </div>
  );
}

function TemplateBar({
  project,
  suggestName,
  onBeforeSave,
  onApply,
}: {
  project: string;
  suggestName: string;
  onBeforeSave: () => Promise<void>;
  onApply: (template: string) => void;
}) {
  const [list, setList] = useState<Template[]>([]);
  const [pick, setPick] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    api.templates().then(setList).catch(() => {});
  }, []);

  const save = async () => {
    const name = window.prompt(
      "Tên mẫu (lưu thông tin dự án, tiêu đề mở đầu, vùng che, nhạc nền):",
      suggestName || project,
    );
    if (!name?.trim()) return;
    if (list.some((t) => t.name.toLowerCase() === name.trim().toLowerCase()) && !window.confirm(`Mẫu "${name}" đã có. Ghi đè?`))
      return;
    try {
      await onBeforeSave();
      setList(await api.saveTemplate(name.trim(), project));
      setPick(name.trim());
      setMsg(`Đã lưu mẫu “${name.trim()}”`);
      setTimeout(() => setMsg(""), 2500);
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  return (
    <div className="row templatebar">
      <select value={pick} onChange={(e) => setPick(e.target.value)}>
        <option value="">— Chọn mẫu —</option>
        {list.map((t) => (
          <option key={t.name} value={t.name}>
            {t.name}
          </option>
        ))}
      </select>
      <button
        className="btn small"
        disabled={!pick}
        onClick={() => {
          if (window.confirm(`Áp mẫu “${pick}”? Thông tin, tiêu đề mở đầu, vùng che và nhạc nền hiện tại sẽ bị thay.`))
            onApply(pick);
        }}
      >
        Áp dụng mẫu
      </button>
      <button className="btn ghost small" onClick={save}>
        Lưu làm mẫu
      </button>
      {pick ? (
        <button
          className="link small"
          onClick={async () => {
            if (!window.confirm(`Xoá mẫu “${pick}”? (Các video đã làm không bị ảnh hưởng)`)) return;
            setList(await api.deleteTemplate(pick));
            setPick("");
          }}
        >
          xoá mẫu
        </button>
      ) : null}
      {msg ? <span className="ok small">{msg}</span> : null}
    </div>
  );
}

function hookIdeas(info: Info) {
  const ten = info.tenDuAn.split(" - ")[0].trim();
  const t = ten ? `*${ten}*` : "dự án này";
  const ideas = [
    `View thật từ trên cao của ${t}`,
    `${ten ? t : "Dự án này"} có gì mà hot vậy?`,
    `3 điều cần biết trước khi mua ${t}`,
  ];
  if (info.gia) ideas.splice(1, 0, `Chỉ từ *${info.gia}* – có đáng mua?`);
  return ideas;
}

function HookEditor({
  hook,
  info,
  onChange,
  onPreview,
  moving,
  onMove,
}: {
  hook: Hook;
  info: Info;
  onChange: (h: Partial<Hook>) => void;
  onPreview: () => void;
  moving: boolean;
  onMove: () => void;
}) {
  return (
    <div className="card soft hookcard">
      <div className="row between">
        <b>Tiêu đề mở đầu</b>
        <button className="link" onClick={onPreview}>
          Xem từ đầu
        </button>
      </div>
      <input
        value={hook.text}
        placeholder="VD: View tầng 34 *Le Parc Place* trông thế nào?"
        onChange={(e) => onChange({ text: e.target.value })}
      />
      <div className="chips">
        {hookIdeas(info).map((s) => (
          <button key={s} className="chip" onClick={() => onChange({ text: s })}>
            {s.replace(/\*/g, "")}
          </button>
        ))}
      </div>
      <div className="row">
        <select value={hook.style} onChange={(e) => onChange({ style: e.target.value as Hook["style"] })}>
          {[...STYLE_OPTIONS, ...OLD_STYLE_OPTIONS.filter(([v]) => v === hook.style)].map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <button className={`btn small ${moving ? "primary" : "ghost"}`} onClick={onMove}>
          {moving ? "✓ Xong dời chữ" : "✥ Dời / đổi cỡ"}
        </button>
      </div>
      <label className="slider">
        <span className="small">
          Hiện {hook.sec.toFixed(1)} giây đầu · để trống = không có tiêu đề · chữ trong *…* thành chữ đậm to, phần
          trước/sau thành chữ viết tay phía trên/dưới
        </span>
        <input
          type="range"
          min={1.5}
          max={5}
          step={0.5}
          value={hook.sec}
          onChange={(e) => onChange({ sec: Number(e.target.value) })}
        />
      </label>
    </div>
  );
}

function Progress({ job }: { job?: Job }) {
  const pct = Math.round((job?.progress ?? 0) * 100);
  return (
    <div className="progress">
      <div className="bar">
        <div style={{ width: `${pct}%` }} />
      </div>
      <small>
        {job?.status === "queued" ? "Đang chờ việc khác xong…" : job?.message || "Đang bắt đầu…"} · {pct}%
      </small>
    </div>
  );
}

function ExportStatus({ job, kind, onOpen }: { job?: Job; kind: "render" | "capcut"; onOpen?: () => void }) {
  if (!job) return null;
  if (job.status === "running" || job.status === "queued") return <Progress job={job} />;
  if (job.status === "error") return <div className="alert error">Lỗi: {job.error}</div>;
  if (kind === "render") {
    return (
      <div className="alert ok">
        Đã xuất MP4.{" "}
        <button className="link" onClick={onOpen}>
          Mở thư mục
        </button>
      </div>
    );
  }
  return (
    <div className="alert ok">
      Đã tạo draft <b>{job.result?.draftName}</b> ({job.result?.pages} câu phụ đề). Mở CapCut → Dự án. Nếu CapCut đang
      mở thì tắt đi mở lại.
    </div>
  );
}
