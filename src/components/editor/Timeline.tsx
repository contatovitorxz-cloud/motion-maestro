import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Film, Layers, Type, Music, Captions, Scissors, Trash2, Undo2, Redo2 } from "lucide-react";
import type { Clip, Asset } from "@/pages/Editor";
import { Button } from "@/components/ui/button";

interface Props {
  clips: Clip[];
  duration: number;
  currentTime: number;
  onSeek: (t: number) => void;
  assets: Asset[];
  selectedClipId: string | null;
  onSelectClip: (id: string | null) => void;
  onLiveUpdate: (clips: Clip[] | ((prev: Clip[]) => Clip[])) => void;
  onCommit: (next: Clip[]) => void;
  onSplit: () => void;
  onDelete: () => void;
  onUndo: () => void;
  onRedo: () => void;
}

const TRACKS = [
  { key: "video", label: "Video", icon: Film, color: "hsl(var(--track-video))" },
  { key: "overlay", label: "Motion", icon: Layers, color: "hsl(var(--track-overlay))" },
  { key: "text", label: "Text", icon: Type, color: "hsl(var(--track-text))" },
  { key: "audio", label: "Audio", icon: Music, color: "hsl(var(--track-audio))" },
  { key: "captions", label: "Captions", icon: Captions, color: "hsl(var(--track-captions))" },
];

const SNAP_THRESHOLD_PX = 8;
const TRACK_KEYS = TRACKS.map(t => t.key);

type DragMode = "move" | "trim-left" | "trim-right";

interface DragState {
  clipId: string;
  mode: DragMode;
  originX: number;
  originStart: number;
  originEnd: number;
  originTrack: string;
  originTrackIndex: number;
  pxPerSec: number;
  laneRect: DOMRect;
}

