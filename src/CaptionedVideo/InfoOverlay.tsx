import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { TheBoldFont } from "../load-font";

export type InfoData = {
  tenDuAn: string;
  gia: string;
  dienTich: string;
  phongNgu: string;
  diaChi: string;
};

const GOLD = "#C9A24B";

/** Thẻ giá vào lúc 0.5s + cardDelaySec và ở 5.5 giây (chờ tiêu đề mở đầu xong) */
export const CARD_IN_SEC = 0.5;
export const CARD_SHOW_SEC = 5.5;

export const InfoOverlay: React.FC<{ info: InfoData; cardDelaySec?: number }> = ({ info, cardDelaySec = 0 }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const cardIn = Math.round((CARD_IN_SEC + cardDelaySec) * fps);

  const edge = Math.min(15, Math.floor(durationInFrames / 4));
  const fade = interpolate(
    frame,
    [0, edge, durationInFrames - edge, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const slideIn = spring({ frame: frame - cardIn, fps, config: { damping: 200 } });
  const slideOut = spring({
    frame: frame - cardIn - Math.round(CARD_SHOW_SEC * fps),
    fps,
    config: { damping: 200 },
  });
  // trượt hẳn ra ngoài khung (thẻ có thể rộng gần hết màn hình khi địa chỉ dài)
  const cardX =
    interpolate(slideIn, [0, 1], [-1200, 0]) +
    interpolate(slideOut, [0, 1], [0, -1200]);

  return (
    <AbsoluteFill style={{ fontFamily: TheBoldFont }}>
      {info.tenDuAn ? (
        <div
          style={{
            position: "absolute",
            top: 70,
            left: 0,
            right: 0,
            textAlign: "center",
            opacity: fade,
          }}
        >
          <span
            style={{
              display: "inline-block",
              background: "rgba(42,14,19,0.82)",
              border: `2px solid ${GOLD}`,
              borderRadius: 60,
              padding: "18px 48px",
              color: "white",
              fontSize: 46,
              fontWeight: 800,
            }}
          >
            {info.tenDuAn}
          </span>
        </div>
      ) : null}

      {info.gia ? (
        <div
          style={{
            position: "absolute",
            top: 240,
            left: 50,
            transform: `translateX(${cardX}px)`,
            background: "rgba(94,20,32,0.9)",
            borderLeft: `10px solid ${GOLD}`,
            borderRadius: 20,
            padding: "28px 40px",
            color: "white",
          }}
        >
          <div style={{ fontSize: 32, color: "#E4CE93", fontWeight: 800 }}>
            Giá chỉ từ
          </div>
          <div
            style={{
              fontSize: 92,
              fontWeight: 900,
              color: GOLD,
              lineHeight: 1.1,
            }}
          >
            {info.gia}
          </div>
          {info.dienTich || info.phongNgu ? (
            <div style={{ fontSize: 40, marginTop: 10, fontWeight: 800 }}>
              {[info.dienTich, info.phongNgu].filter(Boolean).join(" · ")}
            </div>
          ) : null}
          {info.diaChi ? (
            <div
              style={{
                fontSize: 34,
                marginTop: 6,
                color: "#E4CE93",
                fontWeight: 800,
              }}
            >
              {info.diaChi}
            </div>
          ) : null}
        </div>
      ) : null}

    </AbsoluteFill>
  );
};
