import React from "react";
import { Composition } from "remotion";
import { MotionSceneComp, type SceneProps } from "./MotionScene";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="MotionScene"
      component={MotionSceneComp}
      durationInFrames={150}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{
        scene: {
          durationMs: 5000,
          background: { type: "gradient", from: "#1E1B4B", to: "#0F172A", angle: 135 },
          layers: [],
          palette: ["#A78BFA", "#F0ABFC"],
        },
        narrationUrl: null,
        imageUrls: {},
      } as SceneProps}
      calculateMetadata={({ props }) => {
        const fps = 30;
        const durationMs = (props as SceneProps).scene?.durationMs || 5000;
        return {
          durationInFrames: Math.max(30, Math.round((durationMs / 1000) * fps)),
        };
      }}
    />
  );
};
