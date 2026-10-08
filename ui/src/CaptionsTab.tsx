import type { Caption } from "@remotion/captions";
import { useEffect, useMemo, useRef, useState } from "react";
import { keepPhrases, replacePageText, toPages, type Page } from "../../lib/captions-core.mjs";
import { fmtTime, type SubStyle } from "./api";

const SUB_COLORS: [string, string][] = [
  ["#39E508", "Xanh lá"],
  ["#FFD23F", "Vàng"],
  ["#FF3B3B", "Đỏ"],
  ["#FF4FD8", "Hồng"],
];

export function CaptionsTab({
  captions,
  subStyle,
  onSubStyle,
  keepTogether,
  durationSec,
  currentSec,
  onChange,
  onSeek,
  onAddSfx,
  onRefix,
}: {
  captions: Caption[];
  subStyle: SubStyle;
  onSubStyle: (s: Partial<SubStyle>) => void;
  keepTogether: string[];
  durationSec: number;
  currentSec: number;
  onChange: (c: Caption[]) => void;
  onSeek: (sec: number) => void;
  onAddSfx: (at: number) => void;
  onRefix: () => void;
}) {
  const pages = useMemo(
    () => toPages(captions, durationSec, keepPhrases(keepTogether)),
    [captions, durationSec, keepTogether],
  );
  const [query, setQuery] = useState("");
  const activeIdx = pages.findIndex((p) => currentSec >= p.start && currentSec < p.end);
  const listRef = useRef<HTMLDivElement>(null);

  // Tự cuộn tới câu đang phát, trừ khi đang gõ sửa
  useEffect(() => {
    if (activeIdx < 0 || document.activeElement?.tagName === "INPUT") return;
    listRef.current?.querySelector(`[data-i="${activeIdx}"]`)?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  const q = query.trim().toLowerCase();

  return (
    <div className="tabbody">
      <div className="row substyle">
        <span className="small">Chữ đang đọc:</span>
        {SUB_COLORS.map(([c, label]) => (
          <button
            key={c}
            className={`swatch ${subStyle.highlight === c ? "on" : ""}`}
            style={{ background: c }}
            title={label}
            onClick={() => onSubStyle({ highlight: c })}
          />
        ))}
        <select value={subStyle.position} onChange={(e) => onSubStyle({ position: e.target.value as SubStyle["position"] })}>
          <option value="tat">Tắt phụ đề (chỉ dùng chữ nhấn)</option>
          <option value="thap">Vị trí thấp</option>
          <option value="cao">Vị trí cao hơn</option>
        </select>
        <label className="check small">
          <input type="checkbox" checked={subStyle.box} onChange={(e) => onSubStyle({ box: e.target.checked })} />
          Hộp nền đen
        </label>
      </div>
      <div className="row between">
        <input
          className="search"
          placeholder="Tìm chữ trong phụ đề…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="btn ghost small" onClick={onRefix} title="Áp bảng sửa từ trong Cài đặt phụ đề">
          Áp dụng lại sửa từ
        </button>
      </div>
      <p className="muted small">
        Bấm vào giờ để tua tới câu đó. Sửa chữ xong bấm Enter hoặc bấm ra ngoài là lưu. Xoá hết chữ = bỏ câu đó.
      </p>
      <div className="caplist" ref={listRef}>
        {pages.map((p, i) =>
          q && !p.text.toLowerCase().includes(q) ? null : (
            <PageRow
              key={`${p.from}-${p.start}-${p.text}`}
              page={p}
              index={i}
              active={i === activeIdx}
              onSeek={() => onSeek(p.start + 0.01)}
              onAddSfx={() => onAddSfx(p.start)}
              onCommit={(text) => {
                if (text.trim() === p.text) return;
                onChange(replacePageText(captions, p, text));
              }}
            />
          ),
        )}
        {!pages.length ? <p className="muted pad">Không nhận được lời nói nào.</p> : null}
      </div>
    </div>
  );
}

function PageRow({
  page,
  index,
  active,
  onSeek,
  onAddSfx,
  onCommit,
}: {
  page: Page;
  index: number;
  active: boolean;
  onSeek: () => void;
  onAddSfx: () => void;
  onCommit: (text: string) => void;
}) {
  const [text, setText] = useState(page.text);
  return (
    <div className={`caprow ${active ? "active" : ""}`} data-i={index}>
      <button className="time" onClick={onSeek} title="Tua tới đây">
        {fmtTime(page.start)}
      </button>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => onCommit(text)}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") setText(page.text);
        }}
      />
      <button className="icon" onClick={onAddSfx} title="Chèn SFX ở câu này">
        +🔊
      </button>
    </div>
  );
}
