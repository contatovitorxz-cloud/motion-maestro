import { RefObject, useEffect } from "react";
import { Play, Pause, SkipBack, SkipForward, Maximize2, Volume2, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import type { Asset, Clip } from "@/pages/Editor";

interface Props {
  asset: Asset | null;
  videoRef: RefObject<HTMLVideoElement>;
  onTimeUpdate: (t: number) => void;
  onDurationChange: (d: number) => void;
  isPlaying: boolean;
  setIsPlaying: (p: boolean) => void;
  currentTime: number;
  clips: Clip[];
}

const PreviewPlayer = ({ asset, videoRef, onTimeUpdate, onDurationChange, isPlaying, setIsPlaying, currentTime, clips }: Props) => {
  useEffect(() => {
    const v = videoRef.current; if (!v) return;
    const onTime = () => onTimeUpdate(v.currentTime);
    const onDur = () => onDurationChange(v.duration || 0);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("loadedmetadata", onDur);
    return () => { v.removeEventListener("timeupdate", onTime); v.removeEventListener("loadedmetadata", onDur); };
  }, [videoRef, onTimeUpdate, onDurationChange]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "TEXTAREA") return;
      if (e.code === "Space") { e.preventDefault(); togglePlay(); }
      if (e.key === "j") { if (videoRef.current) videoRef.current.currentTime -= 5; }
      if (e.key === "l") { if (videoRef.current) videoRef.current.currentTime += 5; }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const togglePlay = () => {
    const v = videoRef.current; if (!v) return;
    if (v.paused) { v.play(); setIsPlaying(true); } else { v.pause(); setIsPlaying(false); }
  };

  // active text overlays at current time
  const activeOverlays = clips.filter(c =>
    (c.track === "text" || c.track === "captions") &&
    currentTime >= c.start_time && currentTime <= c.end_time
  );

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-gradient-panel">
      <div className="flex-1 grid place-items-center p-6 min-h-0">
        <div className="relative w-full max-w-5xl aspect-video bg-black rounded-lg overflow-hidden shadow-panel ring-1 ring-border">
          {asset?.url ? (
            <video
              ref={videoRef}
              src={asset.url}
              className="w-full h-full object-contain"
              onClick={togglePlay}
            />
          ) : (
            <div className="w-full h-full grid place-items-center text-muted-foreground">
              <div className="text-center">
                <Film className="size-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Upload a video to start editing</p>
              </div>
            </div>
          )}

          {/* overlay layer */}
          <div className="absolute inset-0 pointer-events-none flex flex-col justify-end p-8 gap-2">
            {activeOverlays.map((c) => (
              <div key={c.id}
                className={
                  c.effects?.kind === "lower_third" || c.effects?.kind === "add_lower_third"
                    ? "self-start max-w-md bg-gradient-primary text-primary-foreground px-4 py-2 rounded-r-lg shadow-elegant animate-in slide-in-from-left"
                    : "self-center text-center text-3xl font-bold text-white drop-shadow-lg [text-shadow:0_2px_8px_rgba(0,0,0,0.8)]"
                }
              >
                {c.effects?.text || (c.effects?.kind === "captions" ? "[ live captions ]" : "")}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Transport */}
      <div className="h-12 shrink-0 border-t border-border bg-panel flex items-center px-3 gap-2">
        <Button size="icon" variant="ghost" onClick={() => videoRef.current && (videoRef.current.currentTime = 0)}>
          <SkipBack className="size-4" />
        </Button>
        <Button size="icon" onClick={togglePlay} className="bg-gradient-primary hover:opacity-90">
          {isPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
        </Button>
        <Button size="icon" variant="ghost" onClick={() => videoRef.current && (videoRef.current.currentTime += 10)}>
          <SkipForward className="size-4" />
        </Button>
        <Volume2 className="size-4 text-muted-foreground ml-2" />
        <Slider defaultValue={[100]} max={100} className="w-24"
          onValueChange={(v) => { if (videoRef.current) videoRef.current.volume = v[0] / 100; }} />
        <div className="ml-auto text-xs text-muted-foreground font-mono">Space · play  ·  J/L · skip 5s</div>
        <Button size="icon" variant="ghost" onClick={() => videoRef.current?.requestFullscreen()}>
          <Maximize2 className="size-4" />
        </Button>
      </div>
    </div>
  );
};

export default PreviewPlayer;
