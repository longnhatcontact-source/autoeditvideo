import { fitText } from "@remotion/layout-utils";
import React from "react";
import { AbsoluteFill, Easing, interpolate, random, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { ScriptFont, TheBoldFont } from "../load-font";
import { OVERLAY_BOX } from "./Overlays";

/**
 * "Chữ nhấn": chữ hiệu ứng lớn giữa màn hình ở đoạn quan trọng.
 * 3 dòng: top (chữ viết tay, tuỳ chọn) · main (chữ đậm, bắt buộc) · sub (chữ viết tay, tuỳ chọn).
 * Kiểu: red = trắng viền sáng đỏ · neon = neon xanh nhấp nháy · gold = vàng ánh kim, vệt sáng chạy.
 */
export type CalloutStyle = "red" | "neon" | "gold";
export type Callout = {
  at: number;
  sec: number;
  style: CalloutStyle;
  top: string;
  main: string;
  sub: string;
  /** tâm khối chữ, tỉ lệ 0..1 theo chiều ngang / dọc khung 1080×1920 */
  x: number;
  y: number;
  /** phóng to / thu nhỏ cả khối chữ (0.5..1.5) */
  scale: number;
};

/** vị trí mặc định: giữa vùng video (chừa băng tên dự án phía trên, phụ đề phía dưới) */
export const CALLOUT_DEFAULT_POS = { x: 0.5, y: 0.484, scale: 1 };

const MAX_W = OVERLAY_BOX.width - 40;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const prog = (f: number, a: number, b: number) => interpolate(f, [a, b], [0, 1], clamp);
const easeOut = (t: number) => Easing.out(Easing.cubic)(t);
const easeBack = (t: number) => Easing.out(Easing.back(1.4))(t);

/** mặt nạ quét trái -> phải, mép mềm (p: 0..1) */
const wipe = (p: number, soft = 16): React.CSSProperties => {
  const edge = -soft + p * (100 + soft);
  const g = `linear-gradient(90deg, #000 ${edge}%, transparent ${edge + soft}%)`;
  return { WebkitMaskImage: g, maskImage: g };
};

// fitText đo theo font; thêm giới hạn theo số ký tự cho chắc không tràn khung (chữ đậm in hoa rất rộng)
const size = (text: string, fontFamily: string, fontWeight: number, max: number, width = MAX_W, perChar = 0.5) =>
  text
    ? Math.min(
        max,
        fitText({ text, withinWidth: width, fontFamily, fontWeight }).fontSize,
        width / (Array.from(text).length * perChar),
      )
    : 0;

const THEME: Record<CalloutStyle, { glow: string; script: string; mainColor: string }> = {
  red: { glow: "255,40,70", script: "255,70,90", mainColor: "#fff" },
  neon: { glow: "70,230,255", script: "70,230,255", mainColor: "rgb(205,250,255)" },
  gold: { glow: "255,190,70", script: "255,210,120", mainColor: "#FFD23F" },
};
const GOLD_FILL = "linear-gradient(180deg,#fff0b0 0%,#e8bd5a 45%,#b98530 56%,#f7d77a 100%)";

/**
 * Tiêu đề mở đầu -> 3 dòng chữ nhấn: phần trong *…* là chữ đậm chính,
 * phần trước là dòng viết tay phía trên, phần sau là dòng viết tay phía dưới.
 * Không có *…*: cả câu là chữ đậm (nên ngắn), hoặc câu dài thì 2–3 chữ cuối làm chữ đậm.
 */
export function splitHook(text: string): { top: string; main: string; sub: string } {
  const t = text.replace(/\s+/g, " ").trim();
  const m = t.match(/^(.*?)\*([^*]+)\*(.*)$/);
  if (m) return { top: m[1].replace(/\*/g, "").trim(), main: m[2].trim(), sub: m[3].replace(/\*/g, "").trim() };
  const words = t.split(" ");
  if (words.length <= 3) return { top: "", main: t, sub: "" };
  const n = words.length >= 6 ? 3 : 2;
  return { top: words.slice(0, -n).join(" "), main: words.slice(-n).join(" "), sub: "" };
}

/** Vẽ 1 khối chữ nhấn; thời lượng = Sequence bao ngoài */
export const CalloutView: React.FC<{ c: Callout }> = ({ c }) => {
  const frame = useCurrentFrame();
  const { durationInFrames: total } = useVideoConfig();
  const t = THEME[c.style];
  const main = c.main.trim();
  const top = c.top.trim();
  const sub = c.sub.trim();

  const out = interpolate(frame, [total - 9, total - 1], [1, 0], clamp);
  const backdrop = easeOut(prog(frame, 0, 8)) * out;
  const pulse = 1 + 0.22 * Math.sin((frame / 30) * Math.PI * 1.6);

  const mainFs = size(
    c.style === "neon" ? main : main.toUpperCase(),
    TheBoldFont,
    900,
    main.length <= 8 ? 230 : 170,
    MAX_W,
    0.78,
  );
  // chữ viết tay luôn nhỏ hơn chữ chính để giữ thứ bậc
  const scriptMax = Math.min(150, Math.max(80, mainFs * 0.85));
  const topFs = size(top, ScriptFont, 700, scriptMax, MAX_W * 0.8);
  const subFs = size(sub, ScriptFont, 700, scriptMax, MAX_W * 0.95);

  // --- dòng chính ---
  let mainEl: React.ReactNode;
  const mainBase: React.CSSProperties = {
    fontFamily: TheBoldFont,
    fontWeight: 900,
    fontSize: mainFs,
    lineHeight: 1.08,
    whiteSpace: "pre",
    textTransform: c.style === "neon" ? "none" : "uppercase",
  };
  if (c.style === "red") {
    const p = easeBack(prog(frame, 0, 16));
    mainEl = (
      <div
        style={{
          ...mainBase,
          color: t.mainColor,
          opacity: easeOut(prog(frame, 0, 8)),
          transform: `scale(${1.35 - 0.35 * p})`,
          textShadow: `0 0 ${18 * pulse}px rgba(${t.glow},.95), 0 0 ${46 * pulse}px rgba(${t.glow},.7), 0 4px 10px rgba(0,0,0,.5)`,
        }}
      >
        {main}
      </div>
    );
  } else if (c.style === "neon") {
    // bật đèn nhấp nháy ~0.6s đầu
    const on = frame < 3 ? 0 : frame < 18 ? (random(`neon-${c.at}-${frame}`) > 0.42 ? 1 : 0.15) : 1;
    const k = on * (0.94 + 0.06 * Math.sin(frame * 0.7));
    mainEl = (
      <div
        style={{
          ...mainBase,
          color: t.mainColor,
          opacity: k,
          textShadow: `0 0 ${16 * pulse}px rgba(${t.glow},1), 0 0 ${40 * pulse}px rgba(${t.glow},.75), 0 0 80px rgba(${t.glow},.4)`,
        }}
      >
        {main}
      </div>
    );
  } else {
    const chars = Array.from(main.toUpperCase());
    const shine = prog(frame, 14 + chars.length * 2, 44 + chars.length * 2);
    mainEl = (
      <div style={{ position: "relative", display: "inline-block" }}>
        <div
          style={{
            ...mainBase,
            position: "absolute",
            inset: 0,
            color: "transparent",
            opacity: easeOut(prog(frame, 4, 24)),
            textShadow: `0 0 28px rgba(${t.glow},.75), 0 4px 12px rgba(0,0,0,.6)`,
          }}
        >
          {main}
        </div>
        <div style={{ ...mainBase, position: "relative" }}>
          {chars.map((ch, i) => {
            const p = easeOut(prog(frame, 3 + i * 2, 15 + i * 2));
            return (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  opacity: p,
                  transform: `translateY(${(1 - p) * 50}px)`,
                  background: GOLD_FILL,
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                  WebkitTextFillColor: "transparent",
                }}
              >
                {ch}
              </span>
            );
          })}
        </div>
        {shine > 0 && shine < 1 ? (
          <div
            style={{
              ...mainBase,
              position: "absolute",
              inset: 0,
              color: "transparent",
              WebkitTextFillColor: "transparent",
              background: "linear-gradient(105deg, transparent 42%, rgba(255,255,255,.95) 50%, transparent 58%)",
              backgroundSize: "300% 100%",
              backgroundPositionX: `${100 - shine * 100}%`,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
            }}
          >
            {main}
          </div>
        ) : null}
      </div>
    );
  }

  const scriptStyle = (fs: number): React.CSSProperties => ({
    fontFamily: ScriptFont,
    fontWeight: 700,
    fontSize: fs,
    lineHeight: 1.05,
    color: "#fff",
    whiteSpace: "pre",
    textShadow: `0 0 14px rgba(${t.script},.9), 0 0 30px rgba(${t.script},.45), 0 3px 8px rgba(0,0,0,.6)`,
  });

  const pTop = easeOut(prog(frame, 5, 24));
  const pSub = easeOut(prog(frame, 12, 36));

  const { width: W, height: H } = useVideoConfig();
  const x = c.x ?? CALLOUT_DEFAULT_POS.x;
  const y = c.y ?? CALLOUT_DEFAULT_POS.y;
  const scale = c.scale ?? 1;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* nền tối mềm phía sau cho chữ nổi trên mọi cảnh — đi theo vị trí khối chữ */}
      <AbsoluteFill
        style={{
          opacity: backdrop,
          background: `radial-gradient(ellipse ${70 * scale}% ${32 * scale}% at ${x * 100}% ${y * 100}%, rgba(0,0,0,.62) 0%, rgba(0,0,0,.35) 55%, transparent 100%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: x * W - OVERLAY_BOX.width / 2,
          top: y * H - OVERLAY_BOX.height / 2,
          width: OVERLAY_BOX.width,
          height: OVERLAY_BOX.height,
          transform: `scale(${scale})`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          opacity: out,
        }}
      >
        {top ? (
          <div
            style={{
              ...scriptStyle(topFs),
              alignSelf: "flex-start",
              marginLeft: 30,
              marginBottom: -topFs * 0.12,
              opacity: pTop,
              transform: `translateX(${-120 * (1 - pTop)}px)`,
            }}
          >
            {top}
          </div>
        ) : null}
        {mainEl}
        {sub ? (
          <div
            style={{
              ...scriptStyle(subFs),
              alignSelf: c.style === "neon" ? "flex-end" : "center",
              marginRight: c.style === "neon" ? 30 : 0,
              marginTop: -subFs * 0.05,
              transform: `translateY(${(1 - pSub) * 20}px)`,
              ...(c.style === "neon" ? { opacity: pSub, transform: `translateX(${120 * (1 - pSub)}px)` } : wipe(pSub)),
            }}
          >
            {sub}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

export const Callouts: React.FC<{ items: Callout[] }> = ({ items }) => {
  const { fps } = useVideoConfig();
  return (
    <>
      {items.map((c, i) =>
        c.main.trim() ? (
          <Sequence
            key={`${c.at}-${i}`}
            from={Math.max(0, Math.round(c.at * fps))}
            durationInFrames={Math.max(15, Math.round(c.sec * fps))}
            layout="none"
          >
            <CalloutView c={c} />
          </Sequence>
        ) : null,
      )}
    </>
  );
};
