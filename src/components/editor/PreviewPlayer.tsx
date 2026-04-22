import { forwardRef, RefObject, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Play, Pause, SkipBack, SkipForward, Maximize2, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Asset, Clip } from "@/pages/Editor";
import { isMotionScene } from "@/lib/motionScene";
import RemotionPlayer, { type RemotionPlayerHandle } from "./RemotionPlayer";

interface Props {
  asset: Asset | null;
  videoRef: RefObject<HTMLVideoElement>;
  onTimeUpdate: (t: number) => void;
  onDurationChange: (d: number) => void;
  isPlaying: boolean;
  setIsPlaying: (p: boolean) => void;
  currentTime: number;
  clips: Clip[];
  assets: Asset[];
}

export interface PreviewPlayerHandle {
  getRemotionHandle: () => RemotionPlayerHandle | null;
}

const fmt = (s: number) => {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const sec = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
};

const PreviewPlayer = forwardRef<PreviewPlayerHandle, Props>(({
  asset, videoRef, onTimeUpdate, onDurationChange, isPlaying, setIsPlaying, currentTime, clips, assets,
}, ref) => {
  const [volume, setVolume] = useState(100);
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  const remotionRef = useRef<RemotionPlayerHandle>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    getRemotionHandle: () => remotionRef.current,
  }), []);

  const motionClip = useMemo(
    () =>
      [...clips]
        .reverse()
        .find(
          (c) =>
            c.track === "overlay" &&
            c.effects?.kind === "motion_scene" &&
            isMotionScene(c.effects?.scene)
        ),
    [clips]
  );

  useEffect(() => {
    const v = videoRef.current; if (!v) return;
    const onTime = () => onTimeUpdate(v.currentTime);
    const onDur = () => onDurationChange(v.duration || 0);
    const onEnded = () => setIsPlaying(false);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("loadedmetadata", onDur);
    v.addEventListener("ended", onEnded);
    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("loadedmetadata", onDur);
      v.removeEventListener("ended", onEnded);
    };
  }, [videoRef, onTimeUpdate, onDurationChange, setIsPlaying]);

  useEffect(() => {
    const v = videoRef.current; if (!v) return;
    if (isPlaying) v.play().catch(() => setIsPlaying(false));
    else v.pause();
  }, [isPlaying, videoRef, setIsPlaying, asset]);

  useEffect(() => {
    const p = remotionRef.current?.player;
    if (!p) return;
    if (isPlaying) p.play();
    else p.pause();
  }, [isPlaying, motionClip?.id]);

  useEffect(() => {
    if (asset?.url) return;
    if (!isPlaying) return;
    let raf = 0;
    let last = performance.now();
    let t = currentTime;
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      t = t + dt;
      onTimeUpdate(t);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, asset?.url]);

  const togglePlay = () => setIsPlaying(!isPlaying);

  const activeCaption = clips.find(
    (c) =>
      (c.track === "captions" || c.track === "text") &&
      currentTime >= c.start_time &&
      currentTime <= c.end_time &&
      (c.effects?.text || c.effects?.kind === "captions")
  );

  const audioClips = clips.filter((c) => c.track === "audio" && c.asset_id);

  useEffect(() => {
    audioClips.forEach((clip) => {
      const el = audioRefs.current.get(clip.id);
      if (!el) return;
      const inRange = currentTime >= clip.start_time && currentTime < clip.end_time;
      const localTime = Math.max(0, currentTime - clip.start_time);
      const vol = (typeof clip.effects?.volume === "number" ? clip.effects.volume : 100) / 100;
      el.volume = vol * (volume / 100);

      if (inRange) {
        if (Math.abs(el.currentTime - localTime) > 0.25) {
          try { el.currentTime = localTime; } catch {}
        }
        if (isPlaying && el.paused) el.play().catch(() => {});
        if (!isPlaying && !el.paused) el.pause();
      } else if (!el.paused) {
        el.pause();
      }
    });
  }, [currentTime, isPlaying, audioClips, volume]);

  useEffect(() => {
    if (!isPlaying) audioRefs.current.forEach((el) => { if (!el.paused) el.pause(); });
  }, [isPlaying]);

  const showRemotion = !!motionClip && !asset?.url;
  const totalDuration = asset && videoRef.current?.duration
    ? videoRef.current.duration
    : motionClip ? motionClip.effects.scene.durationMs / 1000
    : Math.max(...clips.map(c => c.end_time), 0) || 60;

  return (
    <div className="flex-1 min-h-0 flex flex-col" style={{ backgroundColor: "#0a0a0a" }}>
      {/* hidden audio elements */}
      {audioClips.map((c) => {
        const a = assets.find((x) => x.id === c.asset_id);
        if (!a?.url) return null;
        return (
          <audio
            key={c.id}
            ref={(el) => {
              if (el) audioRefs.current.set(c.id, el);
              else audioRefs.current.delete(c.id);
            }}
            src={a.url}
            preload="auto"
            className="hidden"
          />
        );
      })}

      {/* PREVIEW área */}
      <div
        className="flex-1 flex items-center justify-center p-6 min-h-0"
        style={{ backgroundColor: "#050505" }}
      >
        <div
          ref={wrapperRef}
          className="relative w-full max-w-[900px] aspect-video rounded-lg overflow-hidden"
          style={{
            backgroundColor: "#000",
            boxShadow: "0 10px 40px rgba(0,0,0,0.6)",
          }}
        >
          {asset?.url ? (
            <video
              ref={videoRef}
              src={asset.url}
              className="w-full h-full object-contain bg-black"
              onClick={togglePlay}
            />
          ) : showRemotion ? (
            <RemotionPlayer
              ref={remotionRef}
              scene={motionClip!.effects.scene}
              assets={assets}
              className="w-full h-full"
            />
          ) : (
            <>
              {/* mockup-style placeholder */}
              <div
                className="absolute inset-0"
                style={{ background: "radial-gradient(ellipse at 40% 40%, #1a1530 0%, #050505 75%)" }}
              />
              <div
                className="absolute top-0 bottom-0 left-0"
                style={{
                  width: "33%",
                  opacity: 0.3,
                  background: "linear-gradient(90deg, rgba(255,182,39,0.15), transparent)",
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div
                    className="size-[72px] mx-auto mb-3 rounded-2xl grid place-items-center"
                    style={{ background: "linear-gradient(135deg,#7B2CBF,#FFB627)" }}
                  >
                    <Play size={30} fill="#000" color="#000" style={{ marginLeft: 3 }} />
                  </div>
                  <div className="text-[10px] font-mono text-white/30 tracking-[0.2em]">PREVIEW</div>
                </div>
              </div>
            </>
          )}

          {/* Caption overlay (estilo mockup) */}
          {activeCaption && (
            <div
              className="absolute left-1/2 -translate-x-1/2 font-black tracking-wide whitespace-nowrap"
              style={{
                bottom: "12%",
                fontSize: 22,
                color: "#FFB627",
                textShadow: "-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000",
              }}
            >
              {(activeCaption.effects?.text || "[ legendas ao vivo ]").toString().toUpperCase()}
            </div>
          )}

          {/* Timecode TL canto */}
          <div className="absolute top-3 left-3 text-[10px] font-mono text-white/40">
            {fmt(currentTime)}
          </div>
        </div>
      </div>

      {/* CONTROLES */}
      <div
        className="h-12 shrink-0 flex items-center justify-center gap-4 border-t"
        style={{ borderColor: "rgba(255,255,255,0.06)" }}
      >
        <Button
          size="icon"
          variant="ghost"
          onClick={() => {
            if (videoRef.current) videoRef.current.currentTime = 0;
            const p = remotionRef.current?.player;
            if (p) p.seekTo(0);
            onTimeUpdate(0);
          }}
          className="size-8 hover:bg-white/[0.05]"
        >
          <SkipBack className="size-4 text-white/60" />
        </Button>

        <button
          type="button"
          onClick={togglePlay}
          className="size-9 rounded-full grid place-items-center"
          style={{ backgroundColor: "white" }}
        >
          {isPlaying
            ? <Pause className="size-3.5" color="#000" />
            : <Play className="size-3.5 ml-0.5" fill="#000" color="#000" />}
        </button>

        <Button
          size="icon"
          variant="ghost"
          onClick={() => videoRef.current && (videoRef.current.currentTime += 10)}
          className="size-8 hover:bg-white/[0.05]"
        >
          <SkipForward className="size-4 text-white/60" />
        </Button>

        <div className="w-px h-4" style={{ backgroundColor: "rgba(255,255,255,0.1)" }} />

        <div className="text-xs font-mono text-white/70 tabular-nums">
          {fmt(currentTime)} <span className="text-white/30">/ {fmt(totalDuration)}</span>
        </div>

        <div className="w-px h-4" style={{ backgroundColor: "rgba(255,255,255,0.1)" }} />

        <Popover>
          <PopoverTrigger asChild>
            <Button size="icon" variant="ghost" className="size-8 hover:bg-white/[0.05]">
              {volume === 0 ? <VolumeX className="size-4 text-white/60" /> : <Volume2 className="size-4 text-white/60" />}
            </Button>
          </PopoverTrigger>
          <PopoverContent side="top" className="w-12 h-32 p-3" style={{ backgroundColor: "#0a0a0a", borderColor: "rgba(255,255,255,0.1)" }}>
            <Slider
              orientation="vertical"
              value={[volume]}
              max={100}
              onValueChange={(v) => {
                setVolume(v[0]);
                if (videoRef.current) videoRef.current.volume = v[0] / 100;
              }}
              className="h-full"
            />
          </PopoverContent>
        </Popover>

        <Button
          size="icon"
          variant="ghost"
          onClick={() => wrapperRef.current?.requestFullscreen()}
          className="size-8 hover:bg-white/[0.05]"
        >
          <Maximize2 className="size-4 text-white/60" />
        </Button>
      </div>
    </div>
  );
});

PreviewPlayer.displayName = "PreviewPlayer";
export default PreviewPlayer;
