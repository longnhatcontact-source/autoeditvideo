import { Video } from "@remotion/media";
import React from "react";
import { AbsoluteFill, Img, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig } from "remotion";

export type Overlay = { src: string; at: number; sec: number; kind: "image" | "video" };

// khung ảnh chèn: phủ vùng giữa (chỗ video gốc), chừa băng tên dự án phía trên và phụ đề phía dưới
export const OVERLAY_BOX = { left: 60, top: 560, width: 960, height: 740 };

const Card: React.FC<{ o: Overlay }> = ({ o }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 14, stiffness: 160 }, durationInFrames: 12 });
  const out = interpolate(frame, [durationInFrames - 8, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const style: React.CSSProperties = { width: "100%", height: "100%", objectFit: "cover" };
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          ...OVERLAY_BOX,
          opacity: Math.min(enter, out),
          transform: `scale(${interpolate(enter, [0, 1], [0.85, 1])})`,
          borderRadius: 28,
          overflow: "hidden",
          border: "6px solid #C9A24B",
          boxShadow: "0 24px 70px rgba(0,0,0,0.55)",
          background: "#111",
        }}
      >
        {o.kind === "video" ? (
          <Video src={o.src} muted objectFit="cover" style={style} disallowFallbackToOffthreadVideo />
        ) : (
          <Img src={o.src} style={style} />
        )}
      </div>
    </AbsoluteFill>
  );
};

/** Ảnh / clip minh hoạ chèn lên video tại từng thời điểm */
export const Overlays: React.FC<{ items: Overlay[] }> = ({ items }) => {
  const { fps } = useVideoConfig();
  return (
    <>
      {items.map((o, i) => (
        <Sequence
          key={`${o.src}-${i}`}
          from={Math.max(0, Math.round(o.at * fps))}
          durationInFrames={Math.max(fps / 2, Math.round(o.sec * fps))}
          layout="none"
        >
          <Card o={o} />
        </Sequence>
      ))}
    </>
  );
};
