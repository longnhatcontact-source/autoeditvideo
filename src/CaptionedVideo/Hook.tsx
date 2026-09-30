import { fitTextOnNLines } from "@remotion/layout-utils";
import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { TheBoldFont } from "../load-font";

const GOLD = "#FFD23F";
const MAX_WIDTH = 920;

// "*chữ*" trong tiêu đề = tô vàng
function parts(text: string) {
  return text.split(/(\*[^*]+\*)/g).filter(Boolean).map((p) => ({
    text: p.replace(/^\*|\*$/g, ""),
    gold: /^\*[^*]+\*$/.test(p),
  }));
}

/** Tiêu đề mở đầu: chữ to giữa màn hình, bật vào, mờ dần khi hết */
export const Hook: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const plain = text.replace(/\*/g, "");
  const { fontSize } = fitTextOnNLines({
    text: plain.toUpperCase(),
    maxLines: 3,
    maxBoxWidth: MAX_WIDTH,
    fontFamily: TheBoldFont,
    fontWeight: 900,
    maxFontSize: 120,
  });

  const enter = spring({ frame, fps, config: { damping: 12, stiffness: 180 }, durationInFrames: 12 });
  const out = interpolate(frame, [durationInFrames - 8, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity: out }}>
      <div
        style={{
          transform: `scale(${interpolate(enter, [0, 1], [0.6, 1])})`,
          background: "rgba(20, 8, 10, 0.72)",
          borderRadius: 36,
          padding: "36px 48px",
          maxWidth: MAX_WIDTH + 96,
          textAlign: "center",
          fontFamily: TheBoldFont,
          fontWeight: 900,
          fontSize,
          lineHeight: 1.15,
          color: "white",
          textTransform: "uppercase",
          WebkitTextStroke: "10px black",
          paintOrder: "stroke",
          boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
        }}
      >
        {parts(text).map((p, i) => (
          <span key={i} style={{ color: p.gold ? GOLD : "white" }}>
            {p.text}
          </span>
        ))}
      </div>
    </AbsoluteFill>
  );
};
