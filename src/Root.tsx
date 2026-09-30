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
      }}
    />
  );
};
