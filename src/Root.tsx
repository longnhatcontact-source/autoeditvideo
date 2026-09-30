import "./index.css";
import { Composition, staticFile } from "remotion";
import {
  CaptionedVideo,
  calculateCaptionedVideoMetadata,
  captionedVideoSchema,
} from "./CaptionedVideo";

export const RemotionRoot: React.FC = () => {
  return (
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
        brandText: "@nhatrealproperty",
        brandLogoSrc: "",
        brandPosition: "duoi-video" as const,
        subHighlight: "#39E508",
        subPosition: "thap" as const,
        subBox: false,
        punchZoom: true,
        overlays: [],
        callouts: [
          { at: 2.8, sec: 2.5, style: "red" as const, top: "", main: "Căn hộ", sub: "Đáng sống" },
          { at: 5.6, sec: 2.8, style: "neon" as const, top: "Biệt thự", main: "PHONG CÁCH", sub: "Hiện đại" },
          { at: 8.6, sec: 3.2, style: "gold" as const, top: "Vị trí", main: "Đắc địa", sub: "Nhịp sống phồn thịnh" },
        ],
      }}
    />
  );
};
