import type { Caption } from "@remotion/captions";
import { keepPhrases, makePages, pageEndMs, ZOOM_SCALE, zoomMoments } from "../../lib/captions-core.mjs";
import { Audio, Video } from "@remotion/media";
import { getVideoMetadata } from "@remotion/media-utils";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AbsoluteFill,
  CalculateMetadataFunction,
  cancelRender,
  Easing,
  interpolate,
  Sequence,
  useCurrentFrame,
  staticFile,
  useDelayRender,
  useVideoConfig,
} from "remotion";
import { z } from "zod";
import { loadFont } from "../load-font";
import { BlurBoxes } from "./BlurBoxes";
import { CALLOUT_STYLES, CalloutAudio, Callouts, splitHook } from "./Callouts";
import { Brand } from "./Brand";
import { Hook } from "./Hook";
import { InfoOverlay } from "./InfoOverlay";
import { Overlays } from "./Overlays";
import { subtitleFontSize } from "./Page";
import SubtitlePage from "./SubtitlePage";

const captionSchema = z.object({
  text: z.string(),
  startMs: z.number(),
  endMs: z.number(),
  timestampMs: z.number().nullable(),
  confidence: z.number().nullable(),
});

export const captionedVideoSchema = z.object({
  src: z.string(),
  tenDuAn: z.string(),
  gia: z.string(),
  dienTich: z.string(),
  phongNgu: z.string(),
  diaChi: z.string(),
  // null = đọc file .json cạnh video (dùng trong Remotion Studio)
  captions: z.array(captionSchema).nullable(),
  musicSrc: z.string(),
  musicVolume: z.number().min(0).max(1),
  musicDuck: z.boolean(),
  sfx: z.array(z.object({ src: z.string(), at: z.number(), volume: z.number() })),
  // tiếng đi kèm chữ nhấn / tiêu đề theo từng kiểu chữ (gõ phím, vút, pop...): URL thư mục SFX ("" = public/sfx) + âm lượng (0 = tắt)
  sfxBase: z.string().optional(),
  calloutSfx: z.number().min(0).max(1).optional(),
  durationInFrames: z.number().nullable(),
  // cụm chữ không được ngắt xuống câu khác (tên dự án...)
  keepTogether: z.array(z.string()),
  // vùng làm mờ (0..1), vd che số điện thoại có sẵn trong clip
  blurs: z.array(z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() })),
  // tiêu đề mở đầu; "*chữ*" = tô vàng; text rỗng = không có
  hookText: z.string(),
  hookSec: z.number().min(0),
  // kiểu chữ + vị trí tiêu đề (dùng chung bộ chữ với chữ nhấn)
  hookStyle: z.enum(CALLOUT_STYLES),
  hookX: z.number(),
  hookY: z.number(),
  hookScale: z.number(),
  // độ sáng nền sau tiêu đề (app tự đo); nền sáng -> chữ có viền tối
  hookBg: z.number().optional(),
  // tên kênh / logo; cả 2 rỗng = không hiện
  brandText: z.string(),
  brandLogoSrc: z.string(),
  brandPosition: z.enum(["duoi-video", "tren-phai", "tren-trai"]),
  // kiểu phụ đề: màu chữ đang đọc, vị trí, có hộp nền không
  subHighlight: z.string(),
  subPosition: z.enum(["thap", "cao"]),
  subBox: z.boolean(),
  // zoom nhẹ ở câu có số liệu / đầu ý mới
  punchZoom: z.boolean(),
  // ảnh / clip minh hoạ chèn lên (giây bắt đầu + thời lượng)
  overlays: z.array(z.object({ src: z.string(), at: z.number(), sec: z.number(), kind: z.enum(["image", "video"]) })),
  // chữ nhấn: chữ hiệu ứng lớn ở đoạn quan trọng (xem Callouts.tsx)
  callouts: z.array(
    z.object({
      at: z.number(),
      sec: z.number(),
      style: z.enum(CALLOUT_STYLES),
      top: z.string(),
      main: z.string(),
      sub: z.string(),
      x: z.number(),
      y: z.number(),
      scale: z.number(),
      bg: z.number().optional(),
    }),
  ),
});

