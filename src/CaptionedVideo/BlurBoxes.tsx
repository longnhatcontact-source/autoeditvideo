import React from "react";
import { AbsoluteFill } from "remotion";

export type BlurBox = { x: number; y: number; w: number; h: number };

/** Làm mờ các vùng (toạ độ 0..1 theo khung 1080x1920), vd che số điện thoại có sẵn trong clip */
export const BlurBoxes: React.FC<{ boxes: BlurBox[] }> = ({ boxes }) => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    {boxes.map((b, i) => (
      <div
        key={i}
        style={{
          position: "absolute",
          left: `${b.x * 100}%`,
          top: `${b.y * 100}%`,
          width: `${b.w * 100}%`,
          height: `${b.h * 100}%`,
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
          background: "rgba(40, 40, 40, 0.25)",
          borderRadius: 8,
        }}
      />
    ))}
  </AbsoluteFill>
);
