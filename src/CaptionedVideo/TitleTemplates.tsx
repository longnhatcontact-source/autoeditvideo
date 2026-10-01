import { fitText } from "@remotion/layout-utils";
import React from "react";
import { Easing, interpolate, random } from "remotion";
import { GeoFont, HeavyFont, SignFont } from "../load-font";

/**
 * Bộ "chữ ký + chữ khối" kiểu tiêu đề BĐS: dòng chữ ký viết tay đè lên góc chữ khối lớn có chất liệu
 * (mây tím, vàng, đỏ, nước biển, đá cẩm thạch, vàng lá, neon, cam + vàng).
 * Mỗi mẫu có hiệu ứng VÀO và RA riêng; nhịp (khung hình) dùng chung cho hình và tiếng.
 *
 * Font gốc trong ảnh mẫu (1FTV VIP Bacalisties, UTM American Sans, SVN-Avobold) có bản quyền riêng,
 * ở đây dùng font Google miễn phí gần giống: Whisper (chữ ký), League Spartan 900 (chữ khối), Lexend (chữ hình học).
 */
export const TEMPLATE_STYLES = ["city", "bigyellow", "redbold", "sea", "marble", "luxgold", "neonsea", "orangegold"] as const;
export type TemplateStyle = (typeof TEMPLATE_STYLES)[number];

export type TemplateParts = {
  frame: number;
  total: number;
  top: string;
  main: string;
  sub: string;
  seed: string;
};

const W = 900; // bề ngang tối đa của khối chữ
const OUT = 12; // số khung hình hiệu ứng ra

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const prog = (f: number, a: number, b: number) => interpolate(f, [a, b], [0, 1], clamp);
const eOut = (t: number) => Easing.out(Easing.cubic)(t);
const eIn = (t: number) => Easing.in(Easing.cubic)(t);
const eBack = (t: number) => Easing.out(Easing.back(1.6))(t);

const longest = (t: string) => t.split("\n").reduce((a, b) => (Array.from(b).length > Array.from(a).length ? b : a), "");
const fit = (text: string, font: string, weight: number, max: number, width = W, perChar = 0.62) => {
  if (!text) return 0;
  const line = longest(text);
  return Math.min(
    max,
    fitText({ text: line, withinWidth: width, fontFamily: font, fontWeight: weight }).fontSize,
    width / (Array.from(line).length * perChar),
  );
};

/** chữ dài thì bẻ 2 dòng cân nhau */
const balance = (text: string, limit = 13) => {
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
};

/** mặt nạ quét trái -> phải (giả nét viết tay) */
const writeOn = (p: number, soft = 12): React.CSSProperties => {
  const edge = -soft + p * (100 + soft);
  const g = `linear-gradient(90deg, #000 ${edge}%, transparent ${edge + soft}%)`;
  return { WebkitMaskImage: g, maskImage: g };
};

// ---------- chất liệu chữ: SVG feTurbulence (tự sinh, không cần file ảnh) ----------
const svg = (body: string) =>
  `url("data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='500' preserveAspectRatio='none'>${body}</svg>`,
  )}")`;
const noise = (id: string, type: "fractalNoise" | "turbulence", freq: string, oct: number, seed: number, matrix: string) =>
  svg(
    `<filter id='${id}' x='0' y='0' width='100%' height='100%'><feTurbulence type='${type}' baseFrequency='${freq}' numOctaves='${oct}' seed='${seed}'/><feColorMatrix type='matrix' values='${matrix}'/></filter><rect width='100%' height='100%' filter='url(#${id})'/>`,
  );
const seedNum = (s: string) => Math.floor(random(s) * 900) + 1;

