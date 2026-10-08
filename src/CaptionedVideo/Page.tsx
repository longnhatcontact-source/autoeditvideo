import { makeTransform, scale, translateY } from "@remotion/animation-utils";
import { TikTokPage } from "@remotion/captions";
import { fitText } from "@remotion/layout-utils";
import React from "react";
import { AbsoluteFill, interpolate } from "remotion";
import { numberFlags } from "../../lib/captions-core.mjs";
import { TheBoldFont } from "../load-font";

const fontFamily = TheBoldFont;

export type SubStyle = { highlight: string; position: "thap" | "cao" | "tat"; box: boolean };
export const DEFAULT_SUB_STYLE: SubStyle = { highlight: "#39E508", position: "thap", box: false };

// "thấp": ngay trên vùng chú thích TikTok; "cao": giữa khoảng trống dưới video
const BOTTOM = { thap: 350, cao: 560, tat: 350 };

export const SUB_FONT_WEIGHT = 800;
// cỡ chữ tối đa (nhỏ hơn bản cũ 100 cho đỡ chiếm khung)
export const SUB_MAX_FONT_SIZE = 66;
const SUB_MAX_WIDTH = 0.74; // câu rộng nhất chiếm tối đa 74% bề ngang

// viền đen mịn: viền mảnh + vòng bóng đổ tròn đều quanh chữ (thay cho viền 20px bị gãy góc)
const RING = Array.from({ length: 16 }, (_, i) => {
  const a = (i / 16) * Math.PI * 2;
  return `${(Math.cos(a) * 4.5).toFixed(1)}px ${(Math.sin(a) * 4.5).toFixed(1)}px 0 #000`;
}).join(", ");
const OUTLINE: React.CSSProperties = {
  WebkitTextStroke: "7px #000",
  paintOrder: "stroke fill",
  textShadow: `${RING}, 0 6px 18px rgba(0,0,0,.55)`,
};

/** 1 cỡ chữ cho cả video: vừa khít câu rộng nhất (mọi câu cùng cỡ, không câu to câu nhỏ) */
export function subtitleFontSize(pages: TikTokPage[], width: number) {
  let size = SUB_MAX_FONT_SIZE;
  for (const p of pages) {
    const { fontSize } = fitText({
      fontFamily,
      fontWeight: SUB_FONT_WEIGHT,
      text: p.text,
      withinWidth: width * SUB_MAX_WIDTH,
      textTransform: "uppercase",
    });
    size = Math.min(size, fontSize);
  }
  return Math.floor(size);
}

// số liệu (giá, diện tích, năm...) luôn nổi bật; nếu màu đang đọc cũng là vàng thì số dùng cam
export const numberColor = (highlight: string) => (highlight.toUpperCase() === "#FFD23F" ? "#FF9F1C" : "#FFD23F");

export const Page: React.FC<{
  readonly enterProgress: number;
  readonly page: TikTokPage;
  readonly fontSize: number;
  readonly subStyle: SubStyle;
}> = ({ enterProgress, page, fontSize, subStyle }) => {
  const numbers = numberFlags(page.tokens.map((t) => t.text));
  const NUMBER_COLOR = numberColor(subStyle.highlight);

  return (
    <AbsoluteFill
      style={{ justifyContent: "center", alignItems: "center", top: undefined, bottom: BOTTOM[subStyle.position], height: 150 }}
    >
      <div
        style={{
          fontSize,
          color: "white",
          ...(subStyle.box
            ? { background: "rgba(0,0,0,0.62)", padding: "6px 28px 10px", borderRadius: 24, WebkitTextStroke: "0" }
            : OUTLINE),
          transform: makeTransform([
            scale(interpolate(enterProgress, [0, 1], [0.8, 1])),
            translateY(interpolate(enterProgress, [0, 1], [50, 0])),
          ]),
          fontFamily,
          fontWeight: SUB_FONT_WEIGHT,
          textTransform: "uppercase",
        }}
      >
        <span
          style={{
            transform: makeTransform([
              scale(interpolate(enterProgress, [0, 1], [0.8, 1])),
              translateY(interpolate(enterProgress, [0, 1], [50, 0])),
            ]),
          }}
        >
          {page.tokens.map((t, index) => {
            const isNumber = numbers[index];
            // phụ đề đứng yên: cả câu hiện cùng lúc, không tô chữ đang đọc, không hiện dần (anh Nhật chốt 7/10)
            return (
              <span
                key={`${t.fromMs}-${index}`}
                style={{
                  display: "inline",
                  whiteSpace: "pre",
                  color: isNumber ? NUMBER_COLOR : "white",
                }}
              >
                {t.text}
              </span>
            );
          })}
        </span>
      </div>
    </AbsoluteFill>
  );
};