type Props = z.infer<typeof captionedVideoSchema>;

const FPS = 30;
const SUB_DELAY_MS = 150;

// Cho phép gõ tên file trong public/ (vd "nha1.mp4") hoặc URL đầy đủ
const resolveSrc = (s: string) => (/^(https?:|data:|blob:|\/)/.test(s) ? s : staticFile(s));

export const calculateCaptionedVideoMetadata: CalculateMetadataFunction<Props> = async ({ props }) => {
  if (props.durationInFrames) {
    return { fps: FPS, durationInFrames: props.durationInFrames };
  }
  const metadata = await getVideoMetadata(resolveSrc(props.src));
  // trừ 1 frame cuối cho chắc không đọc quá cuối video
  return { fps: FPS, durationInFrames: Math.max(1, Math.floor(metadata.durationInSeconds * FPS) - 1) };
};

// Âm lượng nhạc nền từng frame: vặn nhỏ khi đang có tiếng nói, tăng/giảm mượt 0.3s
function useMusicVolumes(captions: Caption[], total: number, base: number, duck: boolean) {
  return useMemo(() => {
    const vols = new Float32Array(total).fill(base);
    if (!duck || !captions.length) return vols;
    // video đã cắt im lặng nên gần như lúc nào cũng có tiếng nói: chỉ hạ 1 nửa, không hạ sâu
    const low = base * 0.5;
    const speaking = new Uint8Array(total);
    for (const c of captions) {
      const a = Math.max(0, Math.floor(((c.startMs - 150) / 1000) * FPS));
      const b = Math.min(total, Math.ceil(((c.endMs + 350) / 1000) * FPS));
      speaking.fill(1, a, b);
    }
    const ramp = 0.3 * FPS;
    let cur = speaking[0] ? low : base;
    for (let f = 0; f < total; f++) {
      const target = speaking[f] ? low : base;
      const step = (base - low) / ramp;
      cur = cur < target ? Math.min(target, cur + step) : Math.max(target, cur - step);
      vols[f] = cur;
    }
    return vols;
  }, [captions, total, base, duck]);
}

