import { useMemo } from "react";
import type { MotionScene, MotionLayer } from "@/lib/motionScene";
import { clamp01, easeOutCubic, easeOutBack, easeOutExpo } from "@/lib/easing";
import type { Asset } from "@/pages/Editor";

interface Props {
  scene: MotionScene;
  /** time in MS within the scene (0..durationMs) */
  currentTimeMs: number;
  assets: Asset[];
}

/**
 * Pure client-side motion renderer. No CSS transitions — every layer's
 * transform/opacity is computed from `currentTimeMs` so playback is
 * deterministic and snaps to the timeline playhead.
 */
const MotionRenderer = ({ scene, currentTimeMs, assets }: Props) => {
  const t = Math.max(0, Math.min(scene.durationMs, currentTimeMs));

  const bgStyle = useMemo(() => buildBackground(scene, assets), [scene, assets]);

  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none"
      style={bgStyle}
    >
      {scene.layers.map((layer) => (
        <LayerView key={layer.id} layer={layer} t={t} scene={scene} assets={assets} />
      ))}
    </div>
  );
};

function buildBackground(scene: MotionScene, assets: Asset[]): React.CSSProperties {
  const bg = scene.background;
  if (bg.type === "solid") return { background: bg.color };
  if (bg.type === "gradient") {
    return {
      background: `linear-gradient(${bg.angle}deg, ${bg.from}, ${bg.to})`,
    };
  }
  if (bg.type === "image") {
    const url = assets.find((a) => a.id === bg.assetId)?.url;
    return {
      background: url
        ? `${bg.overlay ? `linear-gradient(${bg.overlay},${bg.overlay}),` : ""}url(${url}) center/cover no-repeat`
        : "#0F172A",
    };
  }
  return { background: "#0F172A" };
}

function LayerView({
  layer,
  t,
  scene,
  assets,
}: {
  layer: MotionLayer;
  t: number;
  scene: MotionScene;
  assets: Asset[];
}) {
  const { animation } = layer;
  const inEnd = animation.in.delayMs + animation.in.durationMs;
  const outStart = scene.durationMs - animation.out.durationMs;

  // IN progress
  const inP = clamp01((t - animation.in.delayMs) / Math.max(1, animation.in.durationMs));
  const outP = t > outStart ? clamp01((t - outStart) / Math.max(1, animation.out.durationMs)) : 0;

  // Don't render before delay
  if (t < animation.in.delayMs) return null;

  let opacity = layer.opacity;
  let tx = 0; // px offsets on top of % position
  let ty = 0;
  let scale = layer.scale;
  let rotate = layer.rotation;
  let blur = 0;

  // IN
  if (inP < 1) {
    const e = easeOutCubic(inP);
    switch (animation.in.type) {
      case "fade":
        opacity = layer.opacity * e;
        break;
      case "slideUp":
        ty = (1 - e) * 60;
        opacity = layer.opacity * e;
        break;
      case "slideDown":
        ty = -(1 - e) * 60;
        opacity = layer.opacity * e;
        break;
      case "slideLeft":
        tx = (1 - e) * 80;
        opacity = layer.opacity * e;
        break;
      case "slideRight":
        tx = -(1 - e) * 80;
        opacity = layer.opacity * e;
        break;
      case "scaleIn":
        scale = layer.scale * easeOutBack(inP);
        opacity = layer.opacity * easeOutExpo(inP);
        break;
      case "blurIn":
        blur = (1 - e) * 24;
        opacity = layer.opacity * e;
        break;
    }
  }

  // OUT (overrides if active)
  if (outP > 0) {
    const e = easeOutCubic(outP);
    switch (animation.out.type) {
      case "fade":
        opacity = layer.opacity * (1 - e);
        break;
      case "slideUp":
        ty = -e * 80;
        opacity = layer.opacity * (1 - e);
        break;
      case "scaleOut":
        scale = layer.scale * (1 - e * 0.4);
        opacity = layer.opacity * (1 - e);
        break;
      case "blurOut":
        blur = e * 24;
        opacity = layer.opacity * (1 - e);
        break;
    }
  }

  // LOOP (additive while in main visible window)
  if (animation.loop && t > inEnd && t < outStart) {
    const loopT = (t - inEnd) / (animation.loop.periodMs || 3000);
    const a = animation.loop.amplitude;
    if (animation.loop.type === "float") {
      ty += Math.sin(loopT * Math.PI * 2) * a;
    } else if (animation.loop.type === "pulse") {
      scale *= 1 + Math.sin(loopT * Math.PI * 2) * (a / 100);
    } else if (animation.loop.type === "spin") {
      rotate += loopT * 360;
    }
  }

  // Reference height = 1080. Scale font sizes by container later via responsive parent.
  const transform = `translate(-50%, -50%) translate(${tx}px, ${ty}px) scale(${scale}) rotate(${rotate}deg)`;
  const baseStyle: React.CSSProperties = {
    position: "absolute",
    left: `${layer.x}%`,
    top: `${layer.y}%`,
    transform,
    opacity,
    filter: blur > 0 ? `blur(${blur}px)` : undefined,
    willChange: "transform, opacity, filter",
  };

  if (layer.kind === "text") {
    return (
      <div
        style={{
          ...baseStyle,
          color: layer.color,
          fontSize: `clamp(20px, ${(layer.fontSize || 64) / 10.8}cqw, ${layer.fontSize || 64}px)`,
          fontWeight: layer.fontWeight,
          fontFamily: "'Inter', system-ui, sans-serif",
          textShadow: "0 2px 24px rgba(0,0,0,0.6)",
          letterSpacing: "-0.02em",
          whiteSpace: "nowrap",
          maxWidth: "90%",
          textAlign: "center",
          lineHeight: 1.05,
        }}
      >
        {layer.content}
      </div>
    );
  }

  if (layer.kind === "shape") {
    const w = layer.width || 30;
    const h = layer.height || w;
    const isCircle = layer.shape === "circle" || !layer.shape;
    return (
      <div
        style={{
          ...baseStyle,
          width: `${w}%`,
          height: `${h}%`,
          background: layer.color,
          borderRadius: isCircle ? "9999px" : layer.shape === "blob" ? "60% 40% 55% 45% / 50% 60% 40% 50%" : "12px",
          mixBlendMode: "screen",
        }}
      />
    );
  }

  if (layer.kind === "image") {
    const url = assets.find((a) => a.id === layer.assetId)?.url;
    if (!url) return null;
    const w = layer.width || 40;
    return (
      <img
        src={url}
        alt=""
        style={{
          ...baseStyle,
          width: `${w}%`,
          height: layer.height ? `${layer.height}%` : "auto",
          objectFit: "cover",
          borderRadius: "8px",
        }}
      />
    );
  }

  return null;
}

export default MotionRenderer;
