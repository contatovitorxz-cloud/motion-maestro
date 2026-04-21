// Mirror of src/lib/motionScene.ts — keep in sync with the frontend.

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
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
  color?: string;
  fontSize?: number;
  fontWeight?: number;
  width?: number;
  height?: number;
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
