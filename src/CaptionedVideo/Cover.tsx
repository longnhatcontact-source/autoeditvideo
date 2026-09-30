import React, { useEffect, useState } from "react";
import {
  AbsoluteFill,
  cancelRender,
  Img,
  Sequence,
  staticFile,
  useDelayRender,
} from "remotion";
import { z } from "zod";
import { loadFont, ScriptFont, TheBoldFont } from "../load-font";
import { CalloutView, splitHook } from "./Callouts";

/**
 * Ảnh bìa video (1080×1920, xuất 1 khung hình): tiêu đề cùng bộ chữ với video,
 * vài cảnh tiêu biểu có nhãn, dòng giá / vị trí.
 * Nội dung chính nằm trong vùng y 240–1680 để lưới trang cá nhân TikTok (cắt 3:4) vẫn thấy đủ.
 */
export const coverSchema = z.object({
  title: z.string(), // "*chữ*" = chữ đậm chính, phần trước/sau = chữ viết tay
  titleStyle: z.enum(["red", "neon", "gold"]),
  background: z.string(),
  scenes: z.array(z.object({ src: z.string(), label: z.string() })).max(4),
  footer: z.string(),
  footerStrong: z.string(),
  // kiểu "ảnh": không có cảnh, nền là ảnh rõ nét (vd khuôn mặt người nói), tiêu đề + vài ý ở nửa dưới
  points: z.array(z.string()).max(4).optional(),
});
type Props = z.infer<typeof coverSchema>;

const src = (s: string) =>
  /^(https?:|data:|blob:|\/)/.test(s) ? s : staticFile(s);
const GOLD = "#FFD23F";

// khung hình tĩnh: các hiệu ứng chữ đã chạy xong ở frame này
export const COVER_FRAME = 90;
export const COVER_DURATION = 120;

export const Cover: React.FC<Props> = ({
  title,
  titleStyle,
  background,
  scenes,
  footer,
  footerStrong,
  points = [],
}) => {
  const photo = scenes.length === 0;
  // chờ font tải xong mới chụp, nếu không chữ sẽ ra font dự phòng
  const { delayRender, continueRender } = useDelayRender();
  const [handle] = useState(() => delayRender("Tải font ảnh bìa"));
  const [ready, setReady] = useState(false);
  useEffect(() => {
    loadFont()
      .then(() => {
        setReady(true);
        continueRender(handle);
      })
      .catch((e) => cancelRender(e));
  }, [continueRender, handle]);
  const n = Math.max(1, scenes.length);
  const top = 650;
  const bottom = 1670;
  const gap = 22;
  const h = (bottom - top - gap * (n - 1)) / n;

  return (
    <AbsoluteFill style={{ backgroundColor: "#0b0b10" }}>
      {background ? (
        <Img
          src={src(background)}
          style={{
            position: "absolute",
            inset: -60,
            width: 1200,
            height: 2040,
            objectFit: "cover",
            filter: photo ? "none" : "blur(28px) brightness(0.6)",
          }}
        />
      ) : null}
      <AbsoluteFill
        style={{
          background: photo
            ? "linear-gradient(180deg, rgba(0,0,0,.25) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,.55) 55%, rgba(0,0,0,.85) 100%)"
            : "linear-gradient(180deg, rgba(0,0,0,.55) 0%, rgba(0,0,0,.1) 40%, rgba(0,0,0,.6) 100%)",
        }}
      />

      {/* tiêu đề (đo cỡ chữ sau khi font đã tải) */}
      {ready ? (
        <Sequence layout="none" durationInFrames={COVER_DURATION}>
          <CalloutView
            c={{
              at: 0,
              sec: 0,
              style: titleStyle,
              x: 0.5,
              y: photo ? 0.6 : 0.205,
              scale: 1.05,
              ...splitHook(title),
            }}
          />
        </Sequence>
      ) : null}

      {/* kiểu ảnh: vài ý chính dưới tiêu đề */}
      {photo && points.length ? (
        <div
          style={{
            position: "absolute",
            left: 70,
            right: 70,
            top: 1440,
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          {points.map((p, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 18,
                fontFamily: TheBoldFont,
                fontWeight: 800,
                fontSize: 46,
                color: "#fff",
                textShadow: "0 3px 10px rgba(0,0,0,.85)",
              }}
            >
              <span
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 999,
                  background: GOLD,
                  flexShrink: 0,
                  boxShadow: "0 0 14px rgba(255,210,63,.8)",
                }}
              />
              {p}
            </div>
          ))}
        </div>
      ) : null}

      {/* các cảnh tiêu biểu */}
      {scenes.map((s, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: 40,
            width: 1000,
            top: top + i * (h + gap),
            height: h,
            borderRadius: 26,
            overflow: "hidden",
            border: "4px solid rgba(255,210,120,.85)",
            boxShadow: "0 18px 50px rgba(0,0,0,.55)",
          }}
        >
          <Img
            src={src(s.src)}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: "55%",
              background:
                "linear-gradient(180deg, transparent, rgba(0,0,0,.78))",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 26,
              bottom: 20,
              right: 26,
              display: "flex",
              alignItems: "center",
              gap: 16,
            }}
          >
            <span
              style={{
                fontFamily: TheBoldFont,
                fontWeight: 900,
                fontSize: 40,
                color: "#1b1206",
                background: GOLD,
                borderRadius: 999,
                width: 58,
                height: 58,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {i + 1}
            </span>
            <span
              style={{
                fontFamily: TheBoldFont,
                fontWeight: 800,
                fontSize: 46,
                color: "#fff",
                lineHeight: 1.1,
                textShadow: "0 3px 10px rgba(0,0,0,.8)",
              }}
            >
              {s.label}
            </span>
          </div>
        </div>
      ))}

      {/* giá / vị trí */}
      {footer || footerStrong ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 1700,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              padding: "18px 40px",
              borderRadius: 999,
              background: "rgba(20,12,8,.78)",
              border: "3px solid rgba(255,210,120,.8)",
              display: "flex",
              alignItems: "baseline",
              gap: 18,
            }}
          >
            {footer ? (
              <span
                style={{
                  fontFamily: ScriptFont,
                  fontWeight: 700,
                  fontSize: 52,
                  color: "#fff",
                }}
              >
                {footer}
              </span>
            ) : null}
            {footerStrong ? (
              <span
                style={{
                  fontFamily: TheBoldFont,
                  fontWeight: 900,
                  fontSize: 56,
                  color: GOLD,
                }}
              >
                {footerStrong}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
