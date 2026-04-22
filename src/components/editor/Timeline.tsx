import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Scissors, Trash2, Undo2, Redo2 } from "lucide-react";
import type { Clip, Asset } from "@/pages/Editor";

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

// Variantes inspiradas no mockup
const TRACK_VARIANTS: Record<
  string,
  { label: string; bg: string; border: string; color: string }
> = {
  video: {
    label: "Vídeo",
    bg: "#2a2a2a",
    border: "#404040",
    color: "rgba(255,255,255,0.85)",
  },
  overlay: {
    label: "Motion",
    bg: "rgba(255,182,39,0.15)",
    border: "rgba(255,182,39,0.4)",
    color: "#FFB627",
  },
  text: {
    label: "Texto",
    bg: "rgba(255,182,39,0.15)",
    border: "rgba(255,182,39,0.4)",
    color: "#FFB627",
  },
  captions: {
    label: "Legendas",
    bg: "rgba(255,182,39,0.15)",
    border: "rgba(255,182,39,0.4)",
    color: "#FFB627",
  },
  audio: {
    label: "Áudio",
    bg: "rgba(76,201,240,0.12)",
    border: "rgba(76,201,240,0.35)",
    color: "rgba(200,230,255,0.95)",
  },
  effect: {
    label: "Efeitos",
    bg: "rgba(255,107,26,0.2)",
    border: "rgba(255,107,26,0.5)",
    color: "rgba(255,220,200,0.95)",
  },
};

const TRACK_ORDER = ["video", "overlay", "text", "audio", "captions"] as const;

const SNAP_THRESHOLD_PX = 8;
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
  visibleTrackKeys: string[];
}