const TEX = {
  // mây tím: nền tím + mảng mây trắng
  cloud: (s: number) =>
    `${noise("c", "fractalNoise", "0.004 0.011", 4, s, "0 0 0 0 1  0 0 0 0 0.95  0 0 0 0 1  2.6 0 0 0 -1.25")}, linear-gradient(180deg, #b38cff 0%, #8d63e6 55%, #c79bf2 100%)`,
  // nước biển: nền xanh ngọc + vệt bọt trắng
  sea: (s: number) =>
    `${noise("s", "turbulence", "0.012 0.03", 3, s, "0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  3.2 0 0 0 -0.95")}, linear-gradient(180deg, #27c4c9 0%, #0f9aa6 60%, #3fd6cf 100%)`,
  // đá cẩm thạch: nền trắng xám + vân tối
  marble: (s: number) =>
    `${noise("m", "turbulence", "0.006 0.016", 4, s, "0 0 0 0 0.3  0 0 0 0 0.3  0 0 0 0 0.32  -6 0 0 0 1.25")}, ${noise("g", "fractalNoise", "0.5", 2, s + 3, "0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  1.4 0 0 0 -0.6")}, linear-gradient(180deg, #ffffff 0%, #e9e9e9 60%, #f7f7f7 100%)`,
  // vàng lá: dải kim loại + hạt lấp lánh
  gold: (s: number) =>
    `${noise("y", "fractalNoise", "0.85", 2, s, "0 0 0 0 1  0 0 0 0 0.95  0 0 0 0 0.8  2.4 0 0 0 -1.35")}, linear-gradient(180deg, #fff1b8 0%, #f2cf6a 30%, #c9962e 52%, #f6dc86 70%, #b8862b 100%)`,
  yellow: () => "linear-gradient(160deg, #fffbe6 0%, #ffe95a 35%, #ffe03a 70%, #fff4a8 100%)",
};

const textFill = (bg: string, extra: React.CSSProperties = {}): React.CSSProperties => ({
  backgroundImage: bg,
  backgroundSize: "cover",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
  WebkitTextFillColor: "transparent",
  ...extra,
});

const heavy = (fs: number): React.CSSProperties => ({
  fontFamily: HeavyFont,
  fontWeight: 900,
  fontSize: fs,
  lineHeight: 0.98,
  whiteSpace: "pre",
  textTransform: "uppercase",
  letterSpacing: "-0.01em",
  // chừa chỗ dấu tiếng Việt chồng 2 tầng (Ẩ, Ố...): chữ tô chất liệu chỉ hiện trong khung của nó
  paddingTop: fs * 0.34,
  marginTop: -fs * 0.22,
});
const sign = (fs: number): React.CSSProperties => ({
  fontFamily: SignFont,
  fontWeight: 400,
  fontSize: fs,
  lineHeight: 1,
  whiteSpace: "pre",
  color: "#fff",
  textShadow: "0 3px 10px rgba(0,0,0,.45)",
  padding: `0 ${fs * 0.2}px`,
});
const geo = (fs: number, weight: number): React.CSSProperties => ({
  fontFamily: GeoFont,
  fontWeight: weight,
  fontSize: fs,
  lineHeight: 1.1,
  whiteSpace: "pre",
});
const SHADOW = "drop-shadow(0 6px 10px rgba(0,0,0,.45))";

/** dòng chữ ký đè lên góc chữ khối: trái (mặc định) hoặc phải */
const Signature: React.FC<{ text: string; fs: number; p: number; side?: "left" | "right"; overlap?: number }> = ({
  text,
  fs,
  p,
  side = "left",
  overlap = 0.3,
}) =>
  text ? (
    <div
      style={{
        ...sign(fs),
        alignSelf: side === "left" ? "flex-start" : "flex-end",
        marginLeft: side === "left" ? "3%" : 0,
        marginRight: side === "right" ? "2%" : 0,
        marginBottom: -fs * overlap,
        position: "relative",
        zIndex: 2,
        ...writeOn(p),
      }}
    >
      {text}
    </div>
  ) : null;

const Col: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", ...style }}>{children}</div>
);

// =============== 8 mẫu ===============

