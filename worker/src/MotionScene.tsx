import React from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { MotionLayer, MotionScene } from "./motionScene";

export interface SceneProps {
  scene: MotionScene;
  narrationUrl: string | null;
  imageUrls: Record<string, string>;
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

function bgStyle(scene: MotionScene, imageUrls: Record<string, string>): React.CSSProperties {
  const bg = scene.background;
  if (bg.type === "solid") return { background: bg.color };
  if (bg.type === "gradient")
    return { background: `linear-gradient(${bg.angle}deg, ${bg.from}, ${bg.to})` };
  // image
  const url = imageUrls[bg.assetId];
  return {
    backgroundImage: url ? `url("${url}")` : undefined,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundColor: "#000",
  };
}

const LayerView: React.FC<{
  layer: MotionLayer;
  tMs: number;
  totalMs: number;
  imageUrls: Record<string, string>;
}> = ({ layer, tMs, totalMs, imageUrls }) => {
  const inAnim = layer.animation.in;
  const outAnim = layer.animation.out;
  const loop = layer.animation.loop;

  const inProgress = Math.max(
    0,
    Math.min(1, (tMs - inAnim.delayMs) / Math.max(1, inAnim.durationMs))
  );
  const inEased = easeOutCubic(inProgress);

  const outStart = totalMs - outAnim.durationMs;
  const outRaw = Math.max(0, Math.min(1, (tMs - outStart) / Math.max(1, outAnim.durationMs)));
  const outEased = easeInOutCubic(outRaw);

  let opacity = layer.opacity * inEased * (1 - outEased);
  let translateX = 0;
  let translateY = 0;
  let scale = layer.scale;
  let blur = 0;
  let rotate = layer.rotation;

  // In animation
  switch (inAnim.type) {
    case "fade":
      break;
    case "slideUp":
      translateY = (1 - inEased) * 60;
      break;
    case "slideDown":
      translateY = -(1 - inEased) * 60;
      break;
    case "slideLeft":
      translateX = (1 - inEased) * 80;
      break;
    case "slideRight":
      translateX = -(1 - inEased) * 80;
      break;
    case "scaleIn":
      scale *= 0.6 + 0.4 * inEased;
      break;
    case "blurIn":
      blur = (1 - inEased) * 20;
      break;
  }

  // Out animation
  switch (outAnim.type) {
    case "fade":
      break;
    case "slideUp":
      translateY -= outEased * 60;
      break;
    case "scaleOut":
      scale *= 1 - outEased * 0.4;
      break;
    case "blurOut":
      blur += outEased * 20;
      break;
  }

  // Loop
  if (loop && loop.type !== "none") {
    const period = loop.periodMs || 3000;
    const w = (tMs / period) * Math.PI * 2;
    if (loop.type === "float") translateY += Math.sin(w) * loop.amplitude;
    else if (loop.type === "pulse") scale *= 1 + Math.sin(w) * (loop.amplitude / 100);
    else if (loop.type === "spin") rotate += (tMs / period) * 360;
  }

  const baseStyle: React.CSSProperties = {
    position: "absolute",
    left: `${layer.x}%`,
    top: `${layer.y}%`,
    transform: `translate(-50%, -50%) translate(${translateX}px, ${translateY}px) scale(${scale}) rotate(${rotate}deg)`,
    opacity: Math.max(0, Math.min(1, opacity)),
    filter: blur > 0.1 ? `blur(${blur}px)` : undefined,
    color: layer.color,
  };

  if (layer.kind === "text") {
    return (
      <div
        style={{
          ...baseStyle,
          fontSize: layer.fontSize ? `${layer.fontSize}px` : "72px",
          fontWeight: layer.fontWeight || 700,
          fontFamily:
            "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          textAlign: "center",
          whiteSpace: "pre-wrap",
          letterSpacing: "-0.02em",
          lineHeight: 1.1,
          maxWidth: "90vw",
        }}
      >
        {layer.content}
      </div>
    );
  }

  if (layer.kind === "shape") {
    const w = layer.width || 20;
    const h = layer.height || w;
    const radius = layer.shape === "circle" ? "50%" : layer.shape === "blob" ? "40% 60% 70% 30% / 50% 30% 70% 50%" : "12px";
    return (
      <div
        style={{
          ...baseStyle,
          width: `${w}vw`,
          height: `${h}vw`,
          background: layer.color || "#fff",
          borderRadius: radius,
        }}
      />
    );
  }

  if (layer.kind === "image" && layer.assetId) {
    const url = imageUrls[layer.assetId];
    if (!url) return null;
    const w = layer.width || 30;
    return (
      <div
        style={{
          ...baseStyle,
          width: `${w}vw`,
          height: "auto",
        }}
      >
        <Img src={url} style={{ width: "100%", height: "auto", display: "block" }} />
      </div>
    );
  }

  return null;
};

export const MotionSceneComp: React.FC<SceneProps> = ({ scene, narrationUrl, imageUrls }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tMs = (frame / fps) * 1000;
  const totalMs = scene.durationMs;

  return (
    <AbsoluteFill style={bgStyle(scene, imageUrls)}>
      {scene.background.type === "image" && (scene.background as any).overlay && (
        <AbsoluteFill style={{ background: (scene.background as any).overlay }} />
      )}
      {scene.layers.map((l) => (
        <LayerView
          key={l.id}
          layer={l}
          tMs={tMs}
          totalMs={totalMs}
          imageUrls={imageUrls}
        />
      ))}
      {narrationUrl && <Audio src={narrationUrl} />}
    </AbsoluteFill>
  );
};
