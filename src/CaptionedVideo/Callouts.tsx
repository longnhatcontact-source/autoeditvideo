import { fitText } from "@remotion/layout-utils";
import { Audio } from "@remotion/media";
import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  random,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { ScriptFont, TheBoldFont } from "../load-font";
import { OVERLAY_BOX } from "./Overlays";
import { TEMPLATE_BODIES, TEMPLATE_STYLES, templateSounds, type TemplateStyle } from "./TitleTemplates";

const isTemplate = (s: string): s is TemplateStyle => (TEMPLATE_STYLES as readonly string[]).includes(s);

/**
 * "Chữ nhấn": chữ hiệu ứng lớn ở đoạn quan trọng.
 * 3 dòng: top (dòng phụ phía trên, tuỳ chọn) · main (chữ đậm, bắt buộc) · sub (dòng phụ phía dưới, tuỳ chọn).
 *
 * Mỗi kiểu là 1 cách dựng + chuyển động riêng (không chỉ đổi màu):
 *  red       trắng viền sáng đỏ, phóng to rồi bật về
 *  neon      đèn neon xanh nhấp nháy khi bật
 *  gold      vàng ánh kim, từng chữ cái bay lên + vệt sáng chạy
 *  type      thẻ tối, chữ đánh máy từng ký tự có con trỏ nhấp nháy
 *  banner    băng nền vàng xiên quét ngang, nhãn đen + băng đỏ
 *  pop       từng từ bật ra, viền đen dày, xen kẽ trắng / vàng
 *  outline   chữ rỗng viền trắng rồi đổ đầy, dòng phụ giãn chữ có gạch 2 bên
 *  editorial kiểu tạp chí: 2 đường kẻ vàng mở ra, chữ khép dần từ mờ sang rõ
 *  stamp     con dấu đỏ đập xuống, rung nhẹ
 */
export const CALLOUT_STYLES = [
  // bộ "chữ ký + chữ khối" (TitleTemplates.tsx)
  ...TEMPLATE_STYLES,
  // bộ chữ hiệu ứng
  "red",
  "neon",
  "gold",
  "type",
  "banner",
  "pop",
  "outline",
  "editorial",
  "stamp",
] as const;
export type CalloutStyle = (typeof CALLOUT_STYLES)[number];
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

/** vị trí mặc định: vùng trên đầu người nói (~30% từ trên xuống): không che mắt, tách hẳn khỏi phụ đề */
export const CALLOUT_DEFAULT_POS = { x: 0.5, y: 0.3, scale: 1 };

const MAX_W = OVERLAY_BOX.width - 40;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const prog = (f: number, a: number, b: number) => interpolate(f, [a, b], [0, 1], clamp);
const easeOut = (t: number) => Easing.out(Easing.cubic)(t);
const easeIn = (t: number) => Easing.in(Easing.cubic)(t);
const easeBack = (t: number) => Easing.out(Easing.back(1.4))(t);
const easePop = (t: number) => Easing.out(Easing.back(2.6))(t);

/** mặt nạ quét trái -> phải, mép mềm (p: 0..1) */
const wipe = (p: number, soft = 16): React.CSSProperties => {
  const edge = -soft + p * (100 + soft);
  const g = `linear-gradient(90deg, #000 ${edge}%, transparent ${edge + soft}%)`;
  return { WebkitMaskImage: g, maskImage: g };
};

// fitText đo theo font; thêm giới hạn theo số ký tự cho chắc không tràn khung (chữ đậm in hoa rất rộng)
// chữ nhiều dòng ("\n") thì đo theo dòng dài nhất
const size = (text: string, fontFamily: string, fontWeight: number, max: number, width = MAX_W, perChar = 0.5): number => {
  if (!text) return 0;
  const line = text.split("\n").reduce((a, b) => (Array.from(b).length > Array.from(a).length ? b : a), "");
  return Math.min(
    max,
    fitText({ text: line, withinWidth: width, fontFamily, fontWeight }).fontSize,
    width / (Array.from(line).length * perChar),
  );
};

