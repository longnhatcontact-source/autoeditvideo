import "./index.css";
import { Composition, staticFile } from "remotion";
import {
  CaptionedVideo,
  calculateCaptionedVideoMetadata,
  captionedVideoSchema,
} from "./CaptionedVideo";
import { Cover, COVER_DURATION, coverSchema } from "./CaptionedVideo/Cover";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* ảnh bìa: xuất 1 khung (npx remotion still ... BiaVideo --frame=90) */}
      <Composition
        id="BiaVideo"
        component={Cover}
        schema={coverSchema}
        width={1080}
        height={1920}
        fps={30}
        durationInFrames={COVER_DURATION}
        defaultProps={{
          title: "Toàn cảnh view tầng 34 *Le Parc Place*",
          titleStyle: "gold" as const,
          background: "",
          scenes: [],
          footer: "Giá chỉ từ",
          footerStrong: "98 triệu/m²",
        }}
      />
      <Composition
        id="BdsVideo"
        component={CaptionedVideo}
        calculateMetadata={calculateCaptionedVideoMetadata}
        schema={captionedVideoSchema}
        width={1080}
        height={1920}
        defaultProps={{
          src: staticFile("sample-video.mp4"),
          tenDuAn: "Tên dự án",
          gia: "3,5 tỷ",
          dienTich: "68m²",
          phongNgu: "2PN",
          diaChi: "Quận 7, TP.HCM",
          captions: null,
          musicSrc: "",
          musicVolume: 0.25,
          musicDuck: true,
          sfx: [],
          durationInFrames: null,
          keepTogether: [],
          blurs: [],
          hookText: "View tầng 34 *Le Parc Place* trông thế nào?",
          hookSec: 2.5,
          hookStyle: "gold" as const,
          hookX: 0.5,
          hookY: 0.484,
          hookScale: 1,
          brandText: "@nhatrealproperty",
          brandLogoSrc: "",
          brandPosition: "duoi-video" as const,
          subHighlight: "#39E508",
          subPosition: "thap" as const,
          subBox: false,
          punchZoom: true,
          overlays: [],
          callouts: [
            {
              at: 2.8,
              sec: 2.5,
              style: "red" as const,
              top: "",
              main: "Căn hộ",
              sub: "Đáng sống",
              x: 0.5,
              y: 0.484,
              scale: 1,
            },
            {
              at: 5.6,
              sec: 2.8,
              style: "neon" as const,
              top: "Biệt thự",
              main: "PHONG CÁCH",
              sub: "Hiện đại",
              x: 0.5,
              y: 0.42,
              scale: 0.85,
            },
            {
              at: 8.6,
              sec: 3.2,
              style: "gold" as const,
              top: "Vị trí",
              main: "Đắc địa",
              sub: "Nhịp sống phồn thịnh",
              x: 0.5,
              y: 0.56,
              scale: 0.95,
            },
          ],
        }}
      />
    </>
  );
};
