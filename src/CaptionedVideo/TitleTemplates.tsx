import { fitText } from "@remotion/layout-utils";
import React from "react";
import { Easing, interpolate, random } from "remotion";
import { AntonFont, BrushFont, CondFont, GeoFont, HeavyFont, RetroFont, SerifFont, SignFont, VietFont } from "../load-font";

/**
 * Bộ "chữ ký + chữ khối" kiểu tiêu đề BĐS: dòng chữ ký viết tay đè lên góc chữ khối lớn có chất liệu
 * (mây tím, vàng, đỏ, nước biển, đá cẩm thạch, vàng lá, neon, cam + vàng).
 * Mỗi mẫu có hiệu ứng VÀO và RA riêng; nhịp (khung hình) dùng chung cho hình và tiếng.
 *
 * Font gốc trong ảnh mẫu (1FTV VIP Bacalisties, UTM American Sans, SVN-Avobold) có bản quyền riêng,
 * ở đây dùng font Google miễn phí gần giống: Whisper (chữ ký), League Spartan 900 (chữ khối), Lexend (chữ hình học).
 */
export const BASE_STYLES = ["city", "bigyellow", "redbold", "sea", "marble", "luxgold", "neonsea", "orangegold"] as const;
export type BaseStyle = (typeof BASE_STYLES)[number];

