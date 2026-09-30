import React from "react";
import { AbsoluteFill, Img } from "remotion";
import { TheBoldFont } from "../load-font";

export type BrandPosition = "duoi-video" | "tren-phai" | "tren-trai";

// Tránh vùng TikTok che (thanh trên cùng, nút bên phải, chú thích dưới) và thẻ giá (y 240–500)
const POS: Record<BrandPosition, React.CSSProperties> = {
  "duoi-video": { top: 1290, left: 0, right: 0, justifyContent: "center" },
  "tren-phai": { top: 540, right: 40, justifyContent: "flex-end" },
  "tren-trai": { top: 540, left: 40, justifyContent: "flex-start" },
};

/** Tên kênh / logo nhỏ, mờ nhẹ */
export const Brand: React.FC<{ text: string; logoSrc: string; position: BrandPosition }> = ({
  text,
  logoSrc,
  position,
}) => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    <div style={{ position: "absolute", display: "flex", ...POS[position] }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "10px 22px",
          borderRadius: 40,
          background: "rgba(0,0,0,0.35)",
          opacity: 0.9,
        }}
      >
        {logoSrc ? <Img src={logoSrc} style={{ height: 56, width: "auto", borderRadius: 10 }} /> : null}
        {text ? (
          <span style={{ fontFamily: TheBoldFont, fontWeight: 800, fontSize: 34, color: "white" }}>{text}</span>
        ) : null}
      </div>
    </div>
  </AbsoluteFill>
);
