import { useEffect, useMemo, useRef, useState } from "react";
import { api, fmtTime, pickFiles, sfxUrl, type Music, type Project, type Sfx, type SfxItem } from "./api";

export function SoundTab({
  project,
  music,
  sfx,
  currentSec,
  onMusic,
  onPickMusic,
  onRemoveMusic,
  onSfx,
  onSeek,
}: {
  project: Project;
  music: Music | null;
  sfx: Sfx[];
  currentSec: number;
  onMusic: (m: Partial<Music>) => void;
  onPickMusic: (path: string) => void;
  onRemoveMusic: () => void;
  onSfx: (s: Sfx[], undoKey?: string) => void;
  onSeek: (sec: number) => void;
}) {
  const [library, setLibrary] = useState<SfxItem[]>([]);
  const [error, setError] = useState("");
  const audio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    api.sfx().then(setLibrary);
  }, []);

  const groups = useMemo(() => {
    const m = new Map<string, SfxItem[]>();
    for (const it of library) m.set(it.group, [...(m.get(it.group) ?? []), it]);
    return [...m.entries()];
  }, [library]);

  const play = (id: string, volume = 0.8) => {
    audio.current?.pause();
    const a = new Audio(sfxUrl(id));
    a.volume = volume;
    a.play().catch(() => {});
    audio.current = a;
  };

  // key theo dòng + ô: kéo thanh âm lượng liên tục chỉ tính 1 bước hoàn tác
  const set = (i: number, patch: Partial<Sfx>) =>
    onSfx(
      sfx.map((s, k) => (k === i ? { ...s, ...patch } : s)),
      `sfx.${i}.${Object.keys(patch).join()}`,
    );

  const addCustom = async () => {
    setError("");
    const files = await pickFiles("audio", true);
    try {
      let list = library;
      for (const f of files) list = (await api.addSfx(f)).list;
      setLibrary(list);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="tabbody">
      <h3>Nhạc nền</h3>
      {music ? (
        <div className="card soft">
          <div className="row between">
            <span title={music.original}>🎵 {music.original}</span>
            <span className="row">
              <ChangeMusic onPick={onPickMusic} />
              <button className="btn ghost small danger" onClick={onRemoveMusic}>
                Bỏ nhạc
              </button>
            </span>
          </div>
          <label className="slider">
            <span>Âm lượng {Math.round(music.volume * 100)}%</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={music.volume}
              onChange={(e) => onMusic({ volume: Number(e.target.value) })}
            />
          </label>
          <label className="check">
            <input type="checkbox" checked={music.duck} onChange={(e) => onMusic({ duck: e.target.checked })} />
            Tự vặn nhỏ nhạc khi đang nói
          </label>
        </div>
      ) : (
        <div className="card soft">
          <p className="muted small">Chọn file nhạc trên máy (mp3, wav, m4a…). Nhạc tự lặp cho đủ dài video.</p>
          <ChangeMusic onPick={onPickMusic} label="+ Chọn nhạc từ máy" />
        </div>
      )}

      <div className="row between" style={{ marginTop: 18 }}>
        <h3>Hiệu ứng âm thanh (SFX)</h3>
        <button className="btn small" onClick={() => onSfx([...sfx, { id: "pop_real.mp3", at: Number(currentSec.toFixed(2)), volume: 0.6 }])}>
          + Thêm tại {fmtTime(currentSec)}
        </button>
      </div>
      <p className="muted small">
        Tua video tới chỗ muốn chèn rồi bấm “+ Thêm”, hoặc bấm +🔊 ở tab Phụ đề. Bấm ▶ để nghe thử.
      </p>
      <div className="sfxlist">
        {sfx.map((s, i) => (
          <div key={i} className="sfxrow">
            <button className="time" onClick={() => onSeek(s.at)} title="Tua tới đây">
              {fmtTime(s.at)}
            </button>
            <input
              className="num"
              type="number"
              step={0.1}
              min={0}
              max={project.durationSec}
              value={s.at}
              onChange={(e) => set(i, { at: Math.max(0, Number(e.target.value)) })}
              title="Giây"
            />
            <select value={s.id} onChange={(e) => (set(i, { id: e.target.value }), play(e.target.value, s.volume))}>
              {groups.map(([g, items]) => (
                <optgroup key={g} label={g}>
                  {items.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.hint ? `${it.label} — ${it.hint}` : it.label}
                    </option>
                  ))}
                </optgroup>
              ))}
              {!library.some((l) => l.id === s.id) ? <option value={s.id}>{s.id} (không còn)</option> : null}
            </select>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={s.volume}
              onChange={(e) => set(i, { volume: Number(e.target.value) })}
              title={`Âm lượng ${Math.round(s.volume * 100)}%`}
            />
            <button className="icon" onClick={() => play(s.id, s.volume)} title="Nghe thử">
              ▶
            </button>
            <button className="icon" onClick={() => onSfx(sfx.filter((_, k) => k !== i))} title="Xoá">
              ✕
            </button>
          </div>
        ))}
        {!sfx.length ? <p className="muted pad">Chưa có SFX.</p> : null}
      </div>
      <button className="btn ghost small" onClick={addCustom} style={{ marginTop: 10 }}>
        + Thêm tiếng SFX của tôi vào thư viện
      </button>
      {error ? <div className="alert error">{error}</div> : null}
    </div>
  );
}

function ChangeMusic({ onPick, label = "Đổi" }: { onPick: (path: string) => void; label?: string }) {
  return (
    <button
      className={label === "Đổi" ? "btn ghost small" : "btn"}
      onClick={async () => {
        const [f] = await pickFiles("audio", false);
        if (f) onPick(f);
      }}
    >
      {label}
    </button>
  );
}
