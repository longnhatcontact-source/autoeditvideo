import { TikTokPage } from "@remotion/captions";
import React from "react";
import { AbsoluteFill } from "remotion";
import { Page, type SubStyle } from "./Page";

// phụ đề vào đứng yên luôn (không bật lên, không chạy chữ)
const SubtitlePage: React.FC<{ readonly page: TikTokPage; readonly fontSize: number; readonly subStyle: SubStyle }> = ({
  page,
  fontSize,
  subStyle,
}) => (
  <AbsoluteFill>
    <Page enterProgress={1} page={page} fontSize={fontSize} subStyle={subStyle} />
  </AbsoluteFill>
);

export default SubtitlePage;