/** chữ chính dài (> 13 ký tự) thì bẻ 2 dòng cân nhau để chữ to, dễ đọc hơn */
export function balance(text: string, limit = 13): string {
  const t = text.trim();
  if (Array.from(t).length <= limit || !t.includes(" ")) return t;
  const words = t.split(/\s+/);
  let best = t;
  let bestLen = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(" ");
    const b = words.slice(i).join(" ");
    const len = Math.max(Array.from(a).length, Array.from(b).length);
    if (len < bestLen) (bestLen = len), (best = `${a}\n${b}`);
  }
  return best;
}

const THEME: Record<"red" | "neon" | "gold", { glow: string; script: string; mainColor: string }> = {
  red: { glow: "255,40,70", script: "255,70,90", mainColor: "#fff" },
  neon: { glow: "70,230,255", script: "70,230,255", mainColor: "rgb(205,250,255)" },
  gold: { glow: "255,190,70", script: "255,210,120", mainColor: "#FFD23F" },
};
const GOLD_FILL = "linear-gradient(180deg,#fff0b0 0%,#e8bd5a 45%,#b98530 56%,#f7d77a 100%)";
const YELLOW = "#FFD23F";
const RED = "#E5262B";

// ---- nhịp chuyển động (khung hình, 30fps) — dùng chung cho hình và tiếng để luôn khớp nhau ----
const TYPE_START = 4; // bắt đầu gõ
const TYPE_STEP = 2; // 2 khung / ký tự = 15 ký tự/giây
const POP_STEP = 6; // mỗi từ bật cách nhau 0.2s
const STAMP_HIT = 6; // con dấu chạm xuống
const OUTLINE_FILL = [12, 26] as const; // đổ đầy chữ rỗng
const TYPING_FILES = [6, 10, 14, 20, 28];

export type CalloutSound = { id: string; at: number; volume: number };

/** Tiếng đi kèm từng kiểu chữ; at = giây tính từ lúc chữ hiện (có thể âm = vào sớm hơn chút) */
export function calloutSounds(c: Pick<Callout, "style" | "main" | "sub">, fps = 30): CalloutSound[] {
  const f = (frames: number) => frames / fps;
  const main = c.main.trim();
  const n = Array.from(main).length;
  if (isTemplate(c.style)) return templateSounds(c.style, fps);
  switch (c.style) {
    case "red":
      return [
        { id: "cn-whoosh-fast.mp3", at: -0.12, volume: 0.55 },
        { id: "impact-hit-3.mp3", at: 0.03, volume: 0.35 },
      ];
    case "neon":
      return [{ id: "cn-neon.mp3", at: f(3), volume: 0.45 }];
    case "gold":
      return [
        { id: "cn-whoosh-soft.mp3", at: -0.1, volume: 0.5 },
        { id: "cn-shimmer.mp3", at: f(14 + n * 2), volume: 0.4 },
      ];
    case "type": {
      // file gõ phím có số phím gần nhất với số ký tự sẽ gõ
      const keys = TYPING_FILES.reduce((a, b) => (Math.abs(b - n) < Math.abs(a - n) ? b : a));
      return [
        { id: "cn-click.mp3", at: 0, volume: 0.6 },
        { id: `cn-typing-${String(keys).padStart(2, "0")}.mp3`, at: f(TYPE_START), volume: 0.55 },
      ];
    }
    case "banner":
      return [
        { id: "cn-whoosh-fast.mp3", at: -0.08, volume: 0.6 },
        { id: "cn-click.mp3", at: f(9), volume: 0.45 },
      ];
    case "pop": {
      const words = popTokens(main).tokens;
      const list = words.map((_, i) => ({ id: "cn-pop.mp3", at: f(i * POP_STEP), volume: 0.6 }));
      if (c.sub.trim()) list.push({ id: "kn-pluck.mp3", at: f(words.length * POP_STEP + 4), volume: 0.35 });
      return list;
    }
    case "outline":
      return [
        { id: "cn-riser.mp3", at: f(OUTLINE_FILL[1]) - 0.7, volume: 0.35 },
        { id: "kn-glass.mp3", at: f(OUTLINE_FILL[1]), volume: 0.4 },
      ];
    case "editorial":
      return [
        { id: "cn-whoosh-soft.mp3", at: -0.05, volume: 0.45 },
        { id: "kn-select.mp3", at: f(12), volume: 0.4 },
      ];
    case "stamp":
      return [
        { id: "cn-whoosh-fast.mp3", at: f(STAMP_HIT) - 0.2, volume: 0.35 },
        { id: "cn-stamp.mp3", at: f(STAMP_HIT), volume: 0.7 },
      ];
  }
}