export type TemplateParts = {
  frame: number;
  total: number;
  top: string;
  main: string;
  sub: string;
  seed: string;
  /** bố cục (chỉ mẫu mở rộng): trống = bố cục mặc định của mẫu */
  layout?: string;
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
    `${noise("y", "fractalNoise", "0.85", 2, s, "0 0 0 0 1  0 0 0 0 0.95  0 0 0 0 0.8  2.4 0 0 0 -1.35")}, linear-gradient(180deg, #ffeaa0 0%, #f0c14b 30%, #b07a1c 52%, #eabd52 70%, #9c6a18 100%)`,
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
  textShadow: HALO,
  padding: `0 ${fs * 0.2}px`,
});
const geo = (fs: number, weight: number): React.CSSProperties => ({
  fontFamily: GeoFont,
  fontWeight: weight,
  fontSize: fs,
  lineHeight: 1.1,
  whiteSpace: "pre",
});
// bóng đổ + quầng tối nhẹ: chữ chất liệu sáng (đá trắng, vàng) vẫn nổi trên tường / trời sáng
const SHADOW = "drop-shadow(0 0 14px rgba(0,0,0,.45)) drop-shadow(0 6px 10px rgba(0,0,0,.5))";
// quầng tối mềm quanh chữ trắng: đọc rõ cả khi nền là trời trắng / tường sáng (không dùng hộp nền)
const HALO = "0 0 6px rgba(0,0,0,.55), 0 0 16px rgba(0,0,0,.45), 0 0 34px rgba(0,0,0,.3), 0 3px 6px rgba(0,0,0,.5)";

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
            textShadow: HALO,
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
          filter: "drop-shadow(0 0 14px rgba(0,0,0,.4)) drop-shadow(0 8px 14px rgba(0,0,0,.45))",
        }}
      >
        {m}
      </div>
      {sub ? (
        <div style={{ ...geo(subFs, 700), color: "#fff", opacity: eOut(prog(frame, 12, 22)), textShadow: HALO }}>
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
        <div style={{ ...geo(subFs, 700), color: "#fff", opacity: Math.min(eOut(prog(frame, 16, 26)), 1 - prog(frame, total - 8, total - 1)), textShadow: HALO }}>
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
        <div style={{ ...geo(subFs, 500), color: "#fff", opacity: eOut(prog(frame, 14, 24)), textShadow: HALO }}>{sub}</div>
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
  const txt: React.CSSProperties = { color: "#fff", textShadow: HALO };
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
          <div style={{ ...mainStyle, ...textFill(TEX.gold(seedNum(seed))), filter: `drop-shadow(0 0 14px rgba(0,0,0,.45)) drop-shadow(0 6px 6px rgba(0,0,0,.6))` }}>{m}</div>
          <Shine text={m} style={mainStyle} p={shine} />
        </div>
      </div>
      {sub ? (
        <div style={{ ...geo(subFs, 500), color: "#fff", opacity: eOut(prog(frame, 14, 24)), textShadow: HALO }}>{sub}</div>
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
        <div style={{ ...geo(subFs, 500), color: "#fff", opacity: Math.min(eOut(prog(frame, 16, 26)), k), textShadow: HALO }}>{sub}</div>
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
        <div style={{ ...mainStyle, ...textFill(TEX.gold(seedNum(seed))), filter: `drop-shadow(0 0 14px rgba(0,0,0,.45)) drop-shadow(0 6px 6px rgba(0,0,0,.65))` }}>{m}</div>
        <Shine text={m} style={mainStyle} p={prog(frame, 18, 38)} />
      </div>
      {sub ? (
        <div style={{ ...geo(subFs, 500), color: "#fff", opacity: Math.min(eOut(prog(frame, 16, 26)), 1 - ex), textShadow: HALO }}>{sub}</div>
      ) : null}
    </Col>
  );
};

const BASE_BODIES: Record<BaseStyle, React.FC<TemplateParts>> = {
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
function baseSounds(style: BaseStyle, fps = 30): { id: string; at: number; volume: number }[] {
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

// ======================================================================================
// 50 mẫu mở rộng — cùng tinh thần 8 mẫu gốc (dòng trên nhỏ + chữ chính lớn có chất liệu, KHÔNG có nền/thẻ đen),
// ghép từ: kiểu dòng trên · font chữ chính · chất liệu · hiệu ứng vào · hiệu ứng ra.
// ======================================================================================

const lg = (deg: number, ...stops: string[]) => `linear-gradient(${deg}deg, ${stops.join(", ")})`;
const sparkle = (s: number, r = "1", g = "1", b = "1", a = "2.4", o = "-1.35") =>
  noise("k", "fractalNoise", "0.85", 2, s, `0 0 0 0 ${r}  0 0 0 0 ${g}  0 0 0 0 ${b}  ${a} 0 0 0 ${o}`);
const metal = (...c: string[]) => lg(180, `${c[0]} 0%`, `${c[1]} 30%`, `${c[2]} 52%`, `${c[3]} 70%`, `${c[4]} 100%`);

const TEX2: Record<string, (s: number) => string> = {
  rosegold: (s) => `${sparkle(s, "1", "0.92", "0.88")}, ${metal("#ffe1d6", "#f0ab95", "#b76a5c", "#f4bfa9", "#a85a4d")}`,
  chrome: (s) => `${sparkle(s, "1", "1", "1", "1.6", "-1.1")}, ${metal("#ffffff", "#dfe4ea", "#8b939d", "#eef2f6", "#7d8590")}`,
  champagne: (s) => `${sparkle(s, "1", "0.97", "0.9")}, ${metal("#fff8e6", "#f4e0b2", "#c8a56a", "#f7e6bf", "#b8935a")}`,
  bronze: (s) => `${sparkle(s, "1", "0.85", "0.6")}, ${metal("#ffd9a8", "#d79a5a", "#8c5526", "#e2a868", "#7a4618")}`,
  copper: (s) => `${sparkle(s, "1", "0.8", "0.65")}, ${metal("#ffcfb0", "#e0864e", "#963f1c", "#ec9a66", "#7e3314")}`,
  pearl: () => lg(115, "#ffffff 0%", "#f3eaff 25%", "#e3f6ff 45%", "#fff3e6 65%", "#f6f0ff 85%", "#ffffff 100%"),
  amethyst: (s) => `${sparkle(s, "1", "0.9", "1")}, ${metal("#efd8ff", "#b77bff", "#6c2fc9", "#c79bff", "#5a24a8")}`,
  emerald: (s) => `${sparkle(s, "0.85", "1", "0.9")}, ${metal("#b9ffd9", "#2fd58f", "#0a7d52", "#4fe6a6", "#06684a")}`,
  forest: (s) =>
    `${noise("f", "fractalNoise", "0.02 0.05", 3, s, "0 0 0 0 0.75  0 0 0 0 1  0 0 0 0 0.6  2.2 0 0 0 -1.2")}, ${lg(180, "#8de36b 0%", "#3fb04a 55%", "#2d8a3a 100%")}`,
  jade: (s) =>
    `${noise("j", "turbulence", "0.006 0.016", 4, s, "0 0 0 0 0.05  0 0 0 0 0.35  0 0 0 0 0.25  -5 0 0 0 1.2")}, ${lg(180, "#c9f7e2 0%", "#8fe3c0 60%", "#b8f0d8 100%")}`,
  sky: (s) => `${noise("w", "fractalNoise", "0.004 0.012", 4, s, "0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  2.4 0 0 0 -1.2")}, ${lg(180, "#bfe6ff 0%", "#5ab4ff 60%", "#9dd6ff 100%")}`,
  sunset: () => lg(180, "#ffe27a 0%", "#ffa04a 35%", "#ff5f6d 70%", "#d64ba0 100%"),
  lagoon: (s) => `${noise("l", "turbulence", "0.014 0.04", 3, s, "0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  2.6 0 0 0 -0.9")}, ${lg(180, "#7af3e6 0%", "#19c3c9 60%", "#5be0d6 100%")}`,
  sapphire: (s) => `${sparkle(s, "0.9", "0.95", "1")}, ${metal("#cfe6ff", "#4d94ff", "#1446c4", "#6fa9ff", "#123a9c")}`,
  sand: (s) => `${noise("d", "fractalNoise", "0.9", 2, s, "0 0 0 0 0.55  0 0 0 0 0.42  0 0 0 0 0.25  1.6 0 0 0 -0.75")}, ${lg(180, "#fff1cf 0%", "#f1d39a 55%", "#e2bd78 100%")}`,
  mint: () => lg(180, "#f2fff9 0%", "#a8ffd9 45%", "#52e3b0 100%"),
  aurora: () => lg(100, "#8dffc0 0%", "#43d7ff 35%", "#a77dff 70%", "#ff86dc 100%"),
  fire: (s) =>
    `${noise("r", "turbulence", "0.02 0.06", 3, s, "0 0 0 0 1  0 0 0 0 0.9  0 0 0 0 0.4  2 0 0 0 -0.9")}, ${lg(180, "#fff3a6 0%", "#ffb21f 30%", "#ff5a00 65%", "#d11a00 100%")}`,
  lava: (s) =>
    `${noise("v", "turbulence", "0.01 0.02", 4, s, "0 0 0 0 1  0 0 0 0 0.85  0 0 0 0 0.2  3 0 0 0 -1.4")}, ${lg(180, "#ff6a2b 0%", "#e5230f 55%", "#ff7a2e 100%")}`,
  ruby: (s) => `${sparkle(s, "1", "0.85", "0.88")}, ${metal("#ffc0cb", "#ff2a4d", "#a3001d", "#ff4d6b", "#8a0018")}`,
  ice: (s) => `${noise("i", "turbulence", "0.01 0.03", 3, s, "0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  2.2 0 0 0 -0.7")}, ${lg(180, "#ffffff 0%", "#d8f6ff 40%", "#8fd8ff 75%", "#e8fbff 100%")}`,
  concrete: (s) =>
    `${noise("o", "fractalNoise", "0.6", 3, s, "0 0 0 0 0.35  0 0 0 0 0.35  0 0 0 0 0.37  1.8 0 0 0 -0.8")}, ${lg(180, "#f4f4f2 0%", "#cfcfcc 60%", "#e6e6e3 100%")}`,
  wood: (s) =>
    `${noise("x", "turbulence", "0.004 0.09", 3, s, "0 0 0 0 0.35  0 0 0 0 0.2  0 0 0 0 0.08  -3 0 0 0 1.1")}, ${lg(180, "#f6c98a 0%", "#d99a55 60%", "#e8b06c 100%")}`,
  holo: () => lg(110, "#ffd1f3 0%", "#c8b6ff 20%", "#9fe8ff 40%", "#b6ffd8 60%", "#fff4b0 80%", "#ffc6e6 100%"),
  lime: () => lg(180, "#fbffd6 0%", "#e2ff5a 40%", "#a8f01a 100%"),
  cyan: () => lg(180, "#e6fdff 0%", "#6ff0ff 45%", "#18c6ea 100%"),
  pastel: () => lg(180, "#fff0f5 0%", "#ffc7da 45%", "#ffb09a 100%"),
  orange: () => lg(180, "#fff0c7 0%", "#ffb43a 40%", "#ff7a00 100%"),
  gold: (s) => TEX.gold(s),
  yellow: () => TEX.yellow(),
  silverwhite: () => lg(180, "#ffffff 0%", "#ffffff 55%", "#dfe6ee 100%"),
};

type Fill = { tex: keyof typeof TEX2 } | { solid: string } | { neon: string };
type Anim = "rise" | "pop" | "zoom" | "blur" | "track" | "wipe" | "slideL" | "slideR" | "drop" | "wave" | "type" | "flicker" | "slam" | "shake" | "stamp" | "write" | "split" | "bounce";
type Exit = "up" | "shrink" | "sweep" | "blur" | "fall" | "down" | "fade" | "off";
type TopKind = "sign" | "brush" | "light" | "bold" | "heavy" | "serif" | "retro";
export const LAYOUTS = ["center", "left", "right", "inline", "side", "zigzag", "bar", "brackets", "underline", "lines"] as const;
export type Layout = (typeof LAYOUTS)[number];
export const LAYOUT_INFO: Record<Layout, string> = {
  center: "Giữa (dòng trên · chữ chính · dòng dưới)",
  left: "Canh trái",
  right: "Canh phải",
  inline: "Dòng trên đứng cạnh chữ chính",
  side: "Chữ chính to bên trái, chữ nhỏ xếp bên phải",
  zigzag: "Mỗi từ 1 dòng, so le trái – phải",
  bar: "Vạch màu dọc bên trái",
  brackets: "Khung góc ôm chữ",
  underline: "Gạch chân chạy dưới chữ",
  lines: "Đường kẻ hai bên dòng trên",
};
type FontKey = "heavy" | "anton" | "serif" | "viet" | "brush" | "retro" | "cond" | "geo" | "geoLight";

type Preset = {
  label: string; // tên hiện trong app
  use: string; // dùng khi nào (Claude đọc để chọn mẫu)
  font: FontKey;
  upper?: boolean;
  fill: Fill;
  anim: Anim;
  exit: Exit;
  top: TopKind;
  topColor?: string;
  topSide?: "left" | "right";
  shine?: boolean;
  scroll?: number;
  max?: number;
  lim?: number;
  subColor?: string;
  layout?: Layout;
};

const FONTS: Record<FontKey, { family: string; weight: number; per: number; lh: number }> = {
  heavy: { family: HeavyFont, weight: 900, per: 0.62, lh: 0.98 },
  anton: { family: AntonFont, weight: 400, per: 0.5, lh: 1.02 },
  serif: { family: SerifFont, weight: 900, per: 0.64, lh: 1.04 },
  viet: { family: VietFont, weight: 800, per: 0.66, lh: 1.02 },
  brush: { family: BrushFont, weight: 400, per: 0.52, lh: 1.15 },
  retro: { family: RetroFont, weight: 400, per: 0.52, lh: 1.12 },
  cond: { family: CondFont, weight: 700, per: 0.5, lh: 1.04 },
  geo: { family: GeoFont, weight: 700, per: 0.66, lh: 1.02 },
  geoLight: { family: GeoFont, weight: 300, per: 0.6, lh: 1.05 },
};

const P = (p: Preset) => p;
export const PRESETS = {
  // --- sang trọng / giá trị ---
  rosegold: P({ label: "Vàng hồng", use: "giá trị, tổ ấm cao cấp, quà tặng", font: "heavy", upper: true, fill: { tex: "rosegold" }, anim: "rise", exit: "up", top: "sign", shine: true }),
  champagne: P({ label: "Sâm panh (chữ có chân)", use: "sang trọng, nghỉ dưỡng, khách sạn", font: "serif", upper: true, fill: { tex: "champagne" }, anim: "track", exit: "blur", top: "light", shine: true, layout: "lines" }),
  platinum: P({ label: "Bạch kim", use: "đẳng cấp, hiện đại, cao cấp", font: "heavy", upper: true, fill: { tex: "chrome" }, anim: "wipe", exit: "sweep", top: "sign", shine: true, layout: "underline" }),
  goldserif: P({ label: "Vàng chữ có chân", use: "biệt thự, dinh thự, bộ sưu tập", font: "serif", upper: true, fill: { tex: "gold" }, anim: "zoom", exit: "shrink", top: "sign", shine: true }),
  bronze: P({ label: "Đồng cổ", use: "di sản, lâu đời, uy tín", font: "anton", upper: true, fill: { tex: "bronze" }, anim: "slideL", exit: "sweep", top: "light", layout: "left" }),
  copper: P({ label: "Đồng đỏ", use: "ấm áp, nhà ở gia đình", font: "viet", upper: true, fill: { tex: "copper" }, anim: "pop", exit: "shrink", top: "sign", layout: "underline" }),
  pearl: P({ label: "Ngọc trai", use: "căn hộ cao cấp, tinh tế, nội thất trắng", font: "serif", fill: { tex: "pearl" }, anim: "blur", exit: "blur", top: "sign", layout: "lines" }),
  royal: P({ label: "Tím hoàng gia", use: "vương giả, độc bản, giới hạn", font: "heavy", upper: true, fill: { tex: "amethyst" }, anim: "rise", exit: "up", top: "sign", shine: true }),
  goldscript: P({ label: "Vàng viết tay", use: "kết luận đẹp, lời cảm ơn, slogan", font: "brush", fill: { tex: "gold" }, anim: "write", exit: "fade", top: "light", max: 200 }),
  sapphire: P({ label: "Lam ngọc", use: "tài chính, ngân hàng, vốn vay", font: "heavy", upper: true, fill: { tex: "sapphire" }, anim: "rise", exit: "up", top: "sign", shine: true, layout: "bar" }),
  // --- thiên nhiên / cảnh quan ---
  emerald: P({ label: "Lục bảo", use: "cây xanh, công viên, sống xanh", font: "heavy", upper: true, fill: { tex: "emerald" }, anim: "rise", exit: "up", top: "sign", shine: true, layout: "left" }),
  forest: P({ label: "Rừng lá", use: "thiên nhiên, mảng xanh lớn, sinh thái", font: "anton", upper: true, fill: { tex: "forest" }, anim: "wipe", exit: "sweep", top: "sign" }),
  jade: P({ label: "Ngọc bích vân đá", use: "phong thuỷ, an cư, bền vững", font: "heavy", upper: true, fill: { tex: "jade" }, anim: "track", exit: "blur", top: "light", layout: "lines" }),
  sky: P({ label: "Trời mây xanh", use: "view thoáng, tầng cao, không gian mở", font: "heavy", upper: true, fill: { tex: "sky" }, anim: "rise", exit: "up", top: "sign", scroll: 0.4 }),
  sunset: P({ label: "Hoàng hôn", use: "view hoàng hôn, cảm xúc, chill", font: "heavy", upper: true, fill: { tex: "sunset" }, anim: "rise", exit: "sweep", top: "sign" }),
  lagoon: P({ label: "Hồ nước", use: "hồ, sông, mặt nước, ven sông", font: "geo", fill: { tex: "lagoon" }, anim: "wave", exit: "down", top: "sign", scroll: 0.8 }),
  ocean: P({ label: "Biển sâu", use: "biển, cảng, vịnh", font: "anton", upper: true, fill: { tex: "sapphire" }, anim: "rise", exit: "sweep", top: "sign", topSide: "right", layout: "right" }),
  sand: P({ label: "Cát biển", use: "bãi biển, nghỉ dưỡng, resort", font: "anton", upper: true, fill: { tex: "sand" }, anim: "slideR", exit: "sweep", top: "sign", layout: "right" }),
  mint: P({ label: "Bạc hà", use: "tươi mới, trẻ trung, nhà mới", font: "viet", upper: true, fill: { tex: "mint" }, anim: "pop", exit: "shrink", top: "sign", layout: "brackets" }),
  aurora: P({ label: "Cực quang", use: "độc đáo, khác biệt, ấn tượng", font: "retro", fill: { tex: "aurora" }, anim: "wipe", exit: "blur", top: "light" }),
  // --- cảnh báo / vấn đề ---
  fire: P({ label: "Lửa", use: "nóng, sốt, hot, cháy hàng", font: "anton", upper: true, fill: { tex: "fire" }, anim: "shake", exit: "up", top: "bold", topColor: "#ffd34d", layout: "zigzag" }),
  alarm: P({ label: "Đỏ báo động", use: "cảnh báo, nguy hiểm, cấm", font: "heavy", upper: true, fill: { solid: "#ff1f2d" }, anim: "slam", exit: "shrink", top: "heavy" }),
  ruby: P({ label: "Hồng ngọc rơi", use: "rủi ro, mất tiền, sai lầm", font: "heavy", upper: true, fill: { tex: "ruby" }, anim: "drop", exit: "fall", top: "sign" }),
  redseal: P({ label: "Con dấu đỏ", use: "đừng, cấm, không nên, bị phạt", font: "viet", upper: true, fill: { solid: "#ff2a2a" }, anim: "stamp", exit: "fade", top: "bold", topColor: "#ffffff" }),
  warning: P({ label: "Cam lưu ý", use: "lưu ý, chú ý, điều kiện", font: "cond", upper: true, fill: { tex: "orange" }, anim: "slam", exit: "down", top: "bold", topColor: "#ffffff", layout: "bar" }),
  lava: P({ label: "Dung nham", use: "điểm nóng, tranh cãi, căng thẳng", font: "heavy", upper: true, fill: { tex: "lava" }, anim: "rise", exit: "fall", top: "sign" }),
  question: P({ label: "Câu hỏi vàng", use: "câu hỏi, thắc mắc, có nên không", font: "anton", upper: true, fill: { tex: "yellow" }, anim: "bounce", exit: "shrink", top: "sign" }),
  // --- con số / dữ liệu ---
  bignumber: P({ label: "Số trắng cực lớn", use: "con số lớn, diện tích, số lượng", font: "anton", upper: true, fill: { solid: "#ffffff" }, anim: "pop", exit: "shrink", top: "sign", max: 320, lim: 9, layout: "side" }),
  cyanfigure: P({ label: "Số xanh cyan", use: "thông số, khoảng cách, thời gian di chuyển", font: "cond", upper: true, fill: { tex: "cyan" }, anim: "split", exit: "sweep", top: "light" }),
  limefigure: P({ label: "Số xanh chanh", use: "phần trăm, tăng trưởng, hiệu suất", font: "anton", upper: true, fill: { tex: "lime" }, anim: "pop", exit: "up", top: "sign", max: 300, lim: 9, layout: "side" }),
  goldnumber: P({ label: "Giá vàng lớn", use: "giá bán, tổng giá, mức đầu tư", font: "anton", upper: true, fill: { tex: "gold" }, anim: "zoom", exit: "shrink", top: "sign", shine: true, max: 300, lim: 10, layout: "underline" }),
  tealdata: P({ label: "Dữ liệu gõ chữ", use: "thông tin kỹ thuật, quy hoạch, pháp lý chi tiết", font: "geo", fill: { solid: "#3ff0d0" }, anim: "type", exit: "fade", top: "light", layout: "bar" }),
  countdown: P({ label: "Đếm ngược đỏ", use: "hạn chót, ngày mở bán, còn lại bao nhiêu", font: "anton", upper: true, fill: { tex: "ruby" }, anim: "slam", exit: "blur", top: "bold", topColor: "#ffffff", max: 300, lim: 10, layout: "inline" }),
  // --- neon / hiện đại ---
  neonpink: P({ label: "Neon hồng", use: "trẻ trung, giới trẻ, căn hộ studio", font: "retro", fill: { neon: "#ff4fd8" }, anim: "flicker", exit: "off", top: "heavy" }),
  neongreen: P({ label: "Neon xanh lá", use: "tiện ích, an toàn, đạt chuẩn", font: "geo", fill: { neon: "#39ff7a" }, anim: "flicker", exit: "off", top: "heavy", layout: "brackets" }),
  neongold: P({ label: "Neon vàng", use: "điểm nhấn đêm, phố đi bộ, kinh doanh", font: "cond", upper: true, fill: { neon: "#ffd23f" }, anim: "flicker", exit: "off", top: "sign", layout: "underline" }),
  neonpurple: P({ label: "Neon tím", use: "giải trí, nightlife, công nghệ", font: "geoLight", fill: { neon: "#b56bff" }, anim: "flicker", exit: "off", top: "heavy" }),
  neonwhite: P({ label: "Neon trắng", use: "tối giản, hiện đại, thông điệp ngắn", font: "brush", fill: { neon: "#ffffff" }, anim: "flicker", exit: "off", top: "heavy" }),
  neonred: P({ label: "Neon đỏ", use: "khuyến mãi, ưu đãi, chiết khấu", font: "anton", upper: true, fill: { neon: "#ff3b3b" }, anim: "flicker", exit: "off", top: "sign" }),
  // --- sạch / thông tin / kể chuyện ---
  cleanwhite: P({ label: "Trắng gọn", use: "thông tin chung, câu chuyển ý", font: "viet", upper: true, fill: { solid: "#ffffff" }, anim: "slideL", exit: "sweep", top: "light", layout: "left" }),
  magazine: P({ label: "Tạp chí", use: "câu chuyện, góc nhìn, chia sẻ", font: "serif", fill: { tex: "silverwhite" }, anim: "blur", exit: "blur", top: "sign", layout: "lines" }),
  typewriter: P({ label: "Máy đánh chữ", use: "định nghĩa, giải thích, khái niệm", font: "geo", fill: { solid: "#ffffff" }, anim: "type", exit: "fade", top: "light", layout: "left" }),
  stack: P({ label: "Trắng + vàng xếp tầng", use: "so sánh, trước/sau, A và B", font: "anton", upper: true, fill: { tex: "yellow" }, anim: "split", exit: "sweep", top: "bold", topColor: "#ffffff", lim: 10 }),
  handwritten: P({ label: "Viết tay trắng", use: "lời khuyên, tâm sự, kinh nghiệm", font: "brush", fill: { solid: "#ffffff" }, anim: "write", exit: "fade", top: "light", max: 190 }),
  retro: P({ label: "Retro cam vàng", use: "gia đình, vui vẻ, kỷ niệm", font: "retro", fill: { tex: "orange" }, anim: "bounce", exit: "shrink", top: "sign" }),
  headline: P({ label: "Tiêu đề tin tức", use: "tin tức, thông báo, cập nhật thị trường", font: "cond", upper: true, fill: { solid: "#ffffff" }, anim: "wipe", exit: "sweep", top: "bold", topColor: "#ffd23f", layout: "bar" }),
  pastel: P({ label: "Hồng phấn", use: "nội thất, decor, phòng ngủ", font: "viet", fill: { tex: "pastel" }, anim: "pop", exit: "shrink", top: "sign", layout: "brackets" }),
  silverserif: P({ label: "Bạc chữ có chân", use: "văn phòng, thương mại, doanh nghiệp", font: "serif", upper: true, fill: { tex: "chrome" }, anim: "track", exit: "blur", top: "light", shine: true, layout: "lines" }),
  ice: P({ label: "Băng", use: "mát mẻ, sạch sẽ, không gian thoáng", font: "heavy", upper: true, fill: { tex: "ice" }, anim: "blur", exit: "blur", top: "sign" }),
  concrete: P({ label: "Bê tông", use: "xây dựng, tiến độ, kết cấu", font: "anton", upper: true, fill: { tex: "concrete" }, anim: "slam", exit: "down", top: "bold", topColor: "#ffb300", layout: "bar" }),
  wood: P({ label: "Vân gỗ", use: "nội thất gỗ, ấm cúng, nhà phố", font: "heavy", upper: true, fill: { tex: "wood" }, anim: "rise", exit: "up", top: "sign" }),
  holo: P({ label: "Hologram", use: "công nghệ, nhà thông minh, số hoá", font: "heavy", upper: true, fill: { tex: "holo" }, anim: "wipe", exit: "sweep", top: "light", scroll: 1.2, layout: "brackets" }),
  investor: P({ label: "Lam + trắng tách đôi", use: "đầu tư, dòng tiền, cho thuê", font: "cond", upper: true, fill: { tex: "sapphire" }, anim: "split", exit: "sweep", top: "sign" }),
} satisfies Record<string, Preset>;

export type PresetStyle = keyof typeof PRESETS;
export const PRESET_STYLES = Object.keys(PRESETS) as PresetStyle[];

const ALL = [...BASE_STYLES, ...PRESET_STYLES] as const;
export const TEMPLATE_STYLES = ALL as unknown as readonly (BaseStyle | PresetStyle)[];
export type TemplateStyle = BaseStyle | PresetStyle;

/** tên + công dụng mỗi mẫu (giao diện + Claude chọn mẫu) */
export const TEMPLATE_INFO: Record<TemplateStyle, { label: string; use: string }> = {
  city: { label: "Mây tím (chữ ký)", use: "vị trí, khu vực, trung tâm" },
  bigyellow: { label: "Vàng cực lớn", use: "từ khoá / con số cực ngắn 1–2 chữ" },
  redbold: { label: "Đỏ đậm rơi chữ", use: "vấn đề, câu hỏi, cảnh báo, nỗi đau" },
  sea: { label: "Nước biển", use: "biển, sông, hồ, cảnh quan" },
  marble: { label: "Đá cẩm thạch", use: "tên dự án / sản phẩm" },
  luxgold: { label: "Vàng lá sang", use: "giá trị, đẳng cấp, kết luận đẹp" },
  neonsea: { label: "Neon xanh biển", use: "kết nối, khoảng cách, tiện ích, hiện đại" },
  orangegold: { label: "Cam + vàng", use: "pháp lý, quy định, bàn giao, chính sách" },
  ...(Object.fromEntries(Object.entries(PRESETS).map(([k, v]) => [k, { label: v.label, use: v.use }])) as Record<PresetStyle, { label: string; use: string }>),
};

/** viết hoa nhưng giữ đơn vị đo (m², km, ha) */
const upperKeepUnits = (t: string) =>
  t.toUpperCase().replace(/(\d)(\s?)(M²|M2|KM|HA)(?![A-ZÀ-Ỹ])/g, (_, d, sp, u) => d + sp + (u === "M2" ? "m²" : u.toLowerCase()));

// chất liệu sáng: thêm viền mảnh tối để không chìm trên tường / trời sáng
const LIGHT_TEX = new Set(["chrome", "champagne", "pearl", "ice", "concrete", "silverwhite", "mint", "pastel", "holo", "sky", "sand", "jade", "lime", "cyan"]);

/** nhóm mẫu (để chọn trong app) */
export const TEMPLATE_GROUPS: [string, TemplateStyle[]][] = [
  ["Gốc (8 mẫu đầu)", [...BASE_STYLES]],
  ["Sang trọng / giá trị", ["rosegold", "champagne", "platinum", "goldserif", "bronze", "copper", "pearl", "royal", "goldscript", "sapphire"]],
  ["Thiên nhiên / cảnh quan", ["emerald", "forest", "jade", "sky", "sunset", "lagoon", "ocean", "sand", "mint", "aurora"]],
  ["Cảnh báo / vấn đề", ["fire", "alarm", "ruby", "redseal", "warning", "lava", "question"]],
  ["Con số / dữ liệu", ["bignumber", "cyanfigure", "limefigure", "goldnumber", "tealdata", "countdown"]],
  ["Neon / hiện đại", ["neonpink", "neongreen", "neongold", "neonpurple", "neonwhite", "neonred"]],
  ["Sạch / thông tin / kể chuyện", ["cleanwhite", "magazine", "typewriter", "stack", "handwritten", "retro", "headline", "pastel", "silverserif", "ice", "concrete", "wood", "holo", "investor"]],
];

const mainCss = (f: FontKey, fs: number, upper?: boolean): React.CSSProperties => ({
  fontFamily: FONTS[f].family,
  fontWeight: FONTS[f].weight,
  fontSize: fs,
  lineHeight: FONTS[f].lh,
  whiteSpace: "pre",
  textTransform: "none",
  letterSpacing: f === "anton" || f === "cond" ? "0.005em" : "-0.01em",
  // chừa chỗ cho dấu tiếng Việt 2 tầng
  paddingTop: fs * 0.34,
  marginTop: -fs * 0.22,
});

const SOLID_SHADOW = "0 0 14px rgba(0,0,0,.45), 0 6px 12px rgba(0,0,0,.5)";
const fillCss = (fill: Fill, seed: string, frame: number, scroll = 0): React.CSSProperties => {
  if ("tex" in fill) {
    return {
      ...textFill(TEX2[fill.tex](seedNum(seed))),
      ...(LIGHT_TEX.has(fill.tex) ? { WebkitTextStroke: "2px rgba(40,40,50,.45)" } : {}),
      ...(scroll ? { backgroundSize: "160% 100%", backgroundPosition: `${(frame * scroll) % 100}% 50%` } : {}),
    };
  }
  if ("neon" in fill) {
    const c = fill.neon;
    return { color: c, textShadow: `0 0 10px ${c}, 0 0 26px ${c}cc, 0 0 54px ${c}88, 0 2px 4px rgba(0,0,0,.45)` };
  }
  return { color: fill.solid, textShadow: fill.solid.toLowerCase() === "#ffffff" ? HALO : SOLID_SHADOW };
};
const fillFilter = (fill: Fill) => ("tex" in fill ? SHADOW : "none");

/** dòng trên theo kiểu */
const TopLine: React.FC<{ kind: TopKind; text: string; fs: number; frame: number; color?: string; side?: "left" | "right" }> = ({ kind, text, fs, frame, color, side = "left" }) => {
  if (!text) return null;
  const p = eOut(prog(frame, 0, 16));
  if (kind === "sign") return <Signature text={text} fs={fs} p={eOut(prog(frame, 0, 20))} side={side} />;
  const base: React.CSSProperties = { whiteSpace: "pre", lineHeight: 1.05, position: "relative", zIndex: 2 };
  if (kind === "brush")
    return <div style={{ ...base, fontFamily: BrushFont, fontSize: fs, color: color ?? "#fff", textShadow: HALO, alignSelf: side === "left" ? "flex-start" : "flex-end", margin: `0 3% ${-fs * 0.2}px`, ...writeOn(p) }}>{text}</div>;
  if (kind === "light")
    return <div style={{ ...base, ...geo(fs, 300), color: color ?? "#fff", textShadow: HALO, opacity: p, transform: `translateY(${(1 - p) * -18}px)`, marginBottom: fs * 0.05 }}>{text}</div>;
  if (kind === "serif")
    return <div style={{ ...base, fontFamily: SerifFont, fontWeight: 900, fontSize: fs, letterSpacing: "0.08em", color: color ?? "#fff", textShadow: HALO, opacity: p }}>{text}</div>;
  if (kind === "retro")
    return <div style={{ ...base, fontFamily: RetroFont, fontSize: fs, color: color ?? "#fff", textShadow: HALO, opacity: p, transform: `rotate(-4deg) translateX(${(1 - p) * -60}px)`, alignSelf: "flex-start", marginLeft: "4%" }}>{text}</div>;
  if (kind === "heavy") {
    const punch = eBack(prog(frame, 0, 9));
    return (
      <div style={{ ...base, fontFamily: HeavyFont, fontWeight: 900, fontSize: fs, textTransform: "uppercase", letterSpacing: "-0.04em", paddingTop: fs * 0.3, marginTop: -fs * 0.2, color: color ?? "#fff", textShadow: HALO, transform: `scale(${1.6 - 0.6 * punch})`, opacity: prog(frame, 0, 4), marginBottom: -fs * 0.1 }}>
        {text}
      </div>
    );
  }
  // bold: chữ hình học đậm, màu, vào từ trái
  return (
    <div style={{ ...base, ...geo(fs, 700), textTransform: "uppercase", letterSpacing: "-0.01em", color: color ?? "#ff8a1f", textShadow: "0 0 16px rgba(0,0,0,.8), 0 0 5px rgba(0,0,0,.6)", alignSelf: "flex-start", marginLeft: "2%", transform: `translateX(${(1 - p) * -240}px)`, opacity: p }}>
      {text}
    </div>
  );
};

const topSize = (kind: TopKind, text: string, fs: number) => {
  switch (kind) {
    case "sign":
      return fit(text, SignFont, 400, fs * 1.8, W * 0.62, 0.3);
    case "brush":
      return fit(text, BrushFont, 400, fs * 0.8, W * 0.7, 0.45);
    case "light":
      return fit(text, GeoFont, 300, Math.max(58, fs * 0.5), W * 0.85, 0.5);
    case "serif":
      return fit(text, SerifFont, 900, Math.max(40, fs * 0.36), W * 0.8, 0.7);
    case "retro":
      return fit(text, RetroFont, 400, fs * 0.62, W * 0.7, 0.5);
    case "heavy":
      return fit(text.toUpperCase(), HeavyFont, 900, fs * 0.6, W * 0.75, 0.62);
    default:
      return fit(text.toUpperCase(), GeoFont, 700, Math.max(46, fs * 0.5), W * 0.75, 0.66);
  }
};

const LETTER_ANIMS: Anim[] = ["drop", "wave", "type", "bounce"];

const accentOf = (fill: Fill): string => {
  if ("neon" in fill) return fill.neon;
  if ("solid" in fill) return fill.solid.toLowerCase() === "#ffffff" ? "#ffd23f" : fill.solid;
  const map: Record<string, string> = {
    rosegold: "#f0ab95", chrome: "#dfe4ea", champagne: "#f4e0b2", bronze: "#d79a5a", copper: "#e0864e", pearl: "#f3eaff",
    amethyst: "#b77bff", emerald: "#2fd58f", forest: "#6fd35a", jade: "#8fe3c0", sky: "#5ab4ff", sunset: "#ff7a55",
    lagoon: "#19c3c9", sapphire: "#4d94ff", sand: "#f1d39a", mint: "#52e3b0", aurora: "#43d7ff", fire: "#ff8a1f",
    lava: "#ff4a1f", ruby: "#ff2a4d", ice: "#8fd8ff", concrete: "#d0d0cc", wood: "#d99a55", holo: "#c8b6ff",
    lime: "#c4f53a", cyan: "#3fdcf5", pastel: "#ffb6c9", orange: "#ffa020", gold: "#f0c14b", yellow: "#ffe03a", silverwhite: "#ffffff",
  };
  return map[fill.tex] ?? "#ffd23f";
};

const PresetBody = (cfg: Preset): React.FC<TemplateParts> =>
  function Body({ frame, total, top, main, sub, seed, layout: layoutProp }) {
    const layout: Layout = (LAYOUTS as readonly string[]).includes(layoutProp ?? "") ? (layoutProp as Layout) : cfg.layout ?? "center";
    const F = FONTS[cfg.font];
    const txt = cfg.upper ? upperKeepUnits(main) : main;
    const zig = layout === "zigzag";
    const m = zig ? txt.trim().split(/\s+/).join("\n") : balance(txt, cfg.lim ?? (cfg.font === "anton" || cfg.font === "cond" ? 12 : 10));
    // bề ngang dành cho chữ chính theo bố cục
    const mW = layout === "side" ? W * 0.6 : layout === "inline" ? W * 0.66 : zig ? W * 0.72 : layout === "bar" ? W - 40 : W;
    const fs = fit(m, F.family, F.weight, (cfg.max ?? 210) * (zig ? 0.62 : 1), mW, F.per);
    const tfs = layout === "side" || layout === "inline" ? fit(top, GeoFont, 700, Math.max(56, fs * 0.42), W * 0.34, 0.62) : topSize(cfg.top, top, fs);
    const subFs = fit(sub, GeoFont, 600, Math.min(60, Math.max(40, fs * 0.36)), layout === "side" ? W * 0.36 : W * 0.85, 0.6);
    const ex = eIn(prog(frame, total - OUT, total - 1));
    const accent = accentOf(cfg.fill);
    const align: React.CSSProperties["textAlign"] = layout === "left" || layout === "bar" ? "left" : layout === "right" ? "right" : "center";
    const mStyle: React.CSSProperties = { ...mainCss(cfg.font, fs, cfg.upper), ...fillCss(cfg.fill, seed, frame, cfg.scroll), textAlign: align };

    // ---- hiệu ứng ra (khối ngoài)
    let outer: React.CSSProperties = {};
    let neonK = 1;
    switch (cfg.exit) {
      case "up":
        outer = { transform: `translateY(${-ex * 110}px)`, opacity: 1 - ex, filter: `blur(${ex * 6}px)` };
        break;
      case "shrink":
        outer = { transform: `scale(${1 - ex * 0.45})`, opacity: 1 - ex };
        break;
      case "sweep":
        outer = { clipPath: `inset(-40% ${ex * 105}% -40% -8%)` };
        break;
      case "blur":
        outer = { filter: `blur(${ex * 14}px)`, opacity: 1 - ex };
        break;
      case "fall":
        outer = { transform: `translateY(${ex * 170}px) rotate(${ex * 5}deg)`, opacity: 1 - ex };
        break;
      case "down":
        outer = { transform: `translateY(${ex * 90}px)`, opacity: 1 - ex };
        break;
      case "fade":
        outer = { opacity: 1 - ex };
        break;
      case "off": {
        const offStart = total - OUT;
        neonK = frame < offStart ? 1 : random(`o-${seed}-${frame}`) > prog(frame, offStart, total - 2) ? 0.9 : 0.1;
        neonK *= 1 - prog(frame, total - 4, total - 1);
        break;
      }
    }

    // ---- hiệu ứng vào cho chữ chính
    const lines = m.split("\n");
    const lineAlign = (li: number): React.CSSProperties["justifyContent"] =>
      zig ? (li % 2 ? "flex-end" : "flex-start") : align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center";
    let mainEl: React.ReactNode;
    if (LETTER_ANIMS.includes(cfg.anim)) {
      let k = 0;
      const nChars = Array.from(m.replace(/\n/g, "")).length;
      mainEl = lines.map((line, li) => (
        <div key={li} style={{ ...mainCss(cfg.font, fs, cfg.upper), display: "flex", justifyContent: lineAlign(li), filter: fillFilter(cfg.fill) }}>
          {Array.from(line).map((ch) => {
            const i = k++;
            let st: React.CSSProperties = {};
            if (cfg.anim === "drop") {
              const pin = eBack(prog(frame, 2 + i * 1.2, 12 + i * 1.2));
              st = { opacity: prog(frame, 2 + i * 1.2, 6 + i * 1.2), transform: `translateY(${(1 - pin) * -90}px) rotate(${(1 - pin) * (i % 2 ? 8 : -8)}deg)` };
            } else if (cfg.anim === "wave") {
              const pin = eOut(prog(frame, 2 + i * 0.9, 14 + i * 0.9));
              st = { opacity: pin, transform: `translateY(${(1 - pin) * 60 + Math.sin(frame / 7 + i * 0.7) * 4}px)` };
            } else if (cfg.anim === "bounce") {
              const pin = eBack(prog(frame, 1 + i * 0.8, 10 + i * 0.8));
              st = { opacity: prog(frame, 1 + i * 0.8, 4 + i * 0.8), transform: `scale(${pin})`, transformOrigin: "50% 80%" };
            } else {
              const at = 2 + (i / Math.max(1, nChars)) * 22;
              st = { opacity: frame >= at ? 1 : 0 };
            }
            return (
              <span key={i} style={{ display: "inline-block", whiteSpace: "pre", paddingTop: fs * 0.34, marginTop: -fs * 0.34, ...fillCss(cfg.fill, seed, frame, cfg.scroll), ...st }}>
                {ch}
              </span>
            );
          })}
          {cfg.anim === "type" && li === lines.length - 1 && frame < 2 + 22 + 18 ? (
            <span style={{ display: "inline-block", width: fs * 0.08, marginLeft: fs * 0.06, height: fs * 0.8, alignSelf: "center", background: "#fff", boxShadow: "0 0 8px rgba(0,0,0,.6)", opacity: Math.floor(frame / 8) % 2 ? 0 : 1 }} />
          ) : null}
        </div>
      ));
    } else if ((cfg.anim === "split" || zig) && lines.length > 1) {
      mainEl = lines.map((line, li) => {
        const p = eOut(prog(frame, 2 + li * 4, 14 + li * 4));
        const dir = li % 2 ? 1 : -1;
        const fillL: Fill = cfg.anim === "split" && !(li % 2) ? { solid: "#ffffff" } : cfg.fill;
        return (
          <div key={li} style={{ display: "flex", justifyContent: lineAlign(li) }}>
            <div style={{ ...mainCss(cfg.font, fs, cfg.upper), ...fillCss(fillL, seed, frame, cfg.scroll), filter: fillFilter(fillL), transform: `translateX(${(1 - p) * dir * 320}px)`, opacity: p }}>
              {line}
            </div>
          </div>
        );
      });
    } else {
      const p = (a: number, b: number) => eOut(prog(frame, a, b));
      let wrap: React.CSSProperties = {};
      let inner: React.CSSProperties = {};
      let extraLetter: React.CSSProperties = {};
      switch (cfg.anim) {
        case "rise":
          wrap = { clipPath: "inset(-60% -10% 0 -10%)", padding: "0 10px" };
          inner = { transform: `translateY(${(1 - p(2, 15)) * 105}%)` };
          break;
        case "pop":
          inner = { transform: `scale(${1.5 - 0.5 * eBack(prog(frame, 0, 12))})`, opacity: prog(frame, 0, 5) };
          break;
        case "zoom": {
          const q = p(0, 14);
          inner = { transform: `scale(${0.6 + 0.4 * q})`, opacity: q, filter: `blur(${(1 - q) * 8}px)` };
          break;
        }
        case "blur": {
          const q = p(0, 16);
          inner = { opacity: q, filter: `blur(${(1 - q) * 14}px)`, transform: `scale(${1.08 - 0.08 * q})` };
          break;
        }
        case "track": {
          const q = p(0, 20);
          extraLetter = { letterSpacing: `${(1 - q) * 0.25 - 0.01}em`, marginRight: `${(1 - q) * 0.25}em` };
          inner = { filter: `blur(${(1 - q) * 10}px)`, opacity: prog(frame, 0, 8) };
          break;
        }
        case "wipe":
          inner = { clipPath: `inset(-60% ${(1 - p(2, 18)) * 100}% -60% -5%)` };
          break;
        case "slideL":
        case "split":
          inner = { transform: `translateX(${(1 - p(2, 14)) * -300}px)`, opacity: p(2, 10) };
          break;
        case "slideR":
          inner = { transform: `translateX(${(1 - p(2, 14)) * 300}px)`, opacity: p(2, 10) };
          break;
        case "slam": {
          const q = p(0, 7);
          const shake = Math.sin(frame * 2.2) * 7 * (1 - prog(frame, 7, 15)) * (frame >= 7 ? 1 : 0);
          inner = { transform: `translateX(${shake}px) scale(${2.2 - 1.2 * q})`, opacity: prog(frame, 0, 3) };
          break;
        }
        case "shake": {
          const shake = Math.sin(frame * 2.4) * 10 * (1 - prog(frame, 2, 16));
          inner = { transform: `translateX(${shake}px)`, opacity: prog(frame, 0, 4) };
          break;
        }
        case "stamp": {
          const q = p(0, 8);
          inner = { transform: `scale(${1.8 - 0.8 * q}) rotate(${-10 + 7 * q}deg)`, opacity: prog(frame, 0, 4) };
          break;
        }
        case "write":
          inner = writeOn(p(0, 24), 8);
          break;
        case "flicker": {
          const on = frame < 4 ? 0 : frame < 18 ? (random(`n-${seed}-${frame}`) > 0.4 ? 1 : 0.15) : 1;
          inner = { opacity: on };
          break;
        }
      }
      const { filter: innerFilter, ...innerRest } = inner;
      const style: React.CSSProperties = { ...mStyle, ...extraLetter, filter: [fillFilter(cfg.fill), innerFilter].filter((x) => x && x !== "none").join(" ") || "none" };
      mainEl = (
        <div style={wrap}>
          <div style={{ position: "relative", ...innerRest }}>
            <div style={style}>{m}</div>
            {cfg.shine ? <Shine text={m} style={{ ...mainCss(cfg.font, fs, cfg.upper), ...extraLetter, textAlign: align }} p={prog(frame, 16, 36)} /> : null}
          </div>
        </div>
      );
    }

    const subEl = sub ? (
      <div style={{ ...geo(subFs, 500), color: cfg.subColor ?? "#fff", opacity: eOut(prog(frame, 14, 24)), textShadow: HALO, marginTop: fs * 0.04, textAlign: align }}>{sub}</div>
    ) : null;
    const smallTop = (t: string, fsz: number, al: "left" | "right" | "center" = "left") =>
      t ? (
        <div style={{ ...geo(fsz, 700), textTransform: "uppercase", color: accent, textShadow: "0 0 14px rgba(0,0,0,.8), 0 0 4px rgba(0,0,0,.6)", opacity: eOut(prog(frame, 0, 12)), textAlign: al, lineHeight: 1.05, paddingTop: fsz * 0.25 }}>{t}</div>
      ) : null;
    const colStyle: React.CSSProperties = { ...outer, opacity: ((outer.opacity as number | undefined) ?? 1) * neonK };
    const grow = eOut(prog(frame, 0, 14));

    if (layout === "inline" || layout === "side") {
      // 2 cột: inline = [dòng trên | chữ chính]; side = [chữ chính | dòng trên + dòng dưới]
      const left = layout === "inline" ? <div style={{ maxWidth: W * 0.34, marginRight: 18 }}>{smallTop(top, tfs, "right")}</div> : mainEl;
      const right =
        layout === "inline" ? (
          mainEl
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", marginLeft: 22, maxWidth: W * 0.38, borderLeft: `${Math.max(4, fs * 0.04)}px solid ${accent}`, paddingLeft: 18, clipPath: `inset(0 ${(1 - grow) * 100}% 0 0)` }}>
            {smallTop(top, tfs)}
            {sub ? <div style={{ ...geo(subFs, 500), color: "#fff", textShadow: HALO, lineHeight: 1.15 }}>{sub}</div> : null}
          </div>
        );
      return (
        <Col style={colStyle}>
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
            {left}
            {right}
          </div>
          {layout === "inline" ? subEl : null}
        </Col>
      );
    }

    const sideTop = layout === "right" ? "right" : cfg.topSide ?? "left";
    const topEl =
      layout === "lines" && top ? (
        <div style={{ display: "flex", alignItems: "center", gap: 18, opacity: eOut(prog(frame, 0, 12)) }}>
          <div style={{ width: 90 * grow, height: Math.max(3, tfs * 0.06), background: accent, boxShadow: "0 0 8px rgba(0,0,0,.5)" }} />
          <TopLine kind={cfg.top === "sign" ? "light" : cfg.top} text={top} fs={cfg.top === "sign" ? fit(top, GeoFont, 300, Math.max(58, fs * 0.5), W * 0.6, 0.5) : tfs} frame={frame} color={cfg.topColor} />
          <div style={{ width: 90 * grow, height: Math.max(3, tfs * 0.06), background: accent, boxShadow: "0 0 8px rgba(0,0,0,.5)" }} />
        </div>
      ) : (
        <TopLine kind={cfg.top} text={top} fs={tfs} frame={frame} color={cfg.topColor} side={sideTop} />
      );

    let body: React.ReactNode = zig ? <div style={{ width: Math.min(mW, W * 0.62), display: "flex", flexDirection: "column" }}>{mainEl}</div> : mainEl;
    if (layout === "brackets") {
      const L = Math.max(30, fs * 0.38);
      const t = Math.max(4, fs * 0.05);
      const c = (pos: React.CSSProperties, b: React.CSSProperties) => (
        <div style={{ position: "absolute", width: L * grow, height: L * grow, ...pos, ...b, filter: "drop-shadow(0 0 6px rgba(0,0,0,.5))" }} />
      );
      body = (
        <div style={{ position: "relative", padding: `${fs * 0.12}px ${fs * 0.22}px` }}>
          {c({ left: 0, top: 0 }, { borderLeft: `${t}px solid ${accent}`, borderTop: `${t}px solid ${accent}` })}
          {c({ right: 0, top: 0 }, { borderRight: `${t}px solid ${accent}`, borderTop: `${t}px solid ${accent}` })}
          {c({ left: 0, bottom: 0 }, { borderLeft: `${t}px solid ${accent}`, borderBottom: `${t}px solid ${accent}` })}
          {c({ right: 0, bottom: 0 }, { borderRight: `${t}px solid ${accent}`, borderBottom: `${t}px solid ${accent}` })}
          {mainEl}
        </div>
      );
    } else if (layout === "underline") {
      body = (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          {mainEl}
          <div style={{ alignSelf: "stretch", height: Math.max(5, fs * 0.06), marginTop: fs * 0.04, background: `linear-gradient(90deg, ${accent}, ${accent}cc)`, boxShadow: "0 0 10px rgba(0,0,0,.5)", clipPath: `inset(0 ${(1 - eOut(prog(frame, 10, 24))) * 100}% 0 0)` }} />
        </div>
      );
    } else if (layout === "bar") {
      body = (
        <div style={{ display: "flex", flexDirection: "row", alignItems: "stretch" }}>
          <div style={{ width: Math.max(6, fs * 0.07), marginRight: fs * 0.12, background: accent, boxShadow: "0 0 10px rgba(0,0,0,.5)", clipPath: `inset(${(1 - grow) * 100}% 0 0 0)` }} />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
            {topEl}
            {mainEl}
            {subEl}
          </div>
        </div>
      );
      return <Col style={colStyle}>{body}</Col>;
    }

    const colAlign = layout === "left" ? "flex-start" : layout === "right" ? "flex-end" : "center";
    return (
      <Col style={{ ...colStyle, alignItems: colAlign }}>
        {topEl}
        {body}
        {subEl}
      </Col>
    );
  };

export const TEMPLATE_BODIES: Record<TemplateStyle, React.FC<TemplateParts>> = {
  ...BASE_BODIES,
  ...(Object.fromEntries(Object.entries(PRESETS).map(([k, v]) => [k, PresetBody(v)])) as Record<PresetStyle, React.FC<TemplateParts>>),
};

/** tiếng đi kèm (giây tính từ lúc chữ hiện) — khớp nhịp hình */
export function templateSounds(style: TemplateStyle, fps = 30): { id: string; at: number; volume: number }[] {
  if ((BASE_STYLES as readonly string[]).includes(style)) return baseSounds(style as BaseStyle, fps);
  const cfg = PRESETS[style as PresetStyle];
  const f = (n: number) => n / fps;
  const tail = cfg.shine ? [{ id: "cn-shimmer.mp3", at: f(16), volume: 0.4 }] : [];
  switch (cfg.anim) {
    case "rise":
    case "wipe":
    case "slideL":
    case "slideR":
    case "split":
      return [{ id: "cn-whoosh-soft.mp3", at: 0, volume: 0.5 }, ...(tail.length ? tail : [{ id: "kn-pluck.mp3", at: f(14), volume: 0.3 }])];
    case "pop":
    case "zoom":
    case "bounce":
      return [{ id: "cn-whoosh-fast.mp3", at: -0.1, volume: 0.5 }, { id: "impact-hit-3.mp3", at: f(3), volume: 0.35 }, ...tail];
    case "slam":
    case "stamp":
      return [{ id: "cn-whoosh-fast.mp3", at: -0.1, volume: 0.45 }, { id: "cn-stamp.mp3", at: f(6), volume: 0.45 }];
    case "drop":
      return [{ id: "cn-whoosh-fast.mp3", at: -0.05, volume: 0.45 }, { id: "cn-stamp.mp3", at: f(12), volume: 0.45 }];
    case "type":
      return [{ id: "cn-typing-14.mp3", at: f(2), volume: 0.45 }];
    case "flicker":
      return [{ id: "cn-click.mp3", at: 0, volume: 0.55 }, { id: "cn-neon.mp3", at: f(4), volume: 0.45 }];
    case "blur":
    case "track":
      return [{ id: "cn-riser.mp3", at: f(16) - 0.7, volume: 0.35 }, { id: "kn-select.mp3", at: f(16), volume: 0.4 }, ...tail];
    case "write":
      return [{ id: "cn-whoosh-soft.mp3", at: 0, volume: 0.45 }, { id: "cn-ting.mp3", at: f(22), volume: 0.3 }];
    case "shake":
      return [{ id: "cn-whoosh-fast.mp3", at: -0.05, volume: 0.45 }, { id: "impact-hit-1.mp3", at: f(2), volume: 0.35 }];
    case "wave":
      return [{ id: "cn-whoosh-soft.mp3", at: 0, volume: 0.5 }, { id: "kn-pluck.mp3", at: f(14), volume: 0.3 }];
  }
  return [];
}
