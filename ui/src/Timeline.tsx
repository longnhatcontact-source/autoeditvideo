import { useEffect, useMemo, useRef, useState } from "react";
import { api, fmtTime, type Callout, type CutRange, type Hook, type Sfx } from "./api";

/**
 * Dòng thời gian kiểu CapCut:
 * - kéo khối chữ nhấn để dời, kéo mép phải để kéo dài / rút ngắn
 * - kéo chấm SFX để dời tiếng
 * - bật "Chọn đoạn cắt" rồi quét trên sóng âm để chọn đoạn nói hỏng -> Cắt
 */
const LABEL_W = 92;
const snap = (t: number) => Math.round(t * 10) / 10;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

type Drag =
  | { kind: "co-move" | "co-size"; i: number; x0: number; at0: number; sec0: number }
  | { kind: "hook-size"; x0: number; sec0: number }
  | { kind: "sfx"; i: number; x0: number; at0: number }
  | { kind: "cut"; t0: number }
  | { kind: "seek" };

export function Timeline({
  project,
  version,
  durationSec,
  currentSec,
  hook,
  callouts,
  sfx,
  sfxLabel,
  cutUndo,
  busy,
  onSeek,
  onCallouts,
  onHook,
  onSfx,
  onCut,
  onUndoCut,
}: {
  project: string;
  version: number;
  durationSec: number;
  currentSec: number;
  hook: Hook;
  callouts: Callout[];
  sfx: Sfx[];
  sfxLabel: (id: string) => string;
  cutUndo: number;
  busy: boolean;
  onSeek: (sec: number) => void;
  onCallouts: (c: Callout[], key: string) => void;
  onHook: (h: Partial<Hook>) => void;
  onSfx: (s: Sfx[], key: string) => void;
  onCut: (ranges: CutRange[]) => void;
  onUndoCut: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(800);
  const [zoom, setZoom] = useState(1);
  const [peaks, setPeaks] = useState<{ step: number; peaks: number[] } | null>(null);
  const [cutMode, setCutMode] = useState(false);
  const [ranges, setRanges] = useState<CutRange[]>([]);
  const [draft, setDraft] = useState<CutRange | null>(null);
  const [sel, setSel] = useState<number | null>(null);
  const drag = useRef<Drag | null>(null);

  // bề rộng khung -> số px mỗi giây
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const pps = Math.max(4, ((width - LABEL_W - 12) / Math.max(1, durationSec)) * zoom);
  const trackW = Math.ceil(durationSec * pps);
  const X = (t: number) => t * pps;

  // sóng âm (tải lại khi video đổi, vd sau khi cắt)
  useEffect(() => {
    let alive = true;
    setPeaks(null);
    api
      .peaks(project)
      .then((p) => alive && setPeaks(p))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [project, version]);
  useEffect(() => {
    setRanges([]);
    setDraft(null);
  }, [version]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !peaks) return;
    const h = 40;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.max(1, Math.floor(trackW * dpr));
    c.height = h * dpr;
    c.style.width = `${trackW}px`;
    const g = c.getContext("2d")!;
    g.scale(dpr, dpr);
    g.fillStyle = "rgba(243,236,221,.55)";
    const per = peaks.step * pps; // px mỗi giá trị
    const stride = Math.max(1, Math.floor(2 / per)); // gộp cho khỏi dày quá
    for (let i = 0; i < peaks.peaks.length; i += stride) {
      let v = 0;
      for (let k = i; k < i + stride && k < peaks.peaks.length; k++) v = Math.max(v, peaks.peaks[k]);
      const bh = Math.max(1, Math.min(1, v * 1.6) * (h - 4));
      g.fillRect(i * per, (h - bh) / 2, Math.max(1, per * stride - 0.5), bh);
    }
  }, [peaks, pps, trackW]);

  // ---- kéo thả ----
  const timeAt = (clientX: number) => {
    const el = wrapRef.current!.querySelector(".tl-scroll") as HTMLElement;
    const r = el.getBoundingClientRect();
    return clamp((clientX - r.left - LABEL_W + el.scrollLeft) / pps, 0, durationSec);
  };
  const start = (e: React.PointerEvent, d: Drag) => {
    e.stopPropagation();
    e.preventDefault();
    drag.current = d;
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
  };
  const move = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (d.kind === "seek") return onSeek(timeAt(e.clientX));
    if (d.kind === "cut") {
      const t = timeAt(e.clientX);
      return setDraft({ from: Math.min(d.t0, t), to: Math.max(d.t0, t) });
    }
    const dt = (e.clientX - d.x0) / pps;
    if (d.kind === "co-move") {
      const c = callouts[d.i];
      const at = snap(clamp(d.at0 + dt, 0, durationSec - c.sec));
      if (at !== c.at) onCallouts(callouts.map((x, k) => (k === d.i ? { ...x, at } : x)), `co.drag.${d.i}`);
    } else if (d.kind === "co-size") {
      const c = callouts[d.i];
      const sec = snap(clamp(d.sec0 + dt, 1.5, Math.min(8, durationSec - c.at)));
      if (sec !== c.sec) onCallouts(callouts.map((x, k) => (k === d.i ? { ...x, sec } : x)), `co.size.${d.i}`);
    } else if (d.kind === "hook-size") {
      const s = Math.round(clamp(d.sec0 + dt, 1, 6) * 2) / 2;
      if (s !== hook.sec) onHook({ sec: s });
    } else if (d.kind === "sfx") {
      const at = snap(clamp(d.at0 + dt, 0, durationSec - 0.1));
      if (at !== sfx[d.i].at) onSfx(sfx.map((x, k) => (k === d.i ? { ...x, at } : x)), `sfx.drag.${d.i}`);
    }
  };
  const up = () => {
    const d = drag.current;
    drag.current = null;
    window.removeEventListener("pointermove", move);
    if (d?.kind === "cut") {
      setDraft((cur) => {
        if (cur && cur.to - cur.from >= 0.1) setRanges((r) => [...r, { from: snap(cur.from), to: snap(cur.to) }]);
        return null;
      });
    }
  };

  const ticks = useMemo(() => {
    const stepOpts = [0.5, 1, 2, 5, 10, 15, 30, 60];
    const step = stepOpts.find((s) => s * pps >= 70) ?? 60;
    const out: number[] = [];
    for (let t = 0; t <= durationSec + 0.001; t += step) out.push(Math.round(t * 10) / 10);
    return out;
  }, [pps, durationSec]);

  const totalCut = ranges.reduce((a, r) => a + r.to - r.from, 0);
  const shown = draft ? [...ranges, draft] : ranges;

  return (
    <div className="tl" ref={wrapRef}>
      <div className="tl-tools">
        <button
          className={`btn small ${cutMode ? "primary" : "ghost"}`}
          onClick={() => setCutMode(!cutMode)}
          title="Bật rồi quét chuột trên sóng âm để chọn đoạn muốn bỏ"
        >
          ✂ {cutMode ? "Đang chọn đoạn cắt — quét trên sóng âm" : "Chọn đoạn cắt"}
        </button>
        {ranges.length ? (
          <>
            <button className="btn small danger" disabled={busy} onClick={() => onCut(ranges)}>
              Cắt {ranges.length} đoạn ({totalCut.toFixed(1)}s)
            </button>
            <button className="btn small ghost" onClick={() => setRanges([])}>
              Bỏ chọn
            </button>
          </>
        ) : null}
        {cutUndo ? (
          <button className="btn small ghost" disabled={busy} onClick={onUndoCut} title="Trả lại video trước lần cắt gần nhất">
            ↶ Hoàn tác cắt
          </button>
        ) : null}
        <span className="spacer" />
        <label className="tl-zoom small muted">
          Phóng
          <input type="range" min={1} max={8} step={0.5} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />
        </label>
      </div>

      <div className="tl-scroll">
        <div className="tl-inner" style={{ width: LABEL_W + trackW + 12 }}>
          {/* thước thời gian: bấm/kéo để tua */}
          <div className="tl-row ruler" onPointerDown={(e) => (onSeek(timeAt(e.clientX)), start(e, { kind: "seek" }))}>
            <span className="tl-lab" />
            <div className="tl-track" style={{ width: trackW }}>
              {ticks.map((t) => (
                <span key={t} className="tick" style={{ left: X(t) }}>
                  {fmtTime(t).replace(/\.0$/, "")}
                </span>
              ))}
            </div>
          </div>

          <div className="tl-row">
            <span className="tl-lab">Lời nói</span>
            <div
              className={`tl-track wave ${cutMode ? "cutting" : ""}`}
              style={{ width: trackW }}
              onPointerDown={(e) =>
                cutMode ? start(e, { kind: "cut", t0: timeAt(e.clientX) }) : (onSeek(timeAt(e.clientX)), start(e, { kind: "seek" }))
              }
            >
              <canvas ref={canvasRef} height={40} />
              {!peaks ? <span className="tl-empty small muted">Đang đọc sóng âm…</span> : null}
              {shown.map((r, i) => (
                <div key={i} className="cutsel" style={{ left: X(r.from), width: Math.max(2, X(r.to - r.from)) }}>
                  {i < ranges.length ? (
                    <button
                      className="x"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => setRanges(ranges.filter((_, k) => k !== i))}
                      title="Bỏ đoạn này"
                    >
                      ✕
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <div className="tl-row">
            <span className="tl-lab">Chữ nhấn</span>
            <div className="tl-track" style={{ width: trackW }} onPointerDown={(e) => onSeek(timeAt(e.clientX))}>
              {hook.text.trim() ? (
                <div className="blk hook" style={{ left: 0, width: X(hook.sec) }} title="Tiêu đề mở đầu — kéo mép phải để đổi thời lượng">
                  <span>Tiêu đề</span>
                  <i className="grip" onPointerDown={(e) => start(e, { kind: "hook-size", x0: e.clientX, sec0: hook.sec })} />
                </div>
              ) : null}
              {callouts.map((c, i) => (
                <div
                  key={i}
                  className={`blk co ${sel === i ? "sel" : ""}`}
                  style={{ left: X(c.at), width: Math.max(8, X(c.sec)) }}
                  title={`${c.top ? c.top + " / " : ""}${c.main} · ${fmtTime(c.at)} → ${fmtTime(c.at + c.sec)}`}
                  onPointerDown={(e) => {
                    setSel(i);
                    onSeek(c.at + Math.min(1.2, c.sec / 2));
                    start(e, { kind: "co-move", i, x0: e.clientX, at0: c.at, sec0: c.sec });
                  }}
                >
                  <span>{c.main}</span>
                  <i className="grip" onPointerDown={(e) => start(e, { kind: "co-size", i, x0: e.clientX, at0: c.at, sec0: c.sec })} />
                </div>
              ))}
            </div>
          </div>

          <div className="tl-row">
            <span className="tl-lab">SFX</span>
            <div className="tl-track" style={{ width: trackW }} onPointerDown={(e) => onSeek(timeAt(e.clientX))}>
              {sfx.map((s, i) => (
                <span
                  key={i}
                  className="sfxdot"
                  style={{ left: X(s.at) }}
                  title={`${sfxLabel(s.id)} · ${fmtTime(s.at)} — kéo để dời`}
                  onPointerDown={(e) => start(e, { kind: "sfx", i, x0: e.clientX, at0: s.at })}
                />
              ))}
            </div>
          </div>

          <div className="playhead" style={{ left: LABEL_W + X(currentSec) }} />
        </div>
      </div>
      <p className="small muted tl-help">
        Kéo khối chữ để dời · kéo mép phải để kéo dài · kéo chấm xanh để dời SFX · bấm thước để tua. Tiếng tự gắn theo mẫu chữ
        đi cùng khối chữ, không hiện chấm riêng.
      </p>
    </div>
  );
}
