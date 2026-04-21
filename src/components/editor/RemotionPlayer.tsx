import { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import type { MotionScene } from "@/lib/motionScene";
import { MotionComposition } from "@/remotion/MotionComposition";
import type { Asset } from "@/pages/Editor";

interface Props {
  scene: MotionScene;
  assets: Asset[];
  fps?: number;
  width?: number;
  height?: number;
  className?: string;
}

export interface RemotionPlayerHandle {
  player: PlayerRef | null;
  /** Returns the underlying DOM container of the player (used for canvas capture). */
  getContainer: () => HTMLDivElement | null;
}

const RemotionPlayer = forwardRef<RemotionPlayerHandle, Props>(
  ({ scene, assets, fps = 30, width = 1920, height = 1080, className }, ref) => {
    const playerRef = useRef<PlayerRef>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);

    const imageUrls = useMemo(() => {
      const map: Record<string, string> = {};
      assets.forEach((a) => {
        if (a.url) map[a.id] = a.url;
      });
      return map;
    }, [assets]);

    const durationInFrames = Math.max(
      1,
      Math.round((scene.durationMs / 1000) * fps)
    );

    useImperativeHandle(
      ref,
      () => ({
        get player() {
          return playerRef.current;
        },
        getContainer: () => wrapperRef.current,
      }),
      []
    );

    return (
      <div ref={wrapperRef} className={className} style={{ width: "100%", height: "100%" }}>
        <Player
          ref={playerRef}
          component={MotionComposition}
          inputProps={{ scene, imageUrls }}
          durationInFrames={durationInFrames}
          compositionWidth={width}
          compositionHeight={height}
          fps={fps}
          style={{ width: "100%", height: "100%" }}
          controls={false}
          loop
          acknowledgeRemotionLicense
        />
      </div>
    );
  }
);

RemotionPlayer.displayName = "RemotionPlayer";
export default RemotionPlayer;