/** Phát tiếng của 1 khối chữ; đặt bên trong Sequence của khối đó. base: URL thư mục SFX ("" = public/sfx/) */
export const CalloutAudio: React.FC<{
  c: Pick<Callout, "style" | "main" | "sub">;
  base: string;
  volume: number;
  /** số khung hình từ đầu Sequence bao ngoài tới lúc chữ hiện */
  lead?: number;
}> = ({ c, base, volume, lead = 0 }) => {
  const { fps } = useVideoConfig();
  if (volume <= 0) return null;
  return (
    <>
      {calloutSounds(c, fps).map((s, i) => {
        const from = lead + Math.round(s.at * fps);
        const src = base ? `${base.replace(/\/$/, "")}/${s.id}` : staticFile(`sfx/${s.id}`);
        return (
          <Sequence key={i} from={Math.max(0, from)} durationInFrames={3 * fps} layout="none">
            <Audio src={src} volume={s.volume * volume} trimBefore={from < 0 ? -from : undefined} />
          </Sequence>
        );
      })}
    </>
  );
};

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

type Parts = { frame: number; top: string; main: string; sub: string; c: Callout };

/** 3 kiểu gốc: chữ đậm + chữ viết tay phát sáng */
const ClassicBody: React.FC<Parts> = ({ frame, top, main, sub, c }) => {
  const style = c.style as "red" | "neon" | "gold";
  const t = THEME[style];
  const pulse = 1 + 0.22 * Math.sin((frame / 30) * Math.PI * 1.6);

  const mainFs = size(style === "neon" ? main : main.toUpperCase(), TheBoldFont, 900, main.length <= 8 ? 230 : 170, MAX_W, 0.78);
  // chữ viết tay luôn nhỏ hơn chữ chính để giữ thứ bậc
  const scriptMax = Math.min(150, Math.max(80, mainFs * 0.85));
  const topFs = size(top, ScriptFont, 700, scriptMax, MAX_W * 0.8);
  const subFs = size(sub, ScriptFont, 700, scriptMax, MAX_W * 0.95);

  let mainEl: React.ReactNode;
  const mainBase: React.CSSProperties = {
    fontFamily: TheBoldFont,
    fontWeight: 900,
    fontSize: mainFs,
    lineHeight: 1.08,
    whiteSpace: "pre",
    textTransform: style === "neon" ? "none" : "uppercase",
  };
  if (style === "red") {
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
  } else if (style === "neon") {
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

  return (
    <>
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
            alignSelf: style === "neon" ? "flex-end" : "center",
            marginRight: style === "neon" ? 30 : 0,
            marginTop: -subFs * 0.05,
            transform: `translateY(${(1 - pSub) * 20}px)`,
            ...(style === "neon" ? { opacity: pSub, transform: `translateX(${120 * (1 - pSub)}px)` } : wipe(pSub)),
          }}
        >
          {sub}
        </div>
      ) : null}
    </>
  );
};