const Timeline = ({
  clips, duration, currentTime, onSeek, assets,
  selectedClipId, onSelectClip, onLiveUpdate, onCommit,
  onSplit, onDelete, onUndo, onRedo,
}: Props) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const lanesContainerRef = useRef<HTMLDivElement>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState(0);
  const dragRef = useRef<DragState | null>(null);
  const [snapLine, setSnapLine] = useState<number | null>(null);
  const [collidingId, setCollidingId] = useState<string | null>(null);

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

  // ===== Drag/trim handlers =====
  const beginClipDrag = (e: React.MouseEvent, clip: Clip, mode: DragMode) => {
    e.stopPropagation();
    e.preventDefault();
    onSelectClip(clip.id);
    if (!lanesContainerRef.current) return;
    const lane = (e.currentTarget as HTMLElement).closest("[data-lane]") as HTMLElement | null;
    if (!lane) return;
    const laneRect = lane.getBoundingClientRect();
    const pxPerSec = laneRect.width / duration;
    dragRef.current = {
      clipId: clip.id,
      mode,
      originX: e.clientX,
      originStart: clip.start_time,
      originEnd: clip.end_time,
      originTrack: clip.track,
      originTrackIndex: TRACK_KEYS.indexOf(clip.track),
      pxPerSec,
      laneRect,
    };
    document.body.style.cursor = mode === "move" ? "grabbing" : "ew-resize";
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = e.clientX - d.originX;
      const dSec = dx / d.pxPerSec;
      const minLen = 0.2;

      // Snap candidates: other clips' boundaries + playhead + 0/duration
      const snaps: number[] = [0, duration, currentTime];
      clips.forEach(c => {
        if (c.id === d.clipId) return;
        snaps.push(c.start_time, c.end_time);
      });

      const snap = (val: number): { v: number; line: number | null } => {
        const thresholdSec = SNAP_THRESHOLD_PX / d.pxPerSec;
        let best = val;
        let bestDist = thresholdSec;
        let bestRef: number | null = null;
        for (const s of snaps) {
          const dist = Math.abs(s - val);
          if (dist < bestDist) { bestDist = dist; best = s; bestRef = s; }
        }
        return { v: best, line: bestRef };
      };

      const overlaps = (id: string, track: string, start: number, end: number, all: Clip[]) => {
        return all.some(o => o.id !== id && o.track === track && !(end <= o.start_time || start >= o.end_time));
      };

      onLiveUpdate(prev => {
        const updated = prev.map(c => {
          if (c.id !== d.clipId) return c;
          if (d.mode === "move") {
            const len = d.originEnd - d.originStart;
            let ns = d.originStart + dSec;
            ns = Math.max(0, ns);
            const { v: snappedStart, line } = snap(ns);
            ns = snappedStart;
            let ne = ns + len;
            if (ne > duration) { ne = duration; ns = ne - len; }

            // Track switching by vertical movement
            let newTrack = d.originTrack;
            const dy = e.clientY - (d.laneRect.top + 22);
            const laneHeight = 44;
            const tIndex = Math.max(0, Math.min(TRACK_KEYS.length - 1, d.originTrackIndex + Math.round(dy / laneHeight)));
            newTrack = TRACK_KEYS[tIndex];

            setSnapLine(line);
            return { ...c, start_time: ns, end_time: ne, track: newTrack };
          }
          if (d.mode === "trim-left") {
            let ns = d.originStart + dSec;
            ns = Math.max(0, Math.min(d.originEnd - minLen, ns));
            const { v, line } = snap(ns);
            setSnapLine(line);
            return { ...c, start_time: Math.max(0, Math.min(d.originEnd - minLen, v)) };
          }
          // trim-right
          let ne = d.originEnd + dSec;
          ne = Math.min(duration, Math.max(d.originStart + minLen, ne));
          const { v, line } = snap(ne);
          setSnapLine(line);
          return { ...c, end_time: Math.min(duration, Math.max(d.originStart + minLen, v)) };
        });

        // Check collision for the dragged clip
        const moved = updated.find(c => c.id === d.clipId)!;
        const collides = overlaps(moved.id, moved.track, moved.start_time, moved.end_time, updated);
        setCollidingId(collides ? moved.id : null);

        return updated;
      });
    };

    const onUp = () => {
      const d = dragRef.current;
      if (!d) return;
      dragRef.current = null;
      document.body.style.cursor = "";
      setSnapLine(null);

      const overlaps = (id: string, track: string, start: number, end: number, all: Clip[]) => {
        return all.some(o => o.id !== id && o.track === track && !(end <= o.start_time || start >= o.end_time));
      };

      onLiveUpdate(prev => {
        const moved = prev.find(c => c.id === d.clipId);
        if (moved && overlaps(moved.id, moved.track, moved.start_time, moved.end_time, prev)) {
          // Revert collision
          const reverted = prev.map(c => c.id === d.clipId
            ? { ...c, start_time: d.originStart, end_time: d.originEnd, track: d.originTrack }
            : c);
          onCommit(reverted);
          setCollidingId(null);
          return reverted;
        }
        onCommit(prev);
        setCollidingId(null);
        return prev;
      });
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [clips, duration, currentTime, onCommit, onLiveUpdate]);

  // Multi-level ticks
  const ticks = Array.from({ length: Math.ceil(duration) + 1 }, (_, i) => i);

  return (
    <div className="h-64 shrink-0 relative bg-obsidian flex flex-col bg-grain">
      <div className="absolute inset-x-0 top-0 divider-h" />

      {/* Toolbar */}
      <div className="h-9 flex items-center gap-1 px-2 border-b border-border/50 bg-obsidian/80">
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1.5" onClick={onSplit} title="Split at playhead (S)">
          <Scissors className="size-3.5" /> Split
        </Button>
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1.5 disabled:opacity-40" onClick={onDelete} disabled={!selectedClipId} title="Delete (Del)">
          <Trash2 className="size-3.5" /> Delete
        </Button>
        <div className="w-px h-4 bg-border mx-1" />
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1.5" onClick={onUndo} title="Undo (⌘Z)">
          <Undo2 className="size-3.5" /> Undo
        </Button>
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1.5" onClick={onRedo} title="Redo (⌘⇧Z)">
          <Redo2 className="size-3.5" /> Redo
        </Button>
        <div className="ml-auto text-[10px] uppercase tracking-widest text-muted-foreground/60 font-semibold pr-2">
          {selectedClipId ? "1 clip selected" : "—"}
        </div>
      </div>

      {/* Ruler */}
      <div className="h-7 relative flex items-stretch">
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
              <div key={i} className="absolute top-0 bottom-0 flex flex-col items-start" style={{ left: `${left}%` }}>
                <div className={cn("w-px", isMajor ? "h-full bg-border-strong" : isMid ? "h-2/3 bg-border" : "h-1/3 bg-border/50")} />
                {(isMajor || isMid) && (
                  <span className="absolute top-1 left-1 text-[9px] text-muted-foreground/80 font-mono tabular-nums">{i}s</span>
                )}
              </div>
            );
          })}

          {hoverTime !== null && (
            <div className="absolute top-0 bottom-0 w-px bg-foreground/30 pointer-events-none z-10" style={{ left: hoverX }}>
              <div className="absolute -top-0.5 left-1.5 px-1.5 py-0.5 rounded bg-foreground text-background text-[9px] font-mono font-semibold whitespace-nowrap">
                {fmt(hoverTime)}
              </div>
            </div>
          )}

          <div className="absolute top-0 bottom-0 w-px bg-amber z-20 pointer-events-none" style={{ left: `${(currentTime / duration) * 100}%` }}>
            <div className="absolute -top-1 -left-[5px] size-3 bg-amber rotate-45" />
          </div>
        </div>
      </div>

      {/* Tracks */}
      <div ref={lanesContainerRef} className="flex-1 overflow-y-auto scrollbar-thin" onClick={() => onSelectClip(null)}>
        {TRACKS.map((track) => {
          const trackClips = clips.filter((c) => c.track === track.key);
          return (
            <div key={track.key} className="flex items-stretch h-11 relative group/track">
              <div className="absolute inset-x-0 bottom-0 h-px bg-border/40" />

              <div className="w-32 shrink-0 relative flex items-center gap-2 px-3 bg-obsidian">
                <div className="absolute right-0 top-0 bottom-0 divider-v" />
                <div className="size-1.5 rounded-full shrink-0" style={{ backgroundColor: track.color }} />
                <track.icon className="size-3 text-muted-foreground" />
                <span className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">{track.label}</span>
              </div>

              <div data-lane className="flex-1 relative bg-black/30">
                {trackClips.map((c) => {
                  const left = (c.start_time / duration) * 100;
                  const width = ((c.end_time - c.start_time) / duration) * 100;
                  const asset = assets.find(a => a.id === c.asset_id);
                  const label = asset?.name || c.effects?.text || c.effects?.kind || "clip";
                  const selected = selectedClipId === c.id;
                  return (
                    <div
                      key={c.id}
                      onMouseDown={(e) => beginClipDrag(e, c, "move")}
                      onClick={(e) => { e.stopPropagation(); onSelectClip(c.id); }}
                      className={cn(
                        "absolute top-1 bottom-1 rounded-md text-[10px] flex items-center text-white font-medium overflow-hidden cursor-grab active:cursor-grabbing transition-cinema group/clip",
                        selected && "ring-2 ring-amber ring-offset-1 ring-offset-obsidian z-10"
                      )}
                      style={{
                        left: `${left}%`,
                        width: `${Math.max(width, 1)}%`,
                        background: `linear-gradient(135deg, ${track.color}, ${track.color}cc)`,
                        boxShadow: selected ? undefined : `inset 0 1px 0 rgba(255,255,255,0.25)`,
                      }}
                      title={label}
                    >
                      {/* Left trim handle */}
                      <div
                        onMouseDown={(e) => beginClipDrag(e, c, "trim-left")}
                        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize bg-white/0 hover:bg-white/40 z-10"
                      />
                      <div className="absolute top-0 inset-x-0 h-px bg-white/40" />
                      <span className="truncate relative z-[1] drop-shadow px-2">{label}</span>
                      {/* Right trim handle */}
                      <div
                        onMouseDown={(e) => beginClipDrag(e, c, "trim-right")}
                        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize bg-white/0 hover:bg-white/40 z-10"
                      />
                    </div>
                  );
                })}

                {/* Playhead */}
                <div className="absolute top-0 bottom-0 w-px bg-amber/70 z-10 pointer-events-none" style={{ left: `${(currentTime / duration) * 100}%` }} />

                {/* Snap guide */}
                {snapLine !== null && (
                  <div className="absolute top-0 bottom-0 w-px bg-accent z-20 pointer-events-none" style={{ left: `${(snapLine / duration) * 100}%` }} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Timeline;
