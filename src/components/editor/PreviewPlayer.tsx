import { RefObject, useEffect, useRef, useState } from "react";
import { Play, Pause, SkipBack, SkipForward, Maximize2, Volume2, Film, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Asset, Clip } from "@/pages/Editor";
import MotionRenderer from "./MotionRenderer";
import { isMotionScene } from "@/lib/motionScene";

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

const PreviewPlayer = ({ asset, videoRef, onTimeUpdate, onDurationChange, isPlaying, setIsPlaying, currentTime, clips, assets }: Props) => {
  const [volume, setVolume] = useState(100);
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());

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

  // Sync isPlaying state -> video element
  useEffect(() => {
    const v = videoRef.current; if (!v) return;
    if (isPlaying) {
      v.play().catch(() => setIsPlaying(false));
    } else {
      v.pause();
    }
  }, [isPlaying, videoRef, setIsPlaying, asset]);

  // Fallback playback ticker when there is no <video> element (motion-only)
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

  const activeOverlays = clips.filter(c =>
    (c.track === "text" || c.track === "captions") &&
    currentTime >= c.start_time && currentTime <= c.end_time
  );

  // Audio clips with valid asset url
  const audioClips = clips.filter(c => c.track === "audio" && c.asset_id);

  // Sync each audio element with the playhead
  useEffect(() => {
    audioClips.forEach((clip) => {
      const el = audioRefs.current.get(clip.id);
      if (!el) return;
      const inRange = currentTime >= clip.start_time && currentTime < clip.end_time;
      const localTime = Math.max(0, currentTime - clip.start_time);
      const vol = (typeof clip.effects?.volume === "number" ? clip.effects.volume : 100) / 100;
      el.volume = vol * (volume / 100);

      if (inRange) {
        // Resync if drifted
        if (Math.abs(el.currentTime - localTime) > 0.25) {
          try { el.currentTime = localTime; } catch {}
        }
        if (isPlaying && el.paused) el.play().catch(() => {});
        if (!isPlaying && !el.paused) el.pause();
      } else {
        if (!el.paused) el.pause();
      }
    });
  }, [currentTime, isPlaying, audioClips, volume]);

  // Pause everything when no longer playing
  useEffect(() => {
    if (!isPlaying) {
      audioRefs.current.forEach((el) => { if (!el.paused) el.pause(); });
    }
  }, [isPlaying]);

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60).toString().padStart(2, "0");
    const ms = Math.floor((s % 1) * 100).toString().padStart(2, "0");
    return `${m.toString().padStart(2, "0")}:${sec}:${ms}`;
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col relative">
      {/* Hidden audio elements per audio clip */}
      {audioClips.map((c) => {
        const a = assets.find(x => x.id === c.asset_id);
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

      {/* Cinema viewport */}
      <div className="flex-1 min-h-[280px] grid place-items-center p-8 relative">
        <div className="absolute inset-0 bg-gradient-vignette pointer-events-none" />

        <div className="relative w-full max-w-5xl aspect-video group" style={{ containerType: "inline-size" }}>
          <div className="absolute inset-0 rounded-md bg-black ring-1 ring-white/[0.06] overflow-hidden">
            {asset?.url ? (
              <video
                ref={videoRef}
                src={asset.url}
                className="w-full h-full object-contain bg-black"
                onClick={togglePlay}
              />
            ) : (
              <div className="w-full h-full grid place-items-center text-muted-foreground bg-obsidian">
                <div className="text-center">
                  <div className="size-16 mx-auto mb-4 rounded-2xl bg-gradient-primary-soft border border-primary/20 grid place-items-center">
                    <Film className="size-8 text-primary/60" />
                  </div>
                  <p className="text-sm font-medium">No clip loaded</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Upload a video to start directing</p>
                </div>
              </div>
            )}

            {/* Motion scene overlay (AI-generated, client-rendered) */}
            {(() => {
              const motion = clips.find(c =>
                c.track === "overlay" &&
                c.effects?.kind === "motion_scene" &&
                isMotionScene(c.effects?.scene) &&
                currentTime >= c.start_time && currentTime <= c.end_time
              );
              if (!motion) return null;
              return (
                <MotionRenderer
                  scene={motion.effects.scene}
                  currentTimeMs={(currentTime - motion.start_time) * 1000}
                  assets={assets}
                />
              );
            })()}

            <div className="absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-black/80 to-transparent pointer-events-none" />
            <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />

            <div className="absolute inset-0 pointer-events-none flex flex-col justify-end p-10 gap-2">
              {activeOverlays.map((c) => (
                <div
                  key={c.id}
                  className={
                    c.effects?.kind === "lower_third" || c.effects?.kind === "add_lower_third"
                      ? "self-start max-w-md bg-gradient-primary text-primary-foreground px-4 py-2 rounded-r-lg animate-slide-in-left font-semibold"
                      : "self-center text-center text-3xl font-bold text-white drop-shadow-lg [text-shadow:0_2px_8px_rgba(0,0,0,0.8)]"
                  }
                >
                  {c.effects?.text || (c.effects?.kind === "captions" ? "[ live captions ]" : "")}
                </div>
              ))}
            </div>

            {asset && (
              <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-1 rounded bg-black/60 backdrop-blur-sm border border-white/10">
                <span className="size-1.5 rounded-full bg-destructive animate-pulse" />
                <span className="text-[9px] font-mono uppercase tracking-widest text-white/80">PGM</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pro Transport Bar */}
      <div className="h-16 shrink-0 relative bg-obsidian/90 backdrop-blur-xl flex items-center px-6 gap-4">
        <div className="absolute inset-x-0 top-0 divider-h" />

        <Button
          size="icon"
          variant="ghost"
          onClick={() => videoRef.current && (videoRef.current.currentTime = 0)}
          className="size-9 hover:bg-panel-elevated text-muted-foreground hover:text-foreground transition-cinema"
        >
          <SkipBack className="size-4" />
        </Button>

        <Button
          size="icon"
          onClick={togglePlay}
          className="size-12 rounded-full bg-gradient-primary hover:opacity-90 transition-cinema"
        >
          {isPlaying ? <Pause className="size-5 fill-current" /> : <Play className="size-5 fill-current ml-0.5" />}
        </Button>

        <Button
          size="icon"
          variant="ghost"
          onClick={() => videoRef.current && (videoRef.current.currentTime += 10)}
          className="size-9 hover:bg-panel-elevated text-muted-foreground hover:text-foreground transition-cinema"
        >
          <SkipForward className="size-4" />
        </Button>

        <div className="flex-1 flex justify-center">
          <div className="flex items-baseline gap-2 px-5 py-1.5 rounded-lg bg-black/40 border border-border-strong/40">
            <span className="font-mono text-xl font-semibold text-amber tabular-nums tracking-tight">
              {fmt(currentTime)}
            </span>
            <span className="text-muted-foreground/40 text-sm">/</span>
            <span className="font-mono text-xs text-muted-foreground tabular-nums">
              {fmt(asset && videoRef.current?.duration ? videoRef.current.duration : 0)}
            </span>
          </div>
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button size="icon" variant="ghost" className="size-9 hover:bg-panel-elevated text-muted-foreground hover:text-foreground transition-cinema">
              {volume === 0 ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
            </Button>
          </PopoverTrigger>
          <PopoverContent side="top" className="w-12 h-32 p-3 bg-obsidian border-border-strong/60">
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
          onClick={() => videoRef.current?.requestFullscreen()}
          className="size-9 hover:bg-panel-elevated text-muted-foreground hover:text-foreground transition-cinema"
        >
          <Maximize2 className="size-4" />
        </Button>
      </div>
    </div>
  );
};

export default PreviewPlayer;