const bold = (fs: number, weight = 900): React.CSSProperties => ({
  fontFamily: TheBoldFont,
  fontWeight: weight,
  fontSize: fs,
  lineHeight: 1.08,
  whiteSpace: "pre",
  textTransform: "uppercase",
});

/** type: thẻ tối, chữ đánh máy từng ký tự */
const TypeBody: React.FC<Parts> = ({ frame, top, main: raw, sub }) => {
  const main = balance(raw);
  const PAD = 48;
  const chars = Array.from(main.toUpperCase());
  const mainFs = size(main.toUpperCase(), TheBoldFont, 900, 150, MAX_W - PAD * 2, 0.8);
  const subFs = size(sub, TheBoldFont, 600, 52, MAX_W - PAD * 2, 0.55);
  const typed = Math.max(0, Math.min(chars.length, Math.floor((frame - TYPE_START) / TYPE_STEP) + 1));
  const doneAt = TYPE_START + chars.length * TYPE_STEP;
  const caretOn = frame < doneAt || Math.floor((frame - doneAt) / 12) % 2 === 0;
  const card = easeBack(prog(frame, 0, 8));
  const pSub = easeOut(prog(frame, doneAt + 2, doneAt + 14));
  return (
    <div
      style={{
        background: "rgba(14,14,20,.9)",
        border: "2px solid rgba(255,255,255,.14)",
        borderRadius: 30,
        padding: `30px ${PAD}px 36px`,
        boxShadow: "0 24px 70px rgba(0,0,0,.55)",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 10,
        opacity: prog(frame, 0, 5),
        transform: `scale(${0.85 + 0.15 * card})`,
      }}
    >
      {top ? (
        <div style={{ ...bold(34, 800), color: YELLOW, letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ width: 14, height: 14, borderRadius: 999, background: RED, boxShadow: `0 0 12px ${RED}` }} />
          {top}
        </div>
      ) : null}
      <div style={{ ...bold(mainFs), color: "#fff" }}>
        {chars.map((ch, i) => (
          <React.Fragment key={i}>
            {i === typed ? <Caret fs={mainFs} on={caretOn} /> : null}
            <span style={{ visibility: i < typed ? "visible" : "hidden" }}>{ch}</span>
          </React.Fragment>
        ))}
        {typed >= chars.length ? <Caret fs={mainFs} on={caretOn} /> : null}
      </div>
      {sub ? (
        <div
          style={{
            fontFamily: TheBoldFont,
            fontWeight: 600,
            fontSize: subFs,
            color: "rgba(255,255,255,.78)",
            whiteSpace: "pre",
            opacity: pSub,
            transform: `translateY(${(1 - pSub) * 14}px)`,
          }}
        >
          {sub}
        </div>
      ) : null}
    </div>
  );
};
const Caret: React.FC<{ fs: number; on: boolean }> = ({ fs, on }) => (
  <span style={{ display: "inline-block", width: 0, position: "relative" }}>
    <span
      style={{
        position: "absolute",
        left: fs * 0.03,
        top: -fs * 0.78,
        width: fs * 0.07,
        height: fs * 0.86,
        background: YELLOW,
        opacity: on ? 1 : 0,
      }}
    />
  </span>
);

