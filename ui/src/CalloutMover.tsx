import { useRef, useState } from "react";

type Pos = { x: number; y: number; scale: number };
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// kích thước gần đúng của khối chữ (theo tỉ lệ khung 1080×1920) để vẽ khung kéo
const BOX_W = 960 / 1080;
const BOX_H = 480 / 1920;

/** Lớp phủ trên khung xem trước: kéo khung vàng để dời chữ nhấn, lăn chuột để đổi cỡ */
export function CalloutMover({
  item,
  onChange,
  onDone,
}: {
  item: Pos;
  onChange: (patch: Partial<Pos>) => void;
  onDone: () => void;
}) {
  const layer = useRef<HTMLDivElement>(null);
  const [grab, setGrab] = useState<{ dx: number; dy: number } | null>(null);

  const rel = (e: React.PointerEvent) => {
    const r = layer.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };

  const w = BOX_W * item.scale;
  const h = BOX_H * item.scale;

  return (
    <div
      ref={layer}
      className="blurlayer"
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest("button")) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        const p = rel(e);
        const inside = Math.abs(p.x - item.x) < w / 2 && Math.abs(p.y - item.y) < h / 2;
        // bấm trong khung: giữ nguyên chỗ đang cầm; bấm ngoài khung: nhảy tâm tới chỗ bấm
        const g = inside ? { dx: p.x - item.x, dy: p.y - item.y } : { dx: 0, dy: 0 };
        setGrab(g);
        if (!inside) onChange({ x: clamp(p.x, 0.1, 0.9), y: clamp(p.y, 0.05, 0.95) });
      }}
      onPointerMove={(e) => {
        if (!grab) return;
        const p = rel(e);
        onChange({
          x: Number(clamp(p.x - grab.dx, 0.1, 0.9).toFixed(3)),
          y: Number(clamp(p.y - grab.dy, 0.05, 0.95).toFixed(3)),
        });
      }}
      onPointerUp={() => setGrab(null)}
      onWheel={(e) => onChange({ scale: Number(clamp(item.scale - Math.sign(e.deltaY) * 0.05, 0.5, 1.5).toFixed(2)) })}
    >
      <div
        className="blurbox mover"
        style={{
          left: `${(item.x - w / 2) * 100}%`,
          top: `${(item.y - h / 2) * 100}%`,
          width: `${w * 100}%`,
          height: `${h * 100}%`,
        }}
      />
      <div className="blurhint">
        Kéo khung vàng để dời chữ · lăn chuột để phóng to/thu nhỏ ·{" "}
        <button className="link" onClick={onDone}>
          ✓ Xong
        </button>
      </div>
    </div>
  );
}
