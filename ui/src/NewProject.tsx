import { useEffect, useState } from "react";
import { api, pickFiles, type Template } from "./api";

const baseName = (p: string) => p.split(/[\\/]/).pop() ?? p;

export function NewProject({ existing, onCreated }: { existing: string[]; onCreated: (name: string) => void }) {
  const [name, setName] = useState("");
  const [clips, setClips] = useState<string[]>([]);
  const [model, setModel] = useState("medium");
  const [removeSilence, setRemoveSilence] = useState(true);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [template, setTemplate] = useState("");
  const [script, setScript] = useState("");
  const [autoEdit, setAutoEdit] = useState(true);

  useEffect(() => {
    api.templates().then(setTemplates).catch(() => {});
  }, []);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  const add = async () => {
    const files = await pickFiles("video", true);
    if (!files.length) return;
    setClips((c) => [...c, ...files.filter((f) => !c.includes(f))]);
    if (!name) setName(baseName(files[0]).replace(/\.[^.]+$/, ""));
  };

  const move = (i: number, d: number) =>
    setClips((c) => {
      const n = [...c];
      const j = i + d;
      if (j < 0 || j >= n.length) return c;
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  const trimmed = name.trim();
  const dup = existing.some((e) => e.toLowerCase() === trimmed.toLowerCase());

  const start = async () => {
    setError("");
    setSending(true);
    try {
      const res = await api.create({ name: trimmed, clips, model, removeSilence, template, script, autoEdit });
      onCreated(res.name);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="page narrow">
      <h1>Video mới</h1>
      <p className="muted">
        Chọn một hoặc nhiều clip quay/ghi màn hình. App sẽ chuyển sang khung dọc 9:16, cắt đoạn im lặng, ghép lại và
        tạo phụ đề tự động.
      </p>

      <label className="field">
        <span>Tên video</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Le Parc view tầng 34" />
        {dup ? <em className="warn">Tên này đã có, đặt tên khác</em> : null}
      </label>

      <div className="field">
        <span>Clip ({clips.length})</span>
        <div className="cliplist">
          {clips.map((c, i) => (
            <div key={c} className="clip">
              <b>{i + 1}</b>
              <span title={c}>{baseName(c)}</span>
              <button className="icon" onClick={() => move(i, -1)} disabled={i === 0} title="Lên">
                ↑
              </button>
              <button className="icon" onClick={() => move(i, 1)} disabled={i === clips.length - 1} title="Xuống">
                ↓
              </button>
              <button className="icon" onClick={() => setClips(clips.filter((x) => x !== c))} title="Bỏ">
                ✕
              </button>
            </div>
          ))}
          <button className="btn" onClick={add}>
            + Chọn clip
          </button>
        </div>
      </div>

      <label className="field">
        <span>Dùng mẫu</span>
        <select value={template} onChange={(e) => setTemplate(e.target.value)}>
          <option value="">Không dùng mẫu</option>
          {templates.map((t) => (
            <option key={t.name} value={t.name}>
              {t.name}
              {t.music ? " · có nhạc" : ""}
              {t.blurs ? ` · che ${t.blurs} vùng` : ""}
            </option>
          ))}
        </select>
        <small className="muted">
          {templates.length
            ? "Tự điền tên dự án, giá, tiêu đề mở đầu, vùng che, nhạc nền theo mẫu."
            : "Chưa có mẫu. Làm xong 1 video, vào tab Thông tin bấm “Lưu làm mẫu”."}
        </small>
      </label>

      <div className="row">
        <label className="field">
          <span>Nhận dạng giọng nói</span>
          <select value={model} onChange={(e) => setModel(e.target.value)}>
            <option value="medium">Chính xác (chậm hơn)</option>
            <option value="small">Nhanh</option>
          </select>
        </label>
        <label className="check">
          <input type="checkbox" checked={removeSilence} onChange={(e) => setRemoveSilence(e.target.checked)} />
          Cắt đoạn im lặng
        </label>
      </div>

      <label className="check" style={{ margin: "6px 0 10px" }}>
        <input type="checkbox" checked={autoEdit} onChange={(e) => setAutoEdit(e.target.checked)} />
        <span>
          <b>Tự dựng hoàn chỉnh</b> — sửa chữ nghe nhầm, tiêu đề mở đầu, chữ nổi bật + SFX, ảnh bìa, rồi tự xuất{" "}
          <b>bản nhẹ + ảnh bìa</b> vào thư mục xuất. Xem ổn thì bấm “Bản nét”.
        </span>
      </label>
      {autoEdit ? (
        <label className="field">
          <span>Kịch bản (không bắt buộc)</span>
          <textarea
            rows={6}
            value={script}
            onChange={(e) => setScript(e.target.value)}
            placeholder={"Dán kịch bản nếu có — câu đầu dùng làm tiêu đề, và giúp sửa đúng chữ nghe nhầm.\nVD: Môi giới BĐS sẽ bị phạt rất nhiều nếu như..."}
          />
        </label>
      ) : null}

      {error ? <div className="alert error">{error}</div> : null}
      <button className="btn primary big" disabled={!trimmed || !clips.length || dup || sending} onClick={start}>
        {sending ? "Đang gửi..." : "Bắt đầu xử lý"}
      </button>
      <p className="muted small">Clip dài 3 phút mất khoảng 3–5 phút. Trong lúc chờ bạn vẫn dùng app bình thường.</p>
    </div>
  );
}
