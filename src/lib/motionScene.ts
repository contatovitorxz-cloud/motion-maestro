// Schema for AI-generated motion scenes (client-side rendered)

export type AnimIn =
  | "fade" | "slideUp" | "slideDown" | "slideLeft" | "slideRight"
  | "scaleIn" | "blurIn";
export type AnimOut = "fade" | "slideUp" | "scaleOut" | "blurOut";
export type AnimLoop = "float" | "pulse" | "spin" | "none";

export interface MotionLayer {
  id: string;
  kind: "text" | "shape" | "image";
  content?: string;
  assetId?: string;
  shape?: "circle" | "rect" | "blob";
  x: number; // 0-100 (% of canvas, center anchor)
  y: number; // 0-100
  scale: number; // base scale, e.g. 1
  rotation: number; // degrees
  opacity: number; // 0-1
  color?: string; // hex or hsl
  fontSize?: number; // px (relative to 1080 reference height)
  fontWeight?: number;
  width?: number; // % canvas width (for shape/image)
  height?: number; // % canvas height
  animation: {
    in: { type: AnimIn; durationMs: number; delayMs: number };
    out: { type: AnimOut; durationMs: number };
    loop?: { type: AnimLoop; amplitude: number; periodMs?: number };
  };
}

export interface MotionScene {
  durationMs: number;
  background:
    | { type: "solid"; color: string }
    | { type: "gradient"; from: string; to: string; angle: number }
    | { type: "image"; assetId: string; overlay?: string };
  layers: MotionLayer[];
  palette: string[];
}

export function isMotionScene(v: any): v is MotionScene {
  return (
    v &&
    typeof v.durationMs === "number" &&
    v.background &&
    Array.isArray(v.layers)
  );
}

// Best-effort coercion of partial/loose AI output into a valid scene.
export function coerceScene(raw: any, fallbackDescription?: string): MotionScene {
  const durationMs = Math.max(
    2000,
    Math.min(12000, Number(raw?.durationMs) || 5000)
  );
  const background =
    raw?.background?.type === "solid"
      ? { type: "solid" as const, color: String(raw.background.color || "#0F172A") }
      : raw?.background?.type === "image" && raw?.background?.assetId
      ? {
          type: "image" as const,
          assetId: String(raw.background.assetId),
          overlay: raw.background.overlay,
        }
      : {
          type: "gradient" as const,
          from: String(raw?.background?.from || "#1E1B4B"),
          to: String(raw?.background?.to || "#0F172A"),
          angle: Number(raw?.background?.angle ?? 135),
        };

  const palette: string[] = Array.isArray(raw?.palette)
    ? raw.palette.filter((c: any) => typeof c === "string").slice(0, 6)
    : ["#A78BFA", "#F0ABFC", "#0F172A"];

  const layers: MotionLayer[] = Array.isArray(raw?.layers) && raw.layers.length
    ? raw.layers.map((l: any, i: number) => coerceLayer(l, i, palette))
    : [
        // Fallback: a single hero text using the description
        {
          id: "fallback-text",
          kind: "text",
          content: fallbackDescription || "Motion Scene",
          x: 50,
          y: 50,
          scale: 1,
          rotation: 0,
          opacity: 1,
          color: palette[0] || "#FFFFFF",
          fontSize: 72,
          fontWeight: 800,
          animation: {
            in: { type: "scaleIn", durationMs: 700, delayMs: 100 },
            out: { type: "fade", durationMs: 500 },
            loop: { type: "float", amplitude: 6, periodMs: 3000 },
          },
        },
      ];

  return { durationMs, background, layers, palette };
}

function coerceLayer(l: any, i: number, palette: string[]): MotionLayer {
  const kind: MotionLayer["kind"] =
    l?.kind === "image" || l?.kind === "shape" ? l.kind : "text";
  return {
    id: String(l?.id || `layer-${i}`),
    kind,
    content: l?.content ? String(l.content) : undefined,
    assetId: l?.assetId ? String(l.assetId) : undefined,
    shape: l?.shape,
    x: clampNum(l?.x, 0, 100, 50),
    y: clampNum(l?.y, 0, 100, 50),
    scale: clampNum(l?.scale, 0.1, 5, 1),
    rotation: clampNum(l?.rotation, -360, 360, 0),
    opacity: clampNum(l?.opacity, 0, 1, 1),
    color: l?.color || palette[i % palette.length] || "#FFFFFF",
    fontSize: clampNum(l?.fontSize, 12, 240, 64),
    fontWeight: clampNum(l?.fontWeight, 100, 900, 700),
    width: l?.width ? clampNum(l.width, 1, 100, 30) : undefined,
    height: l?.height ? clampNum(l.height, 1, 100, 30) : undefined,
    animation: {
      in: {
        type: (l?.animation?.in?.type as AnimIn) || "fade",
        durationMs: clampNum(l?.animation?.in?.durationMs, 100, 3000, 600),
        delayMs: clampNum(l?.animation?.in?.delayMs, 0, 8000, i * 150),
      },
      out: {
        type: (l?.animation?.out?.type as AnimOut) || "fade",
        durationMs: clampNum(l?.animation?.out?.durationMs, 100, 3000, 500),
      },
      loop: l?.animation?.loop?.type
        ? {
            type: l.animation.loop.type as AnimLoop,
            amplitude: clampNum(l.animation.loop.amplitude, 0, 50, 5),
            periodMs: clampNum(l.animation.loop.periodMs, 200, 10000, 3000),
          }
        : undefined,
    },
  };
}

function clampNum(v: any, min: number, max: number, fallback: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}
