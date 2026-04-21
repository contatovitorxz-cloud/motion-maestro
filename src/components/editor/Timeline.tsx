import { useRef, useState } from "react";
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
  { key: "video", label: "Video", icon: Film, color: "hsl(var(--track-video))" },
  { key: "overlay", label: "Motion", icon: Layers, color: "hsl(var(--track-overlay))" },
  { key: "text", label: "Text", icon: Type, color: "hsl(var(--track-text))" },
  { key: "audio", label: "Audio", icon: Music, color: "hsl(var(--track-audio))" },
  { key: "captions", label: "Captions", icon: Captions, color: "hsl(var(--track-captions))" },
];

const Timeline = ({ clips, duration, currentTime, onSeek, assets }: Props) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState(0);

  const handleClick = (e: React.MouseEvent) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    onSeek((x / rect.width) * duration);
  };

  const handleMove = (e: React.MouseEvent) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    setHoverX(x);
    setHoverTime((x / rect.width) * duration);
  };

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  // Multi-level ticks: every 1s minor, every 5s mid, every 10s major
  const ticks = Array.from({ length: Math.ceil(duration) + 1 }, (_, i) => i);

  return (
    <div className="h-60 shrink-0 relative bg-obsidian flex flex-col bg-grain">
      <div className="absolute inset-x-0 top-0 divider-h" />

      {/* Ruler */}
      <div className="h-8 relative flex items-stretch">
        <div className="absolute inset-x-0 bottom-0 divider-h" />
        <div className="w-32 shrink-0 relative">
          <div className="absolute right-0 top-0 bottom-0 divider-v" />
          <div className="h-full flex items-center px-3">
            <span className="label-pro">Timeline</span>
          </div>
        </div>
        <div
          ref={trackRef}
          className="flex-1 relative cursor-pointer select-none"
          onClick={handleClick}
          onMouseMove={handleMove}
          onMouseLeave={() => setHoverTime(null)}
        >
          {ticks.map((i) => {
            const isMajor = i % 10 === 0;
            const isMid = i % 5 === 0 && !isMajor;
            const left = (i / duration) * 100;
            if (left > 100) return null;
            return (
              <div
                key={i}
                className="absolute top-0 bottom-0 flex flex-col items-start"
                style={{ left: `${left}%` }}
              >
                <div
                  className={cn(
                    "w-px",
                    isMajor ? "h-full bg-border-strong" : isMid ? "h-2/3 bg-border" : "h-1/3 bg-border/50"
                  )}
                />
                {(isMajor || isMid) && (
                  <span className="absolute top-1 left-1 text-[9px] text-muted-foreground/80 font-mono tabular-nums">
                    {i}s
                  </span>
                )}
              </div>
            );
          })}

          {/* Hover timecode */}
          {hoverTime !== null && (
            <div
              className="absolute top-0 bottom-0 w-px bg-foreground/30 pointer-events-none z-10"
              style={{ left: hoverX }}
            >
              <div className="absolute -top-0.5 left-1.5 px-1.5 py-0.5 rounded bg-foreground text-background text-[9px] font-mono font-semibold whitespace-nowrap">
                {fmt(hoverTime)}
              </div>
            </div>
          )}

          {/* Playhead */}
          <div
            className="absolute top-0 bottom-0 w-px bg-amber z-20 pointer-events-none shadow-[0_0_8px_hsl(var(--amber))]"
            style={{ left: `${(currentTime / duration) * 100}%` }}
          >
            <div className="absolute -top-1 -left-[5px] size-3 bg-amber rotate-45 shadow-[0_0_12px_hsl(var(--amber))]" />
          </div>
        </div>
      </div>

      {/* Tracks */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {TRACKS.map((track) => {
          const trackClips = clips.filter((c) => c.track === track.key);
          return (
            <div key={track.key} className="flex items-stretch h-11 relative group/track">
              <div className="absolute inset-x-0 bottom-0 h-px bg-border/40" />

              {/* Track header */}
              <div className="w-32 shrink-0 relative flex items-center gap-2 px-3 bg-obsidian">
                <div className="absolute right-0 top-0 bottom-0 divider-v" />
                <div
                  className="size-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: track.color, boxShadow: `0 0 6px ${track.color}` }}
                />
                <track.icon className="size-3 text-muted-foreground" />
                <span className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
                  {track.label}
                </span>
              </div>

              {/* Track lane */}
              <div className="flex-1 relative bg-black/30">
                {trackClips.map((c) => {
                  const left = (c.start_time / duration) * 100;
                  const width = ((c.end_time - c.start_time) / duration) * 100;
                  const asset = assets.find(a => a.id === c.asset_id);
                  const label = asset?.name || c.effects?.text || c.effects?.kind || "clip";
                  return (
                    <div
                      key={c.id}
                      className="absolute top-1 bottom-1 rounded-md text-[10px] px-2 flex items-center gap-1 text-white font-medium overflow-hidden cursor-pointer transition-cinema hover:brightness-125 hover:-translate-y-px group/clip relative"
                      style={{
                        left: `${left}%`,
                        width: `${Math.max(width, 1)}%`,
                        background: `linear-gradient(135deg, ${track.color}, ${track.color}cc)`,
                        boxShadow: `0 2px 8px ${track.color}40, inset 0 1px 0 rgba(255,255,255,0.25)`,
                      }}
                      title={label}
                    >
                      {/* Top highlight */}
                      <div className="absolute top-0 inset-x-0 h-px bg-white/40" />
                      <span className="truncate relative z-10 drop-shadow">{label}</span>
                    </div>
                  );
                })}

                {/* Playhead line through track */}
                <div
                  className="absolute top-0 bottom-0 w-px bg-amber/70 z-10 pointer-events-none"
                  style={{ left: `${(currentTime / duration) * 100}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Timeline;