const formatTime = (s: number) => {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const sec = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
};

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

  const visibleTracks = TRACK_ORDER.filter((t) => clips.some((c) => c.track === t));
  const isEmpty = visibleTracks.length === 0;
  const LABEL_W = 96;

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
      originTrackIndex: visibleTracks.indexOf(clip.track as any),
      pxPerSec,
      laneRect,
      visibleTrackKeys: [...visibleTracks],
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

      const snaps: number[] = [0, duration, currentTime];
      clips.forEach((c) => {
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

      const overlaps = (id: string, track: string, start: number, end: number, all: Clip[]) =>
        all.some((o) => o.id !== id && o.track === track && !(end <= o.start_time || start >= o.end_time));

      onLiveUpdate((prev) => {
        const updated = prev.map((c) => {
          if (c.id !== d.clipId) return c;
          if (d.mode === "move") {
            const len = d.originEnd - d.originStart;
            let ns = d.originStart + dSec;
            ns = Math.max(0, ns);
            const { v: snappedStart, line } = snap(ns);
            ns = snappedStart;
            let ne = ns + len;
            if (ne > duration) { ne = duration; ns = ne - len; }

            let newTrack = d.originTrack;
            const dy = e.clientY - (d.laneRect.top + 22);
            const laneHeight = 38;
            const tIndex = Math.max(0, Math.min(d.visibleTrackKeys.length - 1, d.originTrackIndex + Math.round(dy / laneHeight)));
            newTrack = d.visibleTrackKeys[tIndex];

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
          let ne = d.originEnd + dSec;
          ne = Math.min(duration, Math.max(d.originStart + minLen, ne));
          const { v, line } = snap(ne);
          setSnapLine(line);
          return { ...c, end_time: Math.min(duration, Math.max(d.originStart + minLen, v)) };
        });

        const moved = updated.find((c) => c.id === d.clipId)!;
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

      const overlaps = (id: string, track: string, start: number, end: number, all: Clip[]) =>
        all.some((o) => o.id !== id && o.track === track && !(end <= o.start_time || start >= o.end_time));

      onLiveUpdate((prev) => {
        const moved = prev.find((c) => c.id === d.clipId);
        if (moved && overlaps(moved.id, moved.track, moved.start_time, moved.end_time, prev)) {
          const reverted = prev.map((c) => c.id === d.clipId
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
  }, [clips, duration, currentTime, onCommit, onLiveUpdate, visibleTracks]);

  // Régua: marcas a cada 5s, com label
  const tickStep = duration > 60 ? 10 : 5;
  const ticks: number[] = [];
  for (let t = 0; t <= duration; t += tickStep) ticks.push(t);

  return (
    <div
      className="h-[220px] shrink-0 flex flex-col border-t"
      style={{ backgroundColor: "#0a0a0a", borderColor: "rgba(255,255,255,0.06)" }}
    >
      {/* Mini toolbar (ações do clip) */}
      <div
        className="h-7 flex items-center gap-1 px-2 border-b"
        style={{ borderColor: "rgba(255,255,255,0.06)" }}
      >
        <button onClick={onSplit} title="Cortar (S)" className="h-6 px-2 text-[11px] gap-1 rounded text-white/70 hover:text-white hover:bg-white/[0.05] flex items-center">
          <Scissors className="size-3" /> Cortar
        </button>
        <button onClick={onDelete} disabled={!selectedClipId} title="Apagar (Del)" className="h-6 px-2 text-[11px] gap-1 rounded text-white/70 hover:text-white hover:bg-white/[0.05] disabled:opacity-30 flex items-center">
          <Trash2 className="size-3" /> Apagar
        </button>
        <div className="w-px h-3 bg-white/10 mx-1" />
        <button onClick={onUndo} title="Desfazer" className="h-6 px-2 text-[11px] gap-1 rounded text-white/70 hover:text-white hover:bg-white/[0.05] flex items-center">
          <Undo2 className="size-3" /> Desfazer
        </button>
        <button onClick={onRedo} title="Refazer" className="h-6 px-2 text-[11px] gap-1 rounded text-white/70 hover:text-white hover:bg-white/[0.05] flex items-center">
          <Redo2 className="size-3" />
        </button>
        <div className="ml-auto text-[10px] uppercase tracking-widest text-white/30 pr-2">
          {selectedClipId ? "1 clip" : "—"}
        </div>
      </div>

      {/* Régua */}
      <div className="h-6 flex border-b shrink-0" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <div className="shrink-0 border-r" style={{ width: LABEL_W, borderColor: "rgba(255,255,255,0.06)" }} />
        <div
          ref={trackRef}
          className="flex-1 relative cursor-pointer select-none"
          onClick={handleClick}
          onMouseMove={handleMove}
          onMouseLeave={() => setHoverTime(null)}
        >
          {ticks.map((t) => {
            const left = (t / duration) * 100;
            if (left > 100) return null;
            return (
              <div key={t} className="absolute top-0 bottom-0 flex items-center" style={{ left: `${left}%` }}>
                <div style={{ width: 1, height: 8, backgroundColor: "rgba(255,255,255,0.15)", marginRight: 4 }} />
                <span className="text-[9px] font-mono text-white/40">{formatTime(t)}</span>
              </div>
            );
          })}

          {hoverTime !== null && (
            <div className="absolute top-0 bottom-0 w-px bg-white/30 pointer-events-none z-10" style={{ left: hoverX }}>
              <div className="absolute -top-0.5 left-1.5 px-1 py-0.5 rounded bg-white text-black text-[9px] font-mono font-semibold whitespace-nowrap">
                {formatTime(hoverTime)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tracks container */}
      <div ref={lanesContainerRef} className="flex-1 relative overflow-hidden" onClick={() => onSelectClip(null)}>
        {/* Playhead global (cobre tracks) */}
        <div
          className="absolute top-0 bottom-0 z-30 pointer-events-none"
          style={{ left: `calc(${LABEL_W}px + (${(currentTime / duration) * 100}%) * (100% - ${LABEL_W}px) / 100%)` }}
        >
          <div style={{ width: 1, height: "100%", backgroundColor: "#FFB627", boxShadow: "0 0 6px rgba(255,182,39,0.6)" }} />
          <div style={{ position: "absolute", top: -2, left: -5, width: 11, height: 11, backgroundColor: "#FFB627", transform: "rotate(45deg)" }} />
        </div>

        {isEmpty && (
          <div
            className="absolute text-center text-[11px] pointer-events-none"
            style={{ bottom: 16, left: LABEL_W + 16, right: 16, color: "rgba(255,255,255,0.25)" }}
          >
            Peça pro assistente adicionar legendas, áudio ou efeitos
          </div>
        )}

        {visibleTracks.map((trackKey) => {
          const v = TRACK_VARIANTS[trackKey] ?? TRACK_VARIANTS.video;
          const trackClips = clips.filter((c) => c.track === trackKey);
          return (
            <div key={trackKey} className="flex items-stretch h-9 relative">
              <div
                className="shrink-0 flex items-center px-3 border-r"
                style={{ width: LABEL_W, borderColor: "rgba(255,255,255,0.06)" }}
              >
                <span className="text-[10px] uppercase tracking-widest font-semibold text-white/50">{v.label}</span>
              </div>

              <div data-lane className="flex-1 relative" style={{ backgroundColor: "rgba(255,255,255,0.015)" }}>
                {trackClips.map((c) => {
                  const left = (c.start_time / duration) * 100;
                  const width = ((c.end_time - c.start_time) / duration) * 100;
                  const asset = assets.find((a) => a.id === c.asset_id);
                  const isAudio = trackKey === "audio";
                  const isMotion = c.effects?.kind === "motion_scene";
                  const label = isMotion
                    ? `✨ ${c.effects?.description || "AI Motion"}`
                    : asset?.name || c.effects?.text || c.effects?.kind || "clip";
                  const selected = selectedClipId === c.id;
                  const isColliding = collidingId === c.id;
                  return (
                    <div
                      key={c.id}
                      onMouseDown={(e) => beginClipDrag(e, c, "move")}
                      onClick={(e) => { e.stopPropagation(); onSelectClip(c.id); }}
                      className={cn(
                        "absolute top-1 bottom-1 rounded-md text-[10px] flex items-center overflow-hidden cursor-grab active:cursor-grabbing transition-colors",
                        selected && "ring-2 ring-offset-1 z-10",
                        isColliding && "ring-2 ring-destructive z-20"
                      )}
                      style={{
                        left: `${left}%`,
                        width: `${Math.max(width, 1)}%`,
                        backgroundColor: v.bg,
                        border: `1px solid ${v.border}`,
                        color: v.color,
                        boxShadow: selected ? "0 0 0 2px #FFB627" : undefined,
                      }}
                      title={label}
                    >
                      <div
                        onMouseDown={(e) => beginClipDrag(e, c, "trim-left")}
                        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-white/30 z-10"
                      />

                      {isAudio ? (
                        <div className="absolute inset-0 flex items-center justify-around px-2 pointer-events-none opacity-70">
                          {Array.from({ length: 50 }).map((_, i) => {
                            const seed = (c.id.charCodeAt(0) + i * 7) % 100;
                            const h = 20 + (seed % 60);
                            return <div key={i} className="rounded-full" style={{ width: 2, height: `${h}%`, backgroundColor: "rgba(200,230,255,0.85)" }} />;
                          })}
                        </div>
                      ) : (
                        <span className="truncate px-2 font-medium">{label}</span>
                      )}

                      <div
                        onMouseDown={(e) => beginClipDrag(e, c, "trim-right")}
                        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-white/30 z-10"
                      />
                    </div>
                  );
                })}

                {snapLine !== null && (
                  <div
                    className="absolute top-0 bottom-0 w-px z-20 pointer-events-none"
                    style={{ left: `${(snapLine / duration) * 100}%`, backgroundColor: "#4CC9F0" }}
                  />
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
