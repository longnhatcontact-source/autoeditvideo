import React from "react";
import { CalloutView, splitHook, type CalloutStyle } from "./Callouts";

/**
 * Tiêu đề mở đầu: dùng chung bộ chữ với "Chữ nhấn" (Callouts.tsx).
 * "*chữ*" = chữ đậm chính; phần trước/sau = dòng viết tay trên/dưới.
 */
export const Hook: React.FC<{ text: string; style: CalloutStyle; x: number; y: number; scale: number; bg?: number }> = ({
  text,
  style,
  x,
  y,
  scale,
  bg,
}) => {
  const parts = splitHook(text);
  return <CalloutView c={{ at: 0, sec: 0, style, x, y, scale, bg, ...parts }} />;
};