/** banner: băng vàng xiên quét ngang + nhãn đen + băng đỏ */
const BannerBody: React.FC<Parts> = ({ frame, top, main: raw, sub }) => {
  const main = balance(raw);
  const mainFs = size(main.toUpperCase(), TheBoldFont, 900, 170, MAX_W - 90, 0.8);
  const subFs = size(sub.toUpperCase(), TheBoldFont, 800, 46, MAX_W - 120, 0.72);
  const pBar = easeOut(prog(frame, 0, 9));
  const pText = easeOut(prog(frame, 3, 13));
  const pTop = easeOut(prog(frame, 2, 11));
  const pSub = easeOut(prog(frame, 9, 18));
  const skew = "skewX(-10deg)";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", filter: "drop-shadow(0 14px 30px rgba(0,0,0,.5))" }}>
      {top ? (
        <div
          style={{
            alignSelf: "flex-start",
            marginLeft: 40,
            marginBottom: -6,
            background: "#111",
            color: "#fff",
            padding: "8px 22px 10px",
            transform: `${skew} translateY(${(1 - pTop) * 30}px)`,
            opacity: pTop,
            zIndex: 1,
          }}
        >
          <div style={{ ...bold(38, 800), letterSpacing: "0.06em", transform: "skewX(10deg)" }}>{top}</div>
        </div>
      ) : null}
      <div
        style={{
          background: YELLOW,
          padding: "12px 44px 16px",
          transform: skew,
          clipPath: `inset(0 ${(1 - pBar) * 100}% 0 0)`,
        }}
      >
        <div
          style={{
            ...bold(mainFs),
            color: "#111",
            transform: `skewX(10deg) translateX(${(1 - pText) * -60}px)`,
            opacity: pText,
          }}
        >
          {main}
        </div>
      </div>
      {sub ? (
        <div
          style={{
            alignSelf: "flex-end",
            marginRight: 40,
            marginTop: -4,
            background: RED,
            padding: "8px 26px 10px",
            transform: skew,
            clipPath: `inset(0 0 0 ${(1 - pSub) * 100}%)`,
          }}
        >
          <div style={{ ...bold(subFs, 800), color: "#fff", transform: "skewX(10deg)" }}>{sub}</div>
        </div>
      ) : null}
    </div>
  );
};

/**
 * pop: tách chữ chính thành các phần bật lần lượt.
 * Có dấu "→" (vd "Kết nối → Dòng người → Giá trị"): mỗi cụm 1 dòng, xếp chồng — hợp cho chuỗi ý.
 * Không có: bật từng từ trên 1 dòng.
 */
export function popTokens(main: string): { tokens: string[]; stacked: boolean } {
  if (main.includes("→")) {
    return { tokens: main.split("→").map((t) => t.trim()).filter(Boolean).slice(0, 5), stacked: true };
  }
  return { tokens: main.split(/\s+/).filter(Boolean).slice(0, 6), stacked: false };
}

/** pop: từng từ bật ra, viền đen dày */
const PopBody: React.FC<Parts> = ({ frame, top, main, sub }) => {
  const { tokens, stacked } = popTokens(main.toUpperCase());
  const words = tokens;
  const longest = stacked ? words.reduce((a, b) => (b.length > a.length ? b : a), "") : words.join(" ");
  const mainFs = size(longest, TheBoldFont, 900, stacked ? 150 : 190, MAX_W - 40, 0.82);
  const topFs = size(top.toUpperCase(), TheBoldFont, 800, 50, MAX_W * 0.8, 0.72);
  const subFs = size(sub, TheBoldFont, 800, 46, MAX_W - 80, 0.62);
  const stroke = (fs: number): React.CSSProperties => ({
    WebkitTextStroke: `${Math.max(3, fs * 0.07)}px #000`,
    paintOrder: "stroke fill",
    textShadow: `${fs * 0.05}px ${fs * 0.06}px 0 #000`,
  });
  const subAt = words.length * POP_STEP + 4;
  const pTop = easePop(prog(frame, 0, 9));
  const pSub = easePop(prog(frame, subAt, subAt + 10));
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      {top ? (
        <div style={{ ...bold(topFs, 800), color: "#fff", ...stroke(topFs), transform: `scale(${pTop})`, opacity: Math.min(1, pTop * 2) }}>
          {top}
        </div>
      ) : null}
      <div
        style={{
          display: "flex",
          flexDirection: stacked ? "column" : "row",
          alignItems: "center",
          gap: stacked ? 0 : mainFs * 0.22,
          whiteSpace: "pre",
        }}
      >
        {words.map((w, i) => {
          const p = easePop(prog(frame, i * POP_STEP, i * POP_STEP + 9));
          return (
            <span
              key={i}
              style={{
                ...bold(mainFs),
                ...stroke(mainFs),
                display: "inline-block",
                color: i % 2 ? YELLOW : "#fff",
                opacity: p > 0 ? 1 : 0,
                transform: `scale(${p}) rotate(${(i % 2 ? 5 : -5) * (1 - Math.min(1, p))}deg)`,
              }}
            >
              {w}
            </span>
          );
        })}
      </div>
      {sub ? (
        <div
          style={{
            marginTop: 10,
            background: "#fff",
            color: "#111",
            borderRadius: 999,
            padding: "10px 34px 12px",
            fontFamily: TheBoldFont,
            fontWeight: 800,
            fontSize: subFs,
            whiteSpace: "pre",
            boxShadow: "0 8px 0 #000",
            transform: `scale(${pSub})`,
          }}
        >
          {sub}
        </div>
      ) : null}
    </div>
  );
};