/** city: "Giữa lòng / TRUNG TÂM THÀNH PHỐ / xuất hiện" — chữ mây tím trồi lên, mây trôi; ra: bay lên + mờ */
const City: React.FC<TemplateParts> = ({ frame, total, top, main, sub, seed }) => {
  const m = balance(main.toUpperCase(), 16);
  const fs = fit(m, HeavyFont, 900, 190);
  const sfs = fit(top, SignFont, 400, fs * 1.8, W * 0.62, 0.3);
  const subFs = fit(sub, GeoFont, 700, fs * 0.55, W * 0.7, 0.55);
  const pIn = eOut(prog(frame, 3, 16));
  const ex = eIn(prog(frame, total - OUT, total - 1));
  return (
    <Col style={{ transform: `translateY(${-ex * 120}px)`, opacity: 1 - ex, filter: `blur(${ex * 8}px)` }}>
      <Signature text={top} fs={sfs} p={eOut(prog(frame, 0, 20))} />
      <div style={{ clipPath: "inset(-60% -10% 0 -10%)", padding: "0 10px" }}>
        <div
          style={{
            ...heavy(fs),
            ...textFill(TEX.cloud(seedNum(seed))),
            backgroundSize: "140% 100%",
            backgroundPosition: `${(frame * 0.4) % 100}% 50%`,
            transform: `translateY(${(1 - pIn) * 105}%)`,
            filter: SHADOW,
          }}
        >
          {m}
        </div>
      </div>
      {sub ? (
        <div
          style={{
            ...geo(subFs, 700),
            color: "#fff",
            alignSelf: "flex-end",
            marginRight: "4%",
            fontStyle: "italic",
            transform: `skewX(-10deg) translateX(${(1 - eOut(prog(frame, 12, 24))) * 160}px)`,
            opacity: prog(frame, 12, 18),
            textShadow: "0 4px 12px rgba(0,0,0,.5)",
          }}
        >
          {sub}
        </div>
      ) : null}
    </Col>
  );
};

/** bigyellow: "Temp Font / BĐS" — chữ vàng cực lớn bật vào; ra: thu nhỏ biến mất */
const BigYellow: React.FC<TemplateParts> = ({ frame, total, top, main, sub }) => {
  const m = balance(main.toUpperCase(), 10);
  const fs = fit(m, HeavyFont, 900, 330, W, 0.6);
  const sfs = fit(top, SignFont, 400, Math.min(260, fs * 0.85), W * 0.75, 0.3);
  const subFs = fit(sub, GeoFont, 700, 64, W * 0.8, 0.6);
  const pIn = eBack(prog(frame, 0, 12));
  const ex = eIn(prog(frame, total - OUT, total - 1));
  return (
    <Col style={{ transform: `scale(${1 - ex * 0.45})`, opacity: 1 - ex }}>
      <Signature text={top} fs={sfs} p={eOut(prog(frame, 6, 24))} overlap={0.35} />
      <div
        style={{
          ...heavy(fs),
          ...textFill(TEX.yellow()),
          transform: `scale(${1.5 - 0.5 * pIn})`,
          opacity: prog(frame, 0, 5),
          filter: "drop-shadow(0 8px 14px rgba(0,0,0,.4))",
        }}
      >
        {m}
      </div>
      {sub ? (
        <div style={{ ...geo(subFs, 700), color: "#fff", opacity: eOut(prog(frame, 12, 22)), textShadow: "0 3px 10px rgba(0,0,0,.6)" }}>
          {sub}
        </div>
      ) : null}
    </Col>
  );
};

