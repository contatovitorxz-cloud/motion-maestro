import type { PlayerRef } from "@remotion/player";

/**
 * Records the Remotion <Player> playback into a WebM Blob using MediaRecorder
 * + canvas.captureStream. Real-time export — a 5s scene takes ~5s to record.
 */
export async function exportPlayerToWebm(
  player: PlayerRef,
  container: HTMLElement,
  durationMs: number,
  fps = 30,
  onProgress?: (pct: number) => void
): Promise<Blob> {
  // Find the Remotion player canvas. Player renders into a <div> that contains
  // either a <canvas> or DOM elements. We need a canvas — Remotion's Player uses
  // DOM rendering by default, so we render the DOM into our own canvas via
  // html2canvas? No — simpler: Remotion Player exposes a video element when
  // possible. For DOM scenes we capture the player DIV to a canvas each frame.
  // BUT: the most reliable cross-browser path is to use the Player's own
  // `getContainerNode()` and snapshot frames via html-to-image into a canvas.
  //
  // Simpler approach that works TODAY: scrub the player frame by frame and
  // draw each frame to an offscreen canvas via the browser's experimental
  // CSS Paint API? That doesn't work either.
  //
  // The robust path: use the `<canvas>` Remotion Player creates internally
  // when you set `renderLoading` and inspect children — but Remotion DOM
  // playback doesn't use a canvas. So we composite frames using
  // `html-to-image` at render time. For now, we use a simpler approach:
  // capture the LIVE rendered DOM via getDisplayMedia? That requires user click.
  //
  // The cleanest cross-browser solution is to capture the screen region via
  // `captureStream` on a hidden <canvas> we paint into using requestAnimationFrame
  // and `drawImage` from `<foreignObject>` SVG. We do that here.

  const playerEl = container.querySelector(
    "[data-remotion-player]"
  ) as HTMLElement | null;
  const target = playerEl || (container.firstElementChild as HTMLElement) || container;

  const rect = target.getBoundingClientRect();
  const w = Math.max(2, Math.round(rect.width));
  const h = Math.max(2, Math.round(rect.height));

  // Lazy-load html-to-image (small dep already widely supported)
  const { toCanvas } = await import("html-to-image");

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  const stream = (canvas as any).captureStream(fps) as MediaStream;

  const mimeCandidates = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  const mimeType =
    mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || "video/webm";

  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  const totalFrames = Math.max(1, Math.round((durationMs / 1000) * fps));
  const totalDuration = totalFrames / fps;

  // Reset playhead and pause
  player.pause();
  player.seekTo(0);

  recorder.start();

  // Drive playback via real-time playback so internal animations look natural
  player.play();

  const start = performance.now();
  let stopped = false;

  const drawLoop = async () => {
    while (!stopped) {
      try {
        const frame = await toCanvas(target, {
          canvasWidth: w,
          canvasHeight: h,
          pixelRatio: 1,
          cacheBust: false,
          skipFonts: true,
        });
        ctx.drawImage(frame, 0, 0, w, h);
      } catch {
        // ignore individual frame errors
      }
      const elapsed = (performance.now() - start) / 1000;
      onProgress?.(Math.min(1, elapsed / totalDuration));
      if (elapsed >= totalDuration) break;
      await new Promise((r) => setTimeout(r, 1000 / fps));
    }
  };

  await drawLoop();
  stopped = true;
  player.pause();

  return new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
    recorder.stop();
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
