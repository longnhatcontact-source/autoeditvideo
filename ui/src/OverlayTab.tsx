import { useState } from "react";
import { fmtTime, overlayUrl, pickFiles, type OverlayItem } from "./api";

export function OverlayTab({
  project,
  items,
  currentSec,
  durationSec,
  onAdd,
  onChange,
  onSeek,
}: {
  project: string;
  items: OverlayItem[];
  currentSec: number;
  durationSec: number;
  onAdd: (path: string, at: number, sec: number) => Promise<void>;
  onChange: (items: OverlayItem[], undoKey?: string) => void;
  onSeek: (sec: number) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const add = async () => {
    setError("");
    const files = await pickFiles("media", true);
    if (!files.length) return;
    setBusy(true);
    try {
      // nhiều ảnh thì xếp nối nhau, mỗi ảnh 3 giây
      let at = Number(currentSec.toFixed(1));
      for (const f of files) {
        await onAdd(f, at, 3);
        at += 3;
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const set = (i: number, patch: Partial<OverlayItem>) =>
    onChange(
      items.map((o, k) => (k === i ? { ...o, ...patch } : o)),
      `ov.${i}.${Object.keys(patch).join()}`,
    );

  return (
    <div className="tabbody">
      <div className="row between">
        <p className="muted small" style={{ margin: 0, flex: 1 }}>
          Ảnh phối cảnh, mặt bằng, clip ngắn… hiện thành khung lớn giữa màn hình. Tua tới chỗ muốn chèn rồi bấm thêm.
        </p>
        <button className="btn small" disabled={busy} onClick={add}>
          {busy ? "Đang thêm…" : `+ Chèn tại ${fmtTime(currentSec)}`}
        </button>
      </div>
      {error ? <div className="alert error">{error}</div> : null}
      <div className="ovlist">
        {items.map((o, i) => (
          <div key={o.file} className="ovrow">
            <div className="ovthumb" onClick={() => onSeek(o.at + 0.3)} title="Tua tới đây">
              {o.kind === "image" ? <img src={overlayUrl(project, o.file)} alt="" /> : <span>🎬</span>}
            </div>
            <div className="ovmeta">
              <span className="small" title={o.original}>
                {o.original}
              </span>
              <div className="row">
                <label className="small">
                  Từ giây{" "}
                  <input
                    className="num"
                    type="number"
                    min={0}
                    max={durationSec}
                    step={0.1}
                    value={o.at}
                    onChange={(e) => set(i, { at: Math.max(0, Number(e.target.value)) })}
                  />
                </label>
                <label className="small">
                  Hiện{" "}
                  <input
                    className="num"
                    type="number"
                    min={0.5}
                    max={20}
                    step={0.5}
                    value={o.sec}
                    onChange={(e) => set(i, { sec: Math.max(0.5, Number(e.target.value)) })}
                  />{" "}
                  giây
                </label>
              </div>
            </div>
            <button className="icon" onClick={() => onChange(items.filter((_, k) => k !== i))} title="Bỏ ảnh này">
              ✕
            </button>
          </div>
        ))}
        {!items.length ? <p className="muted pad">Chưa chèn ảnh nào.</p> : null}
      </div>
    </div>
  );
}