/** redbold: "Không biết / BẮT ĐẦU TỪ ĐÂU" — từng chữ cái đỏ rơi xuống; ra: rơi tiếp xuống dưới */
const RedBold: React.FC<TemplateParts> = ({ frame, total, top, main, sub }) => {
  const m = balance(main.toUpperCase(), 14);
  const fs = fit(m, HeavyFont, 900, 200);
  const sfs = fit(top, SignFont, 400, fs * 2.0, W * 0.6, 0.3);
  const subFs = fit(sub, GeoFont, 700, 56, W * 0.8, 0.6);
  const lines = m.split("\n");
  let k = 0;
  return (
    <Col>
      <div style={{ alignSelf: "stretch", display: "flex", flexDirection: "column", opacity: 1 - prog(frame, total - 8, total - 1) }}>
        <Signature text={top} fs={sfs} p={eOut(prog(frame, 0, 18))} />
      </div>
      {lines.map((line, li) => (
        <div key={li} style={{ ...heavy(fs), display: "flex", justifyContent: "center" }}>
          {Array.from(line).map((ch) => {
            const i = k++;
            const pin = eBack(prog(frame, 2 + i * 1.2, 12 + i * 1.2));
            const pex = eIn(prog(frame, total - OUT + (i % 6), total - 1));
            return (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  color: "#c8000b",
                  textShadow: "0 6px 14px rgba(0,0,0,.45)",
                  opacity: Math.min(prog(frame, 2 + i * 1.2, 6 + i * 1.2), 1 - pex),
                  transform: `translateY(${(1 - pin) * -90 + pex * 120}px) rotate(${(1 - pin) * (i % 2 ? 8 : -8)}deg)`,
                }}
              >
                {ch}
              </span>
            );
          })}
        </div>
      ))}
      {sub ? (
        <div style={{ ...geo(subFs, 700), color: "#fff", opacity: Math.min(eOut(prog(frame, 16, 26)), 1 - prog(frame, total - 8, total - 1)), textShadow: "0 3px 10px rgba(0,0,0,.6)" }}>
          {sub}
        </div>
      ) : null}
    </Col>
  );
};

/** sea: "Hay / NHÀ PHỐ MẶT BIỂN" — chữ nước biển dâng từ dưới, sóng chạy; ra: quét sang phải */
const Sea: React.FC<TemplateParts> = ({ frame, total, top, main, sub, seed }) => {
  const m = balance(main.toUpperCase(), 16);
  const fs = fit(m, HeavyFont, 900, 190);
  const sfs = fit(top, SignFont, 400, fs * 2.4, W * 0.42, 0.3);
  const subFs = fit(sub, GeoFont, 500, 58, W * 0.8, 0.6);
  const rise = eOut(prog(frame, 2, 18));
  const ex = eIn(prog(frame, total - OUT, total - 1));
  return (
    <Col style={{ clipPath: `inset(-20% ${ex * 105}% -20% -5%)` }}>
      <Signature text={top} fs={sfs} p={eOut(prog(frame, 10, 28))} side="right" overlap={0.5} />
      <div
        style={{
          ...heavy(fs),
          ...textFill(TEX.sea(seedNum(seed))),
          backgroundSize: "160% 100%",
          backgroundPosition: `${(frame * 0.8) % 100}% 50%`,
          clipPath: `inset(${(1 - rise) * 100}% 0 0 0)`,
          transform: `translateY(${(1 - rise) * 30}px)`,
          filter: SHADOW,
        }}
      >
        {m}
      </div>
      {sub ? (
        <div style={{ ...geo(subFs, 500), color: "#fff", opacity: eOut(prog(frame, 14, 24)), textShadow: "0 3px 10px rgba(0,0,0,.6)" }}>{sub}</div>
      ) : null}
    </Col>
  );
};

