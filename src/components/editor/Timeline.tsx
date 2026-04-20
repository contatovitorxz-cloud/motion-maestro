import { useRef } from "react";
import { cn } from "@/lib/utils";
import { Film, Layers, Type, Music, Captions } from "lucide-react";
import type { Clip, Asset } from "@/pages/Editor";

interface Props {
  clips: Clip[];
  duration: number;
  currentTime: number;
  onSeek: (t: number) => void;
  assets: Asset[];
}

const TRACKS = [
  { key: "video", label: "Video", icon: Film, color: "bg-track-video" },
  { key: "overlay", label: "Motion", icon: Layers, color: "bg-track-overlay" },
  { key: "text", label: "Text", icon: Type, color: "bg-track-text" },
  { key: "audio", label: "Audio", icon: Music, color: "bg-track-audio" },
  { key: "captions", label: "Captions", icon: Captions, color: "bg-track-captions" },
];

const Timeline = ({ clips, duration, currentTime, onSeek, assets }: Props) => {
  const trackRef = useRef<HTMLDivElement>(null);

  const handleClick = (e: React.MouseEvent) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    onSeek((x / rect.width) * duration);
  };

  const ticks = Array.from({ length: Math.ceil(duration / 5) + 1 });

  return (
    <div className="h-56 shrink-0 border-t border-border bg-panel flex flex-col">
      {/* Ruler */}
      <div className="h-7 border-b border-border flex items-stretch">
        <div className="w-28 shrink-0 border-r border-border" />
        <div ref={trackRef} className="flex-1 relative cursor-pointer select-none" onClick={handleClick}>
          {ticks.map((_, i) => (
            <div key={i} className="absolute top-0 bottom-0 border-l border-border/60 pl-1 text-[10px] text-muted-foreground font-mono"
              style={{ left: `${(i * 5 / duration) * 100}%` }}>
              {i * 5}s
            </div>
          ))}
          {/* playhead */}
          <div className="absolute top-0 bottom-0 w-px bg-primary z-20 pointer-events-none"
            style={{ left: `${(currentTime / duration) * 100}%` }}>
            <div className="absolute -top-0 -left-1.5 size-3 bg-primary rotate-45" />
          </div>
        </div>
      </div>

      {/* Tracks */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {TRACKS.map((track) => {
          const trackClips = clips.filter((c) => c.track === track.key);
          return (
            <div key={track.key} className="flex items-stretch border-b border-border/50 h-10">
              <div className="w-28 shrink-0 border-r border-border flex items-center gap-2 px-3 text-xs text-muted-foreground bg-panel">
                <track.icon className="size-3" />
                {track.label}
              </div>
              <div className="flex-1 relative bg-background/40">
                {trackClips.map((c) => {
                  const left = (c.start_time / duration) * 100;
                  const width = ((c.end_time - c.start_time) / duration) * 100;
                  const asset = assets.find(a => a.id === c.asset_id);
                  const label = asset?.name || c.effects?.text || c.effects?.kind || "clip";
                  return (
                    <div
                      key={c.id}
                      className={cn(
                        "absolute top-1 bottom-1 rounded text-[10px] px-2 flex items-center gap-1 text-white/95 font-medium overflow-hidden cursor-pointer hover:brightness-110 transition",
                        track.color
                      )}
                      style={{ left: `${left}%`, width: `${Math.max(width, 1)}%` }}
                      title={label}
                    >
                      <span className="truncate">{label}</span>
                    </div>
                  );
                })}
                <div className="absolute top-0 bottom-0 w-px bg-primary/60 z-10 pointer-events-none"
                  style={{ left: `${(currentTime / duration) * 100}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Timeline;