/** dòng phụ chữ giãn, có gạch vàng 2 bên (dùng cho outline) */
const SpacedLine: React.FC<{ text: string; p: number; fs: number }> = ({ text, p, fs }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 22, opacity: p }}>
    <span style={{ width: 70 * p, height: 3, background: YELLOW }} />
    <span style={{ ...bold(fs, 700), color: "#fff", letterSpacing: "0.3em", marginRight: "-0.3em", textShadow: "0 3px 10px rgba(0,0,0,.7)" }}>
      {text}
    </span>
    <span style={{ width: 70 * p, height: 3, background: YELLOW }} />
  </div>
);

/** outline: chữ rỗng rồi đổ đầy */
const OutlineBody: React.FC<Parts> = ({ frame, top, main: raw, sub }) => {
  const main = balance(raw);
  const mainFs = size(main.toUpperCase(), TheBoldFont, 900, 210, MAX_W, 0.82);
  const lineFs = (s: string) => size(s.toUpperCase(), TheBoldFont, 700, 44, MAX_W - 200, 1.05);
  const pIn = easeOut(prog(frame, 0, 20));
  const pFill = easeOut(prog(frame, OUTLINE_FILL[0], OUTLINE_FILL[1]));
  const common: React.CSSProperties = {
    ...bold(mainFs),
    letterSpacing: `${0.14 - 0.12 * pIn}em`,
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
      {top ? <SpacedLine text={top} fs={lineFs(top)} p={easeOut(prog(frame, 4, 16))} /> : null}
      <div style={{ position: "relative", transform: `scale(${1.12 - 0.12 * pIn})`, opacity: prog(frame, 0, 6) }}>
        <div
          style={{
            ...common,
            color: "transparent",
            WebkitTextStroke: `${Math.max(2, mainFs * 0.022)}px #fff`,
            filter: "drop-shadow(0 4px 10px rgba(0,0,0,.6))",
          }}
        >
          {main}
        </div>
        <div
          style={{
            ...common,
            position: "absolute",
            inset: 0,
            color: "#fff",
            textShadow: `0 0 ${30 * pFill}px rgba(255,255,255,.45), 0 4px 12px rgba(0,0,0,.5)`,
            ...wipe(pFill, 10),
          }}
        >
          {main}
        </div>
      </div>
      {sub ? <SpacedLine text={sub} fs={lineFs(sub)} p={easeOut(prog(frame, 18, 30))} /> : null}
    </div>
  );
};