/** marble: "Nhà phố thương mại / SORA BAY / HẠ LONG" — chữ đá khép dần từ giãn + mờ; ra: giãn ra + mờ */
const Marble: React.FC<TemplateParts> = ({ frame, total, top, main, sub, seed }) => {
  const m = balance(main.toUpperCase(), 12);
  const fs = fit(m, HeavyFont, 900, 230, W - 40, 0.66);
  const topFs = fit(top, GeoFont, 300, fs * 0.42, W * 0.85, 0.5);
  const subFs = fit(sub.toUpperCase(), GeoFont, 500, fs * 0.42, W * 0.6, 0.62);
  const pIn = eOut(prog(frame, 0, 20));
  const ex = eIn(prog(frame, total - OUT, total - 1));
  const track = (1 - pIn) * 0.25 + ex * 0.25;
  const txt: React.CSSProperties = { color: "#fff", textShadow: "0 3px 8px rgba(0,0,0,.6)" };
  return (
    <Col style={{ opacity: 1 - ex }}>
      {top ? (
        <div style={{ ...geo(topFs, 300), ...txt, alignSelf: "flex-start", marginLeft: "2%", opacity: eOut(prog(frame, 6, 18)), transform: `translateY(${(1 - eOut(prog(frame, 6, 18))) * -20}px)` }}>
          {top}
        </div>
      ) : null}
      <div
        style={{
          ...heavy(fs),
          ...textFill(TEX.marble(seedNum(seed))),
          letterSpacing: `${track - 0.01}em`,
          marginRight: `${track}em`,
          filter: `blur(${(1 - pIn) * 10 + ex * 10}px) ${SHADOW}`,
          opacity: prog(frame, 0, 8),
        }}
      >
        {m}
      </div>
      {sub ? (
        <div style={{ ...geo(subFs, 500), ...txt, alignSelf: "flex-end", marginRight: "4%", marginTop: -fs * 0.05, opacity: eOut(prog(frame, 14, 26)), transform: `translateY(${(1 - eOut(prog(frame, 14, 26))) * 20}px)` }}>
          {sub}
        </div>
      ) : null}
    </Col>
  );
};

/** vệt sáng chạy ngang chữ (dùng cho vàng lá) */
const Shine: React.FC<{ text: string; style: React.CSSProperties; p: number }> = ({ text, style, p }) =>
  p > 0 && p < 1 ? (
    <div
      style={{
        ...style,
        position: "absolute",
        inset: 0,
        ...textFill("linear-gradient(105deg, transparent 40%, rgba(255,255,255,.95) 50%, transparent 60%)"),
        backgroundSize: "300% 100%",
        backgroundPosition: `${100 - p * 100}% 50%`,
        filter: "none",
      }}
    >
      {text}
    </div>
  ) : null;

/** luxgold: "Định vị / ĐẲNG CẤP SỐNG" — chữ vàng lá trồi lên + vệt sáng; ra: bay lên + mờ */
const LuxGold: React.FC<TemplateParts> = ({ frame, total, top, main, sub, seed }) => {
  const m = balance(main.toUpperCase(), 14);
  const fs = fit(m, HeavyFont, 900, 200);
  const topFs = fit(top, GeoFont, 500, fs * 0.62, W * 0.7, 0.55);
  const subFs = fit(sub, GeoFont, 500, 56, W * 0.8, 0.6);
  const pIn = eOut(prog(frame, 4, 17));
  const shine = prog(frame, 16, 36);
  const ex = eIn(prog(frame, total - OUT, total - 1));
  const mainStyle: React.CSSProperties = { ...heavy(fs) };
  return (
    <Col style={{ transform: `translateY(${-ex * 90}px)`, opacity: 1 - ex }}>
      {top ? (
        <div
          style={{
            ...geo(topFs, 500),
            color: "#fff",
            marginBottom: -topFs * 0.12,
            opacity: eOut(prog(frame, 0, 12)),
            textShadow: `0 0 ${18 * eOut(prog(frame, 0, 16))}px rgba(255,255,255,.85), 0 3px 8px rgba(0,0,0,.5)`,
          }}
        >
          {top}
        </div>
      ) : null}
      <div style={{ clipPath: "inset(-60% -10% 0 -10%)", padding: "0 10px" }}>
        <div style={{ position: "relative", transform: `translateY(${(1 - pIn) * 105}%)` }}>
          <div style={{ ...mainStyle, ...textFill(TEX.gold(seedNum(seed))), filter: "drop-shadow(0 6px 6px rgba(0,0,0,.6))" }}>{m}</div>
          <Shine text={m} style={mainStyle} p={shine} />
        </div>
      </div>
      {sub ? (
        <div style={{ ...geo(subFs, 500), color: "#fff", opacity: eOut(prog(frame, 14, 24)), textShadow: "0 3px 10px rgba(0,0,0,.6)" }}>{sub}</div>
      ) : null}
    </Col>
  );
};

