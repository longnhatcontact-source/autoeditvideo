import { useEffect, useState } from "react";
import { api, fmtTime, type Cover, type Job, type Project } from "./api";
import { STYLE_OPTIONS } from "./CalloutsTab";

/**
 * Ảnh bìa: Claude tự đọc lời thoại -> tiêu đề + ý chính + chọn khung nền; anh sửa lại nếu muốn rồi xuất PNG.
 */
export function CoverTab({
  project,
  currentSec,
  job,
  onSeek,
  onBeforeRun,
  onChanged,
}: {
  project: Project;
  currentSec: number;
  job?: Job;
  onSeek: (sec: number) => void;
  onBeforeRun: () => Promise<void>;
  onChanged: () => void;
}) {
  const [cover, setCover] = useState<Cover>(
    project.cover ?? { title: project.hook.text || "", style: "luxgold", points: [], sec: 1 },
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (project.cover) setCover(project.cover);
  }, [project.cover]);

  const save = (patch: Partial<Cover>) => {
    const next = { ...cover, ...patch };
    setCover(next);
    api.saveCover(project.name, patch).catch((e) => setError((e as Error).message));
  };
  const running = job?.status === "running" || job?.status === "queued";

  const act = async (fn: () => Promise<unknown>) => {
    setError("");
    setBusy(true);
    try {
      await onBeforeRun();
      await fn();
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="tabbody">
      <div className="card soft">
        <b>Tự làm ảnh bìa</b>
        <p className="small muted" style={{ margin: "4px 0 10px" }}>
          Claude đọc lời thoại, viết tiêu đề + ý chính (không bịa số liệu) và chọn khung hình đẹp làm nền, rồi xuất PNG
          1080×1920 vào thư mục xuất.
        </p>
        <div className="row">
          <button className="btn primary" disabled={busy || running} onClick={() => act(() => api.renderCover(project.name, true))}>
            ✨ Tự làm ảnh bìa
          </button>
          <button
            className="btn ghost"
            disabled={busy || running}
            onClick={() =>
              act(async () => {
                const c = await api.suggestCover(project.name);
                setCover(c);
                onSeek(c.sec);
              })
            }
          >
            Chỉ gợi ý chữ
          </button>
        </div>
      </div>

      <label className="field">
        <span>Tiêu đề (phần trong *…* là chữ khối lớn)</span>
        <input value={cover.title} onChange={(e) => save({ title: e.target.value })} placeholder="Môi giới BĐS *bị phạt rất nhiều* nếu như..." />
      </label>
      <label className="field">
        <span>Mẫu chữ</span>
        <select value={cover.style} onChange={(e) => save({ style: e.target.value as Cover["style"] })}>
          {STYLE_OPTIONS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>
      {[0, 1].map((i) => (
        <label key={i} className="field">
          <span>Ý chính {i + 1} (tuỳ chọn)</span>
          <input
            value={cover.points[i] ?? ""}
            maxLength={48}
            onChange={(e) => {
              const p = [...cover.points];
              p[i] = e.target.value;
              save({ points: p.filter((x, k) => x.trim() || k < p.length - 1) });
            }}
          />
        </label>
      ))}
      <div className="row between">
        <span className="small muted">
          Khung nền: giây <b>{fmtTime(cover.sec)}</b>{" "}
          <button className="link" onClick={() => onSeek(cover.sec)}>
            xem
          </button>
        </span>
        <button className="btn small" onClick={() => save({ sec: Math.round(currentSec * 10) / 10 })}>
          📷 Lấy khung đang xem ({fmtTime(currentSec)})
        </button>
      </div>

      <button className="btn primary" disabled={busy || running || !cover.title.trim()} onClick={() => act(() => api.renderCover(project.name))}>
        ⬇ Xuất ảnh bìa PNG
      </button>
      {running ? <div className="small muted">{job?.message} · {Math.round((job?.progress ?? 0) * 100)}%</div> : null}
      {job?.status === "done" ? (
        <div className="alert ok">
          Đã xuất ảnh bìa.{" "}
          <button className="link" onClick={() => api.open(project.name, "cover")}>
            Mở thư mục
          </button>
        </div>
      ) : null}
      {job?.status === "error" ? <div className="alert error">Lỗi: {job.error}</div> : null}
      {error ? <div className="alert error">{error}</div> : null}
    </div>
  );
}