/** editorial: 2 đường kẻ vàng mở ra, chữ khép dần từ mờ sang rõ */
const EditorialBody: React.FC<Parts> = ({ frame, top, main: raw, sub }) => {
  const main = balance(raw);
  const mainFs = size(main.toUpperCase(), TheBoldFont, 800, 160, MAX_W - 40, 0.84);
  const topFs = size(top.toUpperCase(), TheBoldFont, 700, 32, MAX_W - 100, 1.15);
  const subFs = size(sub, ScriptFont, 700, Math.min(110, mainFs * 0.8), MAX_W * 0.9);
  const pLine = easeOut(prog(frame, 0, 12));
  const p = easeOut(prog(frame, 2, 22));
  const pSub = easeOut(prog(frame, 14, 32));
  const line = <div style={{ width: 820 * pLine, height: 3, background: `linear-gradient(90deg, transparent, ${YELLOW} 18%, ${YELLOW} 82%, transparent)` }} />;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
      {top ? (
        <div style={{ ...bold(topFs, 700), color: YELLOW, letterSpacing: "0.4em", marginRight: "-0.4em", opacity: easeOut(prog(frame, 6, 16)) }}>
          {top}
        </div>
      ) : null}
      {line}
      <div
        style={{
          ...bold(mainFs, 800),
          color: "#fff",
          letterSpacing: `${0.2 - 0.18 * p}em`,
          marginRight: `-${0.2 - 0.18 * p}em`,
          filter: `blur(${(1 - p) * 12}px)`,
          opacity: p,
          textShadow: "0 4px 16px rgba(0,0,0,.6)",
        }}
      >
        {main}
      </div>
      {line}
      {sub ? (
        <div
          style={{
            fontFamily: ScriptFont,
            fontWeight: 700,
            fontSize: subFs,
            lineHeight: 1.05,
            color: "#fff",
            whiteSpace: "pre",
            textShadow: "0 0 14px rgba(255,210,120,.7), 0 3px 8px rgba(0,0,0,.6)",
            marginTop: -6,
            ...wipe(pSub),
          }}
        >
          {sub}
        </div>
      ) : null}
    </div>
  );
};

/** stamp: con dấu đỏ đập xuống */
const StampBody: React.FC<Parts> = ({ frame, top, main: raw, sub, c }) => {
  const main = balance(raw);
  const mainFs = size(main.toUpperCase(), TheBoldFont, 900, 160, MAX_W - 150, 0.82);
  const topFs = size(top.toUpperCase(), TheBoldFont, 800, 44, MAX_W * 0.8, 0.72);
  const subFs = size(sub, ScriptFont, 700, 96, MAX_W * 0.9);
  const pHit = easeIn(prog(frame, 0, STAMP_HIT));
  const after = frame - STAMP_HIT;
  const shake = after >= 0 && after < 8 ? (1 - after / 8) * 7 : 0;
  const dx = shake * (random(`sx-${c.at}-${frame}`) * 2 - 1);
  const dy = shake * (random(`sy-${c.at}-${frame}`) * 2 - 1);
  const pAfter = easeOut(prog(frame, STAMP_HIT + 2, STAMP_HIT + 14));
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18, transform: `translate(${dx}px, ${dy}px)` }}>
      {top ? (
        <div
          style={{
            ...bold(topFs, 800),
            color: "#fff",
            textShadow: "0 3px 10px rgba(0,0,0,.8)",
            opacity: pAfter,
            transform: `translateY(${(1 - pAfter) * 16}px)`,
          }}
        >
          {top}
        </div>
      ) : null}
      <div
        style={{
          transform: `rotate(-6deg) scale(${2.6 - 1.6 * pHit})`,
          opacity: Math.min(1, pHit * 1.6),
          border: `8px solid ${RED}`,
          borderRadius: 14,
          padding: 6,
          background: "rgba(255,255,255,.93)",
          boxShadow: "0 18px 40px rgba(0,0,0,.45)",
        }}
      >
        <div style={{ border: `3px solid ${RED}`, borderRadius: 8, padding: "6px 34px 10px" }}>
          <div style={{ ...bold(mainFs), color: RED }}>{main}</div>
        </div>
      </div>
      {sub ? (
        <div
          style={{
            fontFamily: ScriptFont,
            fontWeight: 700,
            fontSize: subFs,
            lineHeight: 1.05,
            color: "#fff",
            whiteSpace: "pre",
            textShadow: "0 0 14px rgba(255,70,90,.8), 0 3px 8px rgba(0,0,0,.6)",
            ...wipe(pAfter),
          }}
        >
          {sub}
        </div>
      ) : null}
    </div>
  );
};