/** neonsea: "Một bước / Chạm biển" — dòng trên đập vào, chữ neon xanh nhấp nháy bật; ra: neon tắt dần */
const NeonSea: React.FC<TemplateParts> = ({ frame, total, top, main, sub, seed }) => {
  const m = balance(main, 14);
  const fs = fit(m, GeoFont, 500, 210, W, 0.56);
  const topFs = fit(top, HeavyFont, 900, fs * 0.62, W * 0.7, 0.5);
  const subFs = fit(sub, GeoFont, 500, 54, W * 0.8, 0.6);
  const punch = eBack(prog(frame, 0, 9));
  const on = frame < 4 ? 0 : frame < 18 ? (random(`n-${seed}-${frame}`) > 0.4 ? 1 : 0.15) : 1;
  const offStart = total - OUT;
  const off = frame < offStart ? 1 : random(`o-${seed}-${frame}`) > prog(frame, offStart, total - 2) ? 0.9 : 0.1;
  const k = on * off * (1 - prog(frame, total - 4, total - 1));
  const glow = "25,227,255";
  return (
    <Col>
      {top ? (
        <div
          style={{
            fontFamily: HeavyFont,
            fontWeight: 900,
            fontSize: topFs,
            lineHeight: 1,
            whiteSpace: "pre",
            letterSpacing: "-0.06em",
            paddingTop: topFs * 0.12,
            ...textFill("linear-gradient(90deg, #ffffff 0%, #ffffff 60%, rgba(255,255,255,.75) 100%)"),
            filter: "drop-shadow(0 4px 10px rgba(0,0,0,.5))",
            transform: `scale(${1.6 - 0.6 * punch})`,
            opacity: Math.min(prog(frame, 0, 4), 1 - prog(frame, total - OUT, total - 2)),
            marginBottom: -topFs * 0.18,
            zIndex: 2,
          }}
        >
          {top}
        </div>
      ) : null}
      <div
        style={{
          ...geo(fs, 500),
          lineHeight: 1.05,
          color: "#19e3ff",
          opacity: k,
          textShadow: `0 0 12px rgba(${glow},1), 0 0 30px rgba(${glow},.8), 0 0 60px rgba(${glow},.5)`,
        }}
      >
        {m}
      </div>
      {sub ? (
        <div style={{ ...geo(subFs, 500), color: "#fff", opacity: Math.min(eOut(prog(frame, 16, 26)), k), textShadow: "0 3px 10px rgba(0,0,0,.6)" }}>{sub}</div>
      ) : null}
    </Col>
  );
};

