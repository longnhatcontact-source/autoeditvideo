import { useEffect, useState } from "react";
import { api, fmtTime, type AiInfo, type Callout, type CalloutStyle } from "./api";

export const STYLE_OPTIONS: [CalloutStyle, string][] = [
  ["red", "🔴 Trắng viền đỏ — bật mạnh"],
  ["neon", "🔵 Neon xanh — nhấp nháy"],
  ["gold", "🟡 Vàng ánh kim — vệt sáng"],
  ["type", "⌨️ Đánh máy — thẻ tối"],
  ["banner", "🟨 Băng vàng xiên"],
  ["pop", "💥 Bật từng từ"],
  ["outline", "⭕ Chữ rỗng → đổ đầy"],
  ["editorial", "📰 Tạp chí — đường kẻ"],
  ["stamp", "🟥 Con dấu đỏ"],
];
const STYLES = STYLE_OPTIONS;
const PRESETS: [string, number][] = [
  ["Trên", 0.3],
  ["Giữa", 0.45],
  ["Dưới", 0.62],
];

export function CalloutsTab({
  project,
  items,
  currentSec,
  durationSec,
  onChange,
  onSeek,
  onBeforeSuggest,
  moving,
  onMove,
}: {
  project: string;
  items: Callout[];
  currentSec: number;
  durationSec: number;
  onChange: (items: Callout[], undoKey?: string) => void;
  onSeek: (sec: number) => void;
  onBeforeSuggest: () => Promise<void>;
  moving: number | null;
  onMove: (i: number) => void;
}) {
  const [ai, setAi] = useState<AiInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    api.ai().then(setAi).catch(() => {});
  }, []);

  const add = () => {
    const at = Number(Math.min(currentSec, Math.max(0, durationSec - 2)).toFixed(1));
    const next = [...items, { at, sec: 3.5, style: "red" as const, top: "", main: "Chữ nhấn", sub: "", x: 0.5, y: 0.3, scale: 1 }];
    onChange(next.sort((a, b) => a.at - b.at));
  };

  const set = (i: number, patch: Partial<Callout>) =>
    onChange(
      items.map((c, k) => (k === i ? { ...c, ...patch } : c)),
      `co.${i}.${Object.keys(patch).join()}`,
    );

  const suggest = async () => {
    setError("");
    setNote("");
    if (items.length && !window.confirm(`Đã có ${items.length} chữ nhấn. Thay bằng gợi ý mới? (Ctrl+Z để hoàn tác)`)) return;
    setBusy(true);
    try {
      await onBeforeSuggest();
      const { callouts } = await api.suggestCallouts(project);
      if (!callouts.length) setNote("Claude không tìm được đoạn phù hợp. Thử thêm bằng tay.");
      else {
        onChange(callouts);
        setNote(`Đã gợi ý ${callouts.length} chữ nhấn — xem lại từng cái, sửa chữ cho đúng rồi mới xuất.`);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="tabbody">
      <p className="muted small" style={{ marginTop: 0 }}>
        Chữ hiệu ứng lớn giữa màn hình ở đoạn quan trọng (kiểu “Vị trí / <b>ĐẮC ĐỊA</b> / Nhịp sống phồn thịnh”). Dòng
        trên và dưới là chữ viết tay, có thể để trống.
      </p>

      <div className="row between">
        <button className="btn small" onClick={add}>
          + Thêm tại {fmtTime(currentSec)}
        </button>
        <button
          className="btn small primary"
          disabled={busy || !ai?.hasKey}
          onClick={suggest}
          title={ai?.hasKey ? "Claude đọc phụ đề và đề xuất chỗ gắn chữ" : "Cần nhập khoá API Claude trong ⚙ Cài đặt"}
        >
          {busy ? "Claude đang đọc phụ đề…" : "✨ Gợi ý bằng Claude"}
        </button>
      </div>
      {ai && !ai.hasKey ? (
        <p className="muted small">
          Muốn Claude tự gợi ý: nhập khoá API trong ⚙ Cài đặt. Chỉ gửi <b>chữ phụ đề</b> + thông tin dự án, không gửi
          video.
        </p>
      ) : null}
      {error ? <div className="alert error">{error}</div> : null}
      {note ? <div className="alert ok">{note}</div> : null}

      <div className="colist">
        {items.map((c, i) => (
          <div key={i} className="card soft corow">
            <div className="row between">
              <button className="link small" onClick={() => onSeek(c.at)} title="Tua tới đây">
                ▶ {fmtTime(c.at)}
              </button>
              <select value={c.style} onChange={(e) => set(i, { style: e.target.value as CalloutStyle })}>
                {STYLES.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
              <button className="icon" onClick={() => onChange(items.filter((_, k) => k !== i))} title="Bỏ chữ nhấn này">
                ✕
              </button>
            </div>
            <input
              className="co-script"
              value={c.top}
              placeholder="Dòng trên (viết tay) — VD: Vị trí"
              maxLength={40}
              onChange={(e) => set(i, { top: e.target.value })}
            />
            <input
              className="co-main"
              value={c.main}
              placeholder="Chữ chính — VD: Đắc địa"
              maxLength={40}
              onChange={(e) => set(i, { main: e.target.value })}
            />
            <input
              className="co-script"
              value={c.sub}
              placeholder="Dòng dưới (viết tay) — VD: Nhịp sống phồn thịnh"
              maxLength={40}
              onChange={(e) => set(i, { sub: e.target.value })}
            />
            <div className="row">
              <label className="small">
                Từ giây{" "}
                <input
                  className="num"
                  type="number"
                  min={0}
                  max={durationSec}
                  step={0.1}
                  value={c.at}
                  onChange={(e) => set(i, { at: Math.max(0, Number(e.target.value)) })}
                />
              </label>
              <label className="small">
                Hiện{" "}
                <input
                  className="num"
                  type="number"
                  min={1.5}
                  max={8}
                  step={0.5}
                  value={c.sec}
                  onChange={(e) => set(i, { sec: Math.max(1.5, Number(e.target.value)) })}
                />{" "}
                giây
              </label>
              <button className="link small" onClick={() => set(i, { at: Number(currentSec.toFixed(1)) })}>
                đặt = {fmtTime(currentSec)}
              </button>
            </div>
            <div className="row">
              <button className={`btn small ${moving === i ? "primary" : "ghost"}`} onClick={() => onMove(i)}>
                {moving === i ? "✓ Xong dời" : "✥ Dời trên video"}
              </button>
              {PRESETS.map(([label, y]) => (
                <button key={label} className="link small" onClick={() => set(i, { x: 0.5, y })}>
                  {label}
                </button>
              ))}
              <label className="small">
                Cỡ{" "}
                <input
                  type="range"
                  min={0.5}
                  max={1.5}
                  step={0.05}
                  value={c.scale}
                  onChange={(e) => set(i, { scale: Number(e.target.value) })}
                  style={{ width: 80, verticalAlign: "middle" }}
                />{" "}
                {Math.round(c.scale * 100)}%
              </label>
            </div>
          </div>
        ))}
        {!items.length ? <p className="muted pad">Chưa có chữ nhấn nào.</p> : null}
      </div>
      <p className="muted small">
        Kiểm tra kỹ tên dự án, con số trước khi đăng. Chữ nhấn có trong bản MP4; bản xuất sang CapCut chưa có chữ nhấn.
      </p>
    </div>
  );
}