export const CaptionedVideo: React.FC<Props> = ({
  src: srcProp,
  tenDuAn,
  gia,
  dienTich,
  phongNgu,
  diaChi,
  captions: captionsProp,
  musicSrc,
  musicVolume,
  musicDuck,
  sfx,
  sfxBase = "",
  calloutSfx = 0.8,
  keepTogether,
  blurs,
  hookText,
  hookSec,
  hookStyle,
  hookX,
  hookY,
  hookScale,
  hookBg,
  brandText,
  brandLogoSrc,
  brandPosition,
  subHighlight,
  subPosition,
  subBox,
  punchZoom,
  overlays,
  callouts,
}) => {
  const frame = useCurrentFrame();
  const subStyle = useMemo(
    () => ({ highlight: subHighlight, position: subPosition, box: subBox }),
    [subHighlight, subPosition, subBox],
  );
  const hookFrames = hookText.trim() ? Math.round(hookSec * FPS) : 0;
  const src = resolveSrc(srcProp);
  const [fileCaptions, setFileCaptions] = useState<Caption[]>([]);
  const [fontReady, setFontReady] = useState(false);
  const { delayRender, continueRender } = useDelayRender();
  const [handle] = useState(() => delayRender("Tải font + phụ đề"));
  const { fps, durationInFrames, width } = useVideoConfig();

  const subtitlesFile = src.replace(/\.(mp4|mkv|mov|webm)$/, ".json");

  const load = useCallback(async () => {
    try {
      await loadFont();
      setFontReady(true);
      if (!captionsProp) {
        const res = await fetch(subtitlesFile);
        setFileCaptions(res.ok ? ((await res.json()) as Caption[]) : []);
      }
      continueRender(handle);
    } catch (e) {
      cancelRender(e);
    }
  }, [captionsProp, continueRender, handle, subtitlesFile]);

  useEffect(() => {
    load();
  }, [load]);

  // whisper hay đánh dấu chữ sớm hơn lời nói một chút -> lùi phụ đề 150ms cho khớp miệng
  const rawCaptions = captionsProp ?? fileCaptions;
  const captions = useMemo(
    () =>
      rawCaptions.map((c) => ({
        ...c,
        startMs: c.startMs + SUB_DELAY_MS,
        endMs: c.endMs + SUB_DELAY_MS,
        timestampMs: c.timestampMs == null ? null : c.timestampMs + SUB_DELAY_MS,
      })),
    [rawCaptions],
  );

  const pages = useMemo(() => makePages(captions, keepPhrases(keepTogether)), [captions, keepTogether]);
  // đo sau khi font đã tải, nếu không sẽ đo bằng font dự phòng
  const subSize = useMemo(() => (fontReady ? subtitleFontSize(pages, width) : 0), [fontReady, pages, width]);

  const musicVols = useMusicVolumes(captions, durationInFrames, musicVolume, musicDuck);

  const zooms = useMemo(() => (punchZoom ? zoomMoments(pages) : []), [punchZoom, pages]);
  const zoom = useMemo(() => {
    const ms = (frame / fps) * 1000;
    const z = zooms.find((m) => ms >= m.startMs - 200 && ms < m.endMs + 300);
    if (!z) return 1;
    // phóng nhanh vào (0.2s), giữ, thu về mượt (0.3s)
    return interpolate(ms, [z.startMs - 200, z.startMs, z.endMs, z.endMs + 300], [1, ZOOM_SCALE, ZOOM_SCALE, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    });
  }, [zooms, frame, fps]);

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      {/* vùng che nằm cùng khối zoom để luôn khớp chỗ cần che */}
      <AbsoluteFill style={{ transform: zoom !== 1 ? `scale(${zoom})` : undefined }}>
        <AbsoluteFill>
          <Video objectFit="cover" disallowFallbackToOffthreadVideo src={src} />
        </AbsoluteFill>
        {blurs.length ? <BlurBoxes boxes={blurs} /> : null}
      </AbsoluteFill>

      {overlays.length ? (
        <Overlays items={overlays.map((o) => ({ ...o, src: resolveSrc(o.src) }))} />
      ) : null}

      {brandText || brandLogoSrc ? (
        <Brand text={brandText} logoSrc={brandLogoSrc ? resolveSrc(brandLogoSrc) : ""} position={brandPosition} />
      ) : null}

      {pages.map((page, index) => {
        const from = Math.round((page.startMs / 1000) * fps);
        const dur = Math.round((pageEndMs(pages, index) / 1000) * fps) - from;
        if (dur <= 0 || !subSize) return null;
        return (
          <Sequence key={index} from={from} durationInFrames={dur} layout="none">
            <SubtitlePage page={page} fontSize={subSize} subStyle={subStyle} />
          </Sequence>
        );
      })}

      <InfoOverlay info={{ tenDuAn, gia, dienTich, phongNgu, diaChi }} cardDelaySec={hookFrames / FPS} />

      {/* chữ nhấn vẽ trên thẻ giá / tên kênh để không bị che */}
      {callouts.length ? <Callouts items={callouts} sfxBase={sfxBase} sfxVolume={calloutSfx} /> : null}

      {hookFrames ? (
        <Sequence durationInFrames={hookFrames} layout="none">
          <Hook text={hookText} style={hookStyle} x={hookX} y={hookY} scale={hookScale} bg={hookBg} />
        </Sequence>
      ) : null}
      {hookFrames ? (
        <Sequence durationInFrames={Math.max(hookFrames, 3 * FPS)} layout="none">
          <CalloutAudio c={{ style: hookStyle, ...splitHook(hookText) }} base={sfxBase} volume={calloutSfx} />
        </Sequence>
      ) : null}

      {musicSrc ? (
        <Audio
          src={resolveSrc(musicSrc)}
          loop
          loopVolumeCurveBehavior="extend"
          volume={(f) => musicVols[Math.min(musicVols.length - 1, Math.max(0, f))] ?? musicVolume}
        />
      ) : null}

      {sfx.map((s, i) => (
        <Sequence
          key={`${s.src}-${s.at}-${i}`}
          from={Math.max(0, Math.round(s.at * fps))}
          durationInFrames={3 * fps}
          layout="none"
        >
          <Audio src={resolveSrc(s.src)} volume={s.volume} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
