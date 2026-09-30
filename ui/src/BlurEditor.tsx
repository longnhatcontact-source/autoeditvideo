import { useRef, useState } from "react";
import type { Blur } from "./api";

type Pt = { x: number; y: number };
const clamp = (v: number) => Math.min(1, Math.max(0, v));

/** Lớp phủ trên khung xem trước: kéo chuột để vẽ khung làm mờ, bấm ✕ để xoá */
export function BlurEditor({ boxes, onChange }: { boxes: Blur[]; onChange: (b: Blur[]) => void }) {
  const layer = useRef<HTMLDivElement>(null);
  const [start, setStart] = useState<Pt | null>(null);
  const [end, setEnd] = useState<Pt | null>(null);

  const pos = (e: React.PointerEvent): Pt => {
    const r = layer.current!.getBoundingClientRect();
    return { x: clamp((e.clientX - r.left) / r.width), y: clamp((e.clientY - r.top) / r.height) };
  };

  const draft =
    start && end
      ? { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), w: Math.abs(end.x - start.x), h: Math.abs(end.y - start.y) }
      : null;

  return (
    <div
      ref={layer}
      className="blurlayer"
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest("button")) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        const p = pos(e);
        setStart(p);
        setEnd(p);
      }}
      onPointerMove={(e) => start && setEnd(pos(e))}
      onPointerUp={() => {
        if (draft && draft.w > 0.02 && draft.h > 0.01) onChange([...boxes, draft]);
        setStart(null);
        setEnd(null);
      }}
    >
      {boxes.map((b, i) => (
        <div
          key={i}
          className="blurbox"
          style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%` }}
        >
          <button onClick={() => onChange(boxes.filter((_, k) => k !== i))} title="Xoá khung này">
            ✕
          </button>
        </div>
      ))}
      {draft ? (
        <div
          className="blurbox drawing"
          style={{ left: `${draft.x * 100}%`, top: `${draft.y * 100}%`, width: `${draft.w * 100}%`, height: `${draft.h * 100}%` }}
        />
      ) : null}
      <div className="blurhint">Kéo chuột quanh chỗ cần che (số điện thoại, chữ dính sẵn…)</div>
    </div>
  );
}