/** orangegold: "BÀN GIAO / TIÊU CHUẨN" — dòng cam vào từ trái, chữ vàng vào từ phải; ra: tách 2 bên */
const OrangeGold: React.FC<TemplateParts> = ({ frame, total, top, main, sub, seed }) => {
  const m = balance(main.toUpperCase(), 14);
  const fs = fit(m, GeoFont, 700, 190, W - 60, 0.66);
  const topFs = fit(top.toUpperCase(), GeoFont, 700, fs * 0.62, W * 0.7, 0.66);
  const subFs = fit(sub, GeoFont, 500, 54, W * 0.8, 0.6);
  const pTop = eOut(prog(frame, 0, 12));
  const pMain = eOut(prog(frame, 4, 16));
  const ex = eIn(prog(frame, total - OUT, total - 1));
  const mainStyle: React.CSSProperties = { ...geo(fs, 700), textTransform: "uppercase", letterSpacing: "-0.02em", lineHeight: 1.02, paddingTop: fs * 0.34, marginTop: -fs * 0.22 };
  return (
    <Col>
      {top ? (
        <div
          style={{
            ...geo(topFs, 700),
            textTransform: "uppercase",
            letterSpacing: "-0.02em",
            color: "#ff7400",
            alignSelf: "flex-start",
            marginLeft: "1%",
            marginBottom: -topFs * 0.15,
            textShadow: "0 0 18px rgba(0,0,0,.85), 0 0 6px rgba(0,0,0,.6)",
            transform: `translateX(${(1 - pTop) * -260 - ex * 400}px)`,
            opacity: Math.min(pTop, 1 - ex),
          }}
        >
          {top}
        </div>
      ) : null}
      <div
        style={{
          position: "relative",
          alignSelf: "flex-end",
          marginRight: "1%",
          transform: `translateX(${(1 - pMain) * 260 + ex * 400}px)`,
          opacity: Math.min(pMain, 1 - ex),
        }}
      >
        <div style={{ ...mainStyle, ...textFill(TEX.gold(seedNum(seed))), filter: "drop-shadow(0 6px 6px rgba(0,0,0,.65))" }}>{m}</div>
        <Shine text={m} style={mainStyle} p={prog(frame, 18, 38)} />
      </div>
      {sub ? (
        <div style={{ ...geo(subFs, 500), color: "#fff", opacity: Math.min(eOut(prog(frame, 16, 26)), 1 - ex), textShadow: "0 3px 10px rgba(0,0,0,.6)" }}>{sub}</div>
      ) : null}
    </Col>
  );
};

export const TEMPLATE_BODIES: Record<TemplateStyle, React.FC<TemplateParts>> = {
  city: City,
  bigyellow: BigYellow,
  redbold: RedBold,
  sea: Sea,
  marble: Marble,
  luxgold: LuxGold,
  neonsea: NeonSea,
  orangegold: OrangeGold,
};

/** tiếng đi kèm (giây tính từ lúc chữ hiện) — khớp nhịp hình ở trên */
export function templateSounds(style: TemplateStyle, fps = 30): { id: string; at: number; volume: number }[] {
  const f = (n: number) => n / fps;
  switch (style) {
    case "city":
      return [
        { id: "cn-whoosh-soft.mp3", at: -0.05, volume: 0.5 },
        { id: "kn-pluck.mp3", at: f(13), volume: 0.35 },
      ];
    case "bigyellow":
      return [
        { id: "cn-whoosh-fast.mp3", at: -0.12, volume: 0.55 },
        { id: "impact-hit-3.mp3", at: f(3), volume: 0.4 },
      ];
    case "redbold":
      return [
        { id: "cn-whoosh-fast.mp3", at: -0.05, volume: 0.45 },
        { id: "cn-stamp.mp3", at: f(12), volume: 0.45 },
      ];
    case "sea":
      return [
        { id: "cn-whoosh-soft.mp3", at: 0, volume: 0.55 },
        { id: "cn-shimmer.mp3", at: f(16), volume: 0.35 },
      ];
    case "marble":
      return [
        { id: "cn-riser.mp3", at: f(20) - 0.7, volume: 0.35 },
        { id: "kn-select.mp3", at: f(18), volume: 0.4 },
      ];
    case "luxgold":
      return [
        { id: "cn-whoosh-soft.mp3", at: 0, volume: 0.5 },
        { id: "cn-shimmer.mp3", at: f(16), volume: 0.45 },
      ];
    case "neonsea":
      return [
        { id: "cn-click.mp3", at: 0, volume: 0.55 },
        { id: "cn-neon.mp3", at: f(4), volume: 0.45 },
      ];
    case "orangegold":
      return [
        { id: "cn-whoosh-fast.mp3", at: -0.08, volume: 0.45 },
        { id: "cn-whoosh-fast.mp3", at: f(4) - 0.08, volume: 0.4 },
        { id: "cn-shimmer.mp3", at: f(18), volume: 0.4 },
      ];
  }
}
