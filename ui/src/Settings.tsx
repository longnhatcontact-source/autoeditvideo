import { useEffect, useState } from "react";
import { api, brandUrl, pickFiles, type AiInfo, type Brand, type BrandPosition } from "./api";

const POSITIONS: [BrandPosition, string][] = [
  ["duoi-video", "Giữa, ngay dưới video"],
  ["tren-phai", "Bên phải, phía trên video"],
  ["tren-trai", "Bên trái, phía trên video"],
];

export function Settings() {
  const [vocab, setVocab] = useState("");
  const [fixes, setFixes] = useState("");
  const [brand, setBrand] = useState<Brand | null>(null);
  const [saved, setSaved] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api.settings().then((s) => {
      setVocab(s.vocab);
      setFixes(s.fixes);
    });
    api.brand().then(setBrand);
  }, []);

  const flash = (m: string) => {
    setSaved(m);
    setTimeout(() => setSaved(""), 2000);
  };

  const save = async () => {
    setError("");
    try {
      await api.saveSettings({ vocab, fixes });
      if (brand) setBrand(await api.saveBrand(brand));
      flash("Đã lưu");
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const logo = async (remove: boolean) => {
    setError("");
    try {
      const path = remove ? "" : (await pickFiles("image", false))[0];
      if (!remove && !path) return;
      setBrand(await api.setBrandLogo(path));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="page narrow">
      <h1>Cài đặt</h1>

      {brand ? (
        <div className="card soft" style={{ marginBottom: 20 }}>
          <label className="check">
            <input type="checkbox" checked={brand.enabled} onChange={(e) => setBrand({ ...brand, enabled: e.target.checked })} />
            <b>Hiện tên kênh / logo trên mọi video</b>
          </label>
          <label className="field">
            <span>Tên kênh</span>
            <input
              value={brand.text}
              placeholder="@nhatrealproperty"
              onChange={(e) => setBrand({ ...brand, text: e.target.value })}
            />
          </label>
          <div className="row">
            {brand.logo ? <img src={brandUrl(brand.logo)} alt="logo" className="logoprev" /> : null}
            <button className="btn small" onClick={() => logo(false)}>
              {brand.logo ? "Đổi logo" : "+ Chọn logo (png/jpg)"}
            </button>
            {brand.logo ? (
              <button className="btn ghost small danger" onClick={() => logo(true)}>
                Bỏ logo
              </button>
            ) : null}
          </div>
          <label className="field">
            <span>Vị trí</span>
            <select
              value={brand.position}
              onChange={(e) => setBrand({ ...brand, position: e.target.value as BrandPosition })}
            >
              {POSITIONS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <small className="muted">Từng video vẫn tắt được riêng ở tab Thông tin.</small>
        </div>
      ) : null}

      <AiKeyCard />

      <label className="field">
        <span>Từ khoá hay nói</span>
        <small className="muted">
          Tên dự án, từ tiếng Anh… mỗi dòng một cụm. Giúp nhận dạng đúng hơn cho video xử lý sau khi lưu. Cụm nhiều chữ
          (vd “Le Parc Place”) sẽ không bị ngắt xuống dòng phụ đề khác.
        </small>
        <textarea rows={8} value={vocab} onChange={(e) => setVocab(e.target.value)} />
      </label>
      <label className="field">
        <span>Tự sửa chữ sai</span>
        <small className="muted">
          Mỗi dòng: <code>chữ sai =&gt; chữ đúng</code>. Muốn áp cho video đã làm: vào video đó, tab Phụ đề, bấm
          “Áp dụng lại sửa từ”.
        </small>
        <textarea rows={12} value={fixes} onChange={(e) => setFixes(e.target.value)} />
      </label>
      {error ? <div className="alert error">{error}</div> : null}
      <button className="btn primary" onClick={save}>
        Lưu
      </button>
      <span className="ok">{saved}</span>
    </div>
  );
}

/** Khoá API Claude cho nút "Gợi ý chữ nhấn". Lưu trong settings.json trên máy, không hiện lại đầy đủ. */
function AiKeyCard() {
  const [ai, setAi] = useState<AiInfo | null>(null);
  const [key, setKey] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api.ai().then(setAi).catch(() => {});
  }, []);

  const save = async (value: string) => {
    setError("");
    try {
      setAi(await api.saveAi({ key: value }));
      setKey("");
      setMsg(value ? "Đã lưu khoá" : "Đã xoá khoá");
      setTimeout(() => setMsg(""), 2000);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (!ai) return null;
  return (
    <div className="card soft" style={{ marginBottom: 20 }}>
      <b>Claude gợi ý chữ nhấn</b>
      <p className="muted small">
        Tuỳ chọn. Có khoá thì tab “Chữ nhấn” có nút ✨ Gợi ý: Claude đọc <b>chữ phụ đề</b> và thông tin dự án (không gửi
        video) rồi đề xuất chỗ gắn chữ. Mỗi lần gợi ý tốn một ít phí API trên tài khoản Anthropic của bạn. Lấy khoá tại
        console.anthropic.com.
      </p>
      {ai.fromEnv ? (
        <p className="small">Đang dùng khoá từ biến môi trường ANTHROPIC_API_KEY ({ai.keyHint}).</p>
      ) : (
        <div className="row">
          <input
            type="password"
            autoComplete="off"
            value={key}
            placeholder={ai.hasKey ? `Đã có khoá (${ai.keyHint}) — dán khoá mới để thay` : "sk-ant-…"}
            onChange={(e) => setKey(e.target.value)}
            style={{ flex: 1 }}
          />
          <button className="btn small" disabled={!key.trim()} onClick={() => save(key)}>
            Lưu khoá
          </button>
          {ai.hasKey ? (
            <button className="btn ghost small danger" onClick={() => save("")}>
              Xoá khoá
            </button>
          ) : null}
        </div>
      )}
      <small className="muted">Model: {ai.model}</small>
      {msg ? <span className="ok small"> {msg}</span> : null}
      {error ? <div className="alert error">{error}</div> : null}
    </div>
  );
}
