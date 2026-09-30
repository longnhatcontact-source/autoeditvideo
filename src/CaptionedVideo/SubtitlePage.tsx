import { TikTokPage } from "@remotion/captions";
import React from "react";
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Page, type SubStyle } from "./Page";

const SubtitlePage: React.FC<{ readonly page: TikTokPage; readonly fontSize: number; readonly subStyle: SubStyle }> = ({
  page,
  fontSize,
  subStyle,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({
    frame,
    fps,
    config: {
      damping: 200,
    },
    durationInFrames: 5,
  });

  return (
    <AbsoluteFill>
      <Page enterProgress={enter} page={page} fontSize={fontSize} subStyle={subStyle} />
    </AbsoluteFill>
  );
};

export default SubtitlePage;