const BODY: Record<Exclude<CalloutStyle, TemplateStyle>, React.FC<Parts>> = {
  red: ClassicBody,
  neon: ClassicBody,
  gold: ClassicBody,
  type: TypeBody,
  banner: BannerBody,
  pop: PopBody,
  outline: OutlineBody,
  editorial: EditorialBody,
  stamp: StampBody,
};

/** Vẽ 1 khối chữ nhấn; thời lượng = Sequence bao ngoài */
export const CalloutView: React.FC<{ c: Callout }> = ({ c }) => {
  const frame = useCurrentFrame();
  const { durationInFrames: total, width: W, height: H } = useVideoConfig();
  const template = isTemplate(c.style) ? TEMPLATE_BODIES[c.style] : null;
  const Body = template ? null : (BODY[c.style as keyof typeof BODY] ?? ClassicBody);

  const out = interpolate(frame, [total - 9, total - 1], [1, 0], clamp);
  // mẫu chữ ký + chữ khối tự có hiệu ứng ra riêng
  const boxOut = template ? 1 : out;
  // mẫu chữ ký + chữ khối không phủ nền tối (chữ đã có bóng đổ riêng)
  const backdrop = template ? 0 : easeOut(prog(frame, 0, 8)) * out;
  const x = c.x ?? CALLOUT_DEFAULT_POS.x;
  const y = c.y ?? CALLOUT_DEFAULT_POS.y;
  const scale = c.scale ?? 1;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* nền tối mềm phía sau cho chữ nổi trên mọi cảnh — đi theo vị trí khối chữ */}
      <AbsoluteFill
        style={{
          opacity: backdrop,
          background: `radial-gradient(ellipse ${70 * scale}% ${26 * scale}% at ${x * 100}% ${y * 100}%, rgba(0,0,0,.55) 0%, rgba(0,0,0,.3) 55%, transparent 100%)`,
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
          opacity: boxOut,
        }}
      >
        {template
          ? React.createElement(template, {
              frame,
              total,
              top: c.top.trim(),
              main: c.main.trim(),
              sub: c.sub.trim(),
              seed: `${c.at}-${c.main}`,
            })
          : Body
            ? React.createElement(Body, { frame, top: c.top.trim(), main: c.main.trim(), sub: c.sub.trim(), c })
            : null}
      </div>
    </AbsoluteFill>
  );
};

export const Callouts: React.FC<{ items: Callout[]; sfxBase?: string; sfxVolume?: number }> = ({
  items,
  sfxBase = "",
  sfxVolume = 0,
}) => {
  const { fps } = useVideoConfig();
  return (
    <>
      {items.map((c, i) => {
        if (!c.main.trim()) return null;
        const from = Math.max(0, Math.round(c.at * fps));
        return (
          <React.Fragment key={`${c.at}-${i}`}>
            <Sequence from={from} durationInFrames={Math.max(15, Math.round(c.sec * fps))} layout="none">
              <CalloutView c={c} />
            </Sequence>
            {/* tiếng có thể vào sớm hơn chữ một chút (vd tiếng vút) nên đặt Sequence riêng, lùi tối đa 0.3s */}
            <Sequence from={Math.max(0, from - 9)} durationInFrames={Math.round(c.sec * fps) + 3 * fps} layout="none">
              <CalloutAudio c={c} base={sfxBase} volume={sfxVolume} lead={from - Math.max(0, from - 9)} />
            </Sequence>
          </React.Fragment>
        );
      })}
    </>
  );
};
