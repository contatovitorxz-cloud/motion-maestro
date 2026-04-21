import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Sparkles, ChevronLeft, Download, Loader2 } from "lucide-react";
import { RotatingBorderButton } from "@/components/RotatingBorderButton";
import EditorSidebar from "@/components/editor/EditorSidebar";
import PreviewPlayer from "@/components/editor/PreviewPlayer";
import Timeline from "@/components/editor/Timeline";
import AiChat from "@/components/editor/AiChat";
import EmptyProjectHero from "@/components/editor/EmptyProjectHero";
import AudioInspector from "@/components/editor/AudioInspector";
import { DEFAULT_VOICE_ID } from "@/components/editor/voices";
import { useTimelineHistory } from "@/hooks/useTimelineHistory";

export interface Asset {
  id: string;
  type: "video" | "image" | "audio";
  name: string;
  storage_path: string;
  metadata: any;
  url?: string;
}
export interface Clip {
  id: string;
  track: string;
  start_time: number;
  end_time: number;
  asset_id: string | null;
  effects: any;
}

const Editor = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [projectName, setProjectName] = useState("Untitled Project");
  const [loading, setLoading] = useState(true);
  const [assets, setAssets] = useState<Asset[]>([]);
  const { clips, reset: resetClips, commit: commitClips, setLive: setLiveClips, undo, redo } = useTimelineHistory([]);
  // Always-fresh ref to clips so async/serialized handlers don't read stale closures
  const clipsRef = useRef<Clip[]>([]);
  useEffect(() => { clipsRef.current = clips; }, [clips]);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [activeAsset, setActiveAsset] = useState<Asset | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [latestRenderUrl, setLatestRenderUrl] = useState<string | null>(null);
  const [renderingJobId, setRenderingJobId] = useState<string | null>(null);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>(() => {
    if (typeof window === "undefined") return DEFAULT_VOICE_ID;
    return localStorage.getItem("motiona:lastVoice") || DEFAULT_VOICE_ID;
  });
  const handleSelectVoice = useCallback((id: string) => {
    setSelectedVoiceId(id);
    try { localStorage.setItem("motiona:lastVoice", id); } catch {}
  }, []);

  // ===== Pinned image references =====
  const PIN_KEY = `motiona:pinned:${projectId || "none"}`;
  const PIN_LIMIT = 4;
  const [pinnedAssetIds, setPinnedAssetIds] = useState<string[]>([]);
  useEffect(() => {
    if (!projectId) return;
    try {
      const raw = localStorage.getItem(PIN_KEY);
      setPinnedAssetIds(raw ? JSON.parse(raw) : []);
    } catch { setPinnedAssetIds([]); }
  }, [projectId, PIN_KEY]);
  const persistPins = (ids: string[]) => {
    setPinnedAssetIds(ids);
    try { localStorage.setItem(PIN_KEY, JSON.stringify(ids)); } catch {}
  };
  const handleTogglePin = useCallback((assetId: string) => {
    setPinnedAssetIds(prev => {
      if (prev.includes(assetId)) {
        const next = prev.filter(i => i !== assetId);
        try { localStorage.setItem(PIN_KEY, JSON.stringify(next)); } catch {}
        return next;
      }
      if (prev.length >= PIN_LIMIT) {
        toast.error(`Máximo ${PIN_LIMIT} referências fixadas`);
        return prev;
      }
      const next = [...prev, assetId];
      try { localStorage.setItem(PIN_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [PIN_KEY]);
  const pinnedAssets = assets.filter(a => pinnedAssetIds.includes(a.id) && a.type === "image");

  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    document.title = `${projectName} — meu motion`;
  }, [projectName]);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth", { replace: true });
  }, [authLoading, user, navigate]);

  const loadProject = useCallback(async () => {
    if (!projectId || !user) return;
    setLoading(true);

    const [{ data: project }, { data: assetsData }, { data: clipsData }] = await Promise.all([
      supabase.from("projects").select("*").eq("id", projectId).maybeSingle(),
      supabase.from("assets").select("*").eq("project_id", projectId).order("created_at"),
      supabase.from("timeline_clips").select("*").eq("project_id", projectId).order("start_time"),
    ]);

    if (!project) { toast.error("Project not found"); navigate("/dashboard"); return; }
    setProjectName(project.name);
    if (project.duration) setDuration(Number(project.duration));

    const enriched = await Promise.all((assetsData || []).map(async (a: any) => {
      const { data } = await supabase.storage.from("assets").createSignedUrl(a.storage_path, 3600);
      return { ...a, url: data?.signedUrl };
    }));
    setAssets(enriched);
    resetClips((clipsData as any) || []);
    if (enriched.find(a => a.type === "video")) setActiveAsset(enriched.find(a => a.type === "video")!);
    setLoading(false);
  }, [projectId, user, navigate, resetClips]);

  useEffect(() => { loadProject(); }, [loadProject]);

  // ===== Persist clip changes (debounced upsert/delete diff) =====
  const lastPersistedRef = useRef<Map<string, Clip>>(new Map());
  useEffect(() => {
    // After load, snapshot persisted state
    const map = new Map<string, Clip>();
    clips.forEach(c => map.set(c.id, c));
    lastPersistedRef.current = map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const persistClips = useCallback(async (next: Clip[]) => {
    if (!user || !projectId) return;
    const prevMap = lastPersistedRef.current;
    const nextMap = new Map<string, Clip>();
    next.forEach(c => nextMap.set(c.id, c));

    // Deletions
    const deletions: string[] = [];
    prevMap.forEach((_, id) => { if (!nextMap.has(id)) deletions.push(id); });
    if (deletions.length) await supabase.from("timeline_clips").delete().in("id", deletions);

    // Upserts (insert new + update changed)
    const ups: any[] = [];
    nextMap.forEach((c, id) => {
      const p = prevMap.get(id);
      if (!p || p.start_time !== c.start_time || p.end_time !== c.end_time || p.track !== c.track) {
        ups.push({
          id: c.id, project_id: projectId, user_id: user.id,
          track: c.track, start_time: c.start_time, end_time: c.end_time,
          asset_id: c.asset_id, effects: c.effects ?? {},
        });
      }
    });
    if (ups.length) await supabase.from("timeline_clips").upsert(ups);

    lastPersistedRef.current = nextMap;
  }, [user, projectId]);

  const handleCommit = useCallback((next: Clip[]) => {
    commitClips(next);
    persistClips(next);
  }, [commitClips, persistClips]);

  // ===== Edit ops =====
  const handleSplit = useCallback(() => {
    const t = currentTime;
    const target = clips.find(c => c.start_time < t && c.end_time > t && (selectedClipId ? c.id === selectedClipId : true));
    if (!target) { toast.info("Position the playhead over a clip to split"); return; }
    const left: Clip = { ...target, end_time: t };
    const right: Clip = { ...target, id: crypto.randomUUID(), start_time: t };
    const next = clips.flatMap(c => c.id === target.id ? [left, right] : [c]);
    handleCommit(next);
    setSelectedClipId(right.id);
    toast.success("Clip split");
  }, [clips, currentTime, selectedClipId, handleCommit]);

  const handleDelete = useCallback(() => {
    if (!selectedClipId) return;
    const next = clips.filter(c => c.id !== selectedClipId);
    setSelectedClipId(null);
    handleCommit(next);
  }, [selectedClipId, clips, handleCommit]);

  const handleUndo = useCallback(() => {
    const next = undo();
    if (next) persistClips(next);
  }, [undo, persistClips]);

  const handleRedo = useCallback(() => {
    const next = redo();
    if (next) persistClips(next);
  }, [redo, persistClips]);

  // ===== Keyboard shortcuts =====
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;

      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) handleRedo(); else handleUndo();
        return;
      }
      if (meta && e.key.toLowerCase() === "y") { e.preventDefault(); handleRedo(); return; }

      if (e.key === " ") { e.preventDefault(); setIsPlaying(p => !p); return; }
      if (e.key.toLowerCase() === "s") { e.preventDefault(); handleSplit(); return; }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedClipId) { e.preventDefault(); handleDelete(); }
        return;
      }
      if (e.key.toLowerCase() === "j") {
        const t = Math.max(0, currentTime - 1);
        setCurrentTime(t); if (videoRef.current) videoRef.current.currentTime = t;
        return;
      }
      if (e.key.toLowerCase() === "k") { setIsPlaying(false); return; }
      if (e.key.toLowerCase() === "l") {
        const t = Math.min(duration, currentTime + 1);
        setCurrentTime(t); if (videoRef.current) videoRef.current.currentTime = t;
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        const step = e.shiftKey ? 1 : 1 / 30;
        const t = Math.max(0, currentTime - step);
        setCurrentTime(t); if (videoRef.current) videoRef.current.currentTime = t;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        const step = e.shiftKey ? 1 : 1 / 30;
        const t = Math.min(duration, currentTime + step);
        setCurrentTime(t); if (videoRef.current) videoRef.current.currentTime = t;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleSplit, handleDelete, handleUndo, handleRedo, selectedClipId, currentTime, duration]);

  const probeMediaDuration = (url: string, type: Asset["type"]): Promise<number> => {
    return new Promise((resolve) => {
      if (type === "image") return resolve(5);
      const el = document.createElement(type === "audio" ? "audio" : "video") as HTMLMediaElement;
      el.preload = "metadata";
      el.src = url;
      const done = (d: number) => resolve(Number.isFinite(d) && d > 0 ? d : 10);
      el.onloadedmetadata = () => done(el.duration);
      el.onerror = () => done(10);
      setTimeout(() => done(10), 5000);
    });
  };

  const handleUpload = async (files: File[]) => {
    if (!user || !projectId) return;
    for (const file of files) {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/${projectId}/${crypto.randomUUID()}.${ext}`;
      const type: Asset["type"] = file.type.startsWith("video") ? "video"
        : file.type.startsWith("image") ? "image"
        : file.type.startsWith("audio") ? "audio" : "video";
      const { error: upErr } = await supabase.storage.from("assets").upload(path, file);
      if (upErr) { toast.error(upErr.message); continue; }
      const { data, error } = await supabase.from("assets").insert({
        project_id: projectId, user_id: user.id, type, name: file.name, storage_path: path,
        metadata: { size: file.size },
      }).select().single();
      if (error) { toast.error(error.message); continue; }
      const { data: signed } = await supabase.storage.from("assets").createSignedUrl(path, 3600);
      const enriched = { ...(data as any), url: signed?.signedUrl };
      setAssets(prev => [...prev, enriched]);
      if (type === "video" && !activeAsset) setActiveAsset(enriched);
      toast.success(`Uploaded ${file.name}`);

      // Probe real duration
      const realDuration = signed?.signedUrl ? await probeMediaDuration(signed.signedUrl, type) : 10;

      // Place at end of existing clips on the destination track to avoid overlap
      const track = type === "audio" ? "audio" : "video";
      const lastEnd = clips.filter(c => c.track === track).reduce((m, c) => Math.max(m, c.end_time), 0);

      const newClip: Clip = {
        id: crypto.randomUUID(),
        track,
        start_time: lastEnd,
        end_time: lastEnd + realDuration,
        asset_id: data.id,
        effects: {},
      };

      await supabase.from("timeline_clips").insert({
        id: newClip.id,
        project_id: projectId, user_id: user.id,
        track: newClip.track,
        start_time: newClip.start_time, end_time: newClip.end_time,
        asset_id: data.id, effects: {},
      });

      // Add to local state via history (no full reload)
      const next = [...clips, newClip];
      lastPersistedRef.current.set(newClip.id, newClip);
      commitClips(next);

      // Bump project duration if needed
      const newTotal = Math.max(duration, newClip.end_time);
      if (newTotal > duration) {
        setDuration(newTotal);
        await supabase.from("projects").update({ duration: newTotal }).eq("id", projectId);
      }
    }
  };

  const renameProject = async (name: string) => {
    setProjectName(name);
    if (projectId) await supabase.from("projects").update({ name }).eq("id", projectId);
  };

  // Trigger MP4 render via remote Remotion worker
  const triggerRender = useCallback(async (sceneJson: any, narrationAssetId: string | null) => {
    if (!user || !projectId) return;
    try {
      const { data, error } = await supabase.functions.invoke("enqueue-render", {
        body: {
          projectId,
          scene: sceneJson,
          narrationAssetId,
          pinnedAssetIds,
        },
      });
      if (error) throw error;
      if (data?.jobId) {
        setRenderingJobId(data.jobId);
        toast.loading("🎥 Renderizando MP4…", { id: `render-${data.jobId}`, duration: Infinity });
      }
    } catch (e: any) {
      const msg = e?.message || "Falha ao enfileirar render";
      if (msg.includes("Worker não configurado") || msg.includes("REMOTION_WORKER_URL")) {
        toast.error("Worker do Remotion ainda não configurado — veja worker/README.md");
      } else {
        toast.error(msg);
      }
    }
  }, [user, projectId, pinnedAssetIds]);

  // Realtime: listen for render_job updates on this project
  useEffect(() => {
    if (!user || !projectId) return;
    const channel = supabase
      .channel(`render-jobs-${projectId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "render_jobs", filter: `project_id=eq.${projectId}` },
        (payload) => {
          const row = payload.new as any;
          if (row.status === "done" && row.output_url) {
            setLatestRenderUrl(row.output_url);
            setRenderingJobId(null);
            toast.success("✅ MP4 pronto", {
              id: `render-${row.id}`,
              duration: 8000,
              action: {
                label: "Baixar",
                onClick: () => window.open(row.output_url, "_blank"),
              },
            });
          } else if (row.status === "error") {
            setRenderingJobId(null);
            toast.error(`Render falhou: ${row.error || "erro desconhecido"}`, { id: `render-${row.id}` });
          } else if (row.status === "rendering" && row.progress) {
            toast.loading(`🎥 Renderizando MP4… ${Math.round(row.progress)}%`, {
              id: `render-${row.id}`,
              duration: Infinity,
            });
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, projectId]);

  // Load latest done render on mount
  useEffect(() => {
    if (!projectId) return;
    supabase
      .from("render_jobs")
      .select("output_url")
      .eq("project_id", projectId)
      .eq("status", "done")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => { if (data?.output_url) setLatestRenderUrl(data.output_url); });
  }, [projectId]);

  const handleExport = async () => {
    if (latestRenderUrl) {
      window.open(latestRenderUrl, "_blank");
      return;
    }
    // Try to render the last motion clip on the timeline
    const motionClip = [...clips].reverse().find(c => c.effects?.kind === "motion_scene" && c.effects?.scene);
    if (!motionClip) {
      toast.info("Gere uma motion no chat primeiro — o MP4 sai automaticamente.");
      return;
    }
    setExporting(true);
    await triggerRender(motionClip.effects.scene, null);
    setExporting(false);
  };


  // Track the most recent motion_scene clip id added in the current AI turn,
  // so when narration arrives we can stretch it to match.
  const lastMotionClipRef = useRef<{ id: string; start: number } | null>(null);

  const applyAiAction = useCallback(async (action: any) => {
    if (!user || !projectId) return;
    const { name, args } = action;
    try {
      let newClip: Clip | null = null;

      if (name === "add_text_overlay" || name === "add_lower_third") {
        const start = args.start ?? currentTime;
        newClip = {
          id: crypto.randomUUID(),
          track: "text",
          start_time: start,
          end_time: start + (args.duration ?? 3),
          asset_id: null,
          effects: { kind: name, text: args.text, style: args.style ?? "default" },
        };
      } else if (name === "add_captions") {
        newClip = {
          id: crypto.randomUUID(),
          track: "captions",
          start_time: 0,
          end_time: duration || 30,
          asset_id: null,
          effects: { kind: "captions", style: args.style ?? "kinetic" },
        };
      } else if (name === "add_transition") {
        const start = args.at ?? currentTime;
        newClip = {
          id: crypto.randomUUID(),
          track: "overlay",
          start_time: start,
          end_time: start + 1,
          asset_id: null,
          effects: { kind: "transition", style: args.style ?? "fade" },
        };
      } else if (name === "generate_motion_scene") {
        const start = args.start ?? 0;
        // Coerce/validate the AI scene; fallback to a minimal scene if invalid.
        const { coerceScene } = await import("@/lib/motionScene");
        const scene = coerceScene(args.scene, args.description);
        const sceneDur = scene.durationMs / 1000;
        newClip = {
          id: crypto.randomUUID(),
          track: "overlay",
          start_time: start,
          end_time: start + (args.duration ?? sceneDur),
          asset_id: null,
          effects: { kind: "motion_scene", description: args.description, scene },
        };
        lastMotionClipRef.current = { id: newClip.id, start };
        toast.success(`🎬 Motion gerada — ${sceneDur.toFixed(1)}s na timeline`);
      } else if (name === "cut_silence") {
        toast.success("Silences marked for removal");
        return;
      } else if (name === "generate_narration") {
        const text = (args.text || "").toString().trim();
        if (!text) { toast.error("Narration needs text"); return; }
        const voiceId = args.voice_id || selectedVoiceId;
        const start = typeof args.start === "number" ? args.start : currentTime;
        const tId = toast.loading("🎙️ Generating narration…");
        try {
          const { data, error } = await supabase.functions.invoke("generate-narration", {
            body: { text, voiceId, projectId },
          });
          if (error) throw error;
          if (!data?.assetId) throw new Error("Narration failed");
          const dur = Number(data.duration) || 4;
          const newAsset: Asset = {
            id: data.assetId, type: "audio",
            name: `🎙️ ${text.slice(0, 50)}`,
            storage_path: data.storagePath,
            metadata: { source: "elevenlabs", voiceId, duration: dur, text },
            url: data.signedUrl,
          };
          setAssets(prev => [...prev, newAsset]);

          // In Auto mode the motion clip was just added in the same turn —
          // align the narration to its start and stretch it to match duration.
          const motionRef = lastMotionClipRef.current;
          let placedStart = start;
          let nextClips = clips;
          if (motionRef) {
            placedStart = motionRef.start;
            nextClips = clips.map(c =>
              c.id === motionRef.id
                ? { ...c, end_time: motionRef.start + dur }
                : c
            );
            lastMotionClipRef.current = null;
          } else {
            const lastEnd = clips.filter(c => c.track === "audio").reduce((m, c) => Math.max(m, c.end_time), 0);
            placedStart = Math.max(start, lastEnd);
          }

          const audioClip: Clip = {
            id: crypto.randomUUID(), track: "audio",
            start_time: placedStart, end_time: placedStart + dur,
            asset_id: data.assetId,
            effects: { kind: "narration", text, voiceId, volume: 100 },
          };
          // Stretch any captions clip from this turn to cover full duration
          const totalEnd = placedStart + dur;
          nextClips = nextClips.map(c =>
            c.track === "captions" && c.start_time === 0
              ? { ...c, end_time: Math.max(c.end_time, totalEnd) }
              : c
          );
          const next = [...nextClips, audioClip];
          handleCommit(next);
          setSelectedClipId(audioClip.id);
          toast.success("Narration added to audio track", { id: tId });
          const newTotal = Math.max(duration, audioClip.end_time);
          if (newTotal > duration) {
            setDuration(newTotal);
            await supabase.from("projects").update({ duration: newTotal }).eq("id", projectId);
          }
          // If a motion scene was generated in the same AI turn, kick off a real MP4 render.
          const motionWithScene = next.find(c => c.effects?.kind === "motion_scene" && c.effects?.scene);
          if (motionWithScene) {
            // Update the scene durationMs to match narration so MP4 length matches voice
            const stretchedScene = {
              ...motionWithScene.effects.scene,
              durationMs: Math.round(dur * 1000),
            };
            triggerRender(stretchedScene, data.assetId);
          }
        } catch (e: any) {
          toast.error(e.message || "Narration failed", { id: tId });
        }
        return;
      }

      if (newClip) {
        const next = [...clips, newClip];
        handleCommit(next);
        setSelectedClipId(newClip.id);
        toast.success(`AI added: ${name.replace(/_/g, " ")}`);
      }
    } catch (e: any) { toast.error(e.message); }
  }, [user, projectId, currentTime, duration, clips, handleCommit, selectedVoiceId, triggerRender]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="size-10 rounded-xl bg-gradient-primary grid place-items-center animate-glow-pulse">
            <Sparkles className="size-5 text-primary-foreground" />
          </div>
          <span className="label-pro">Loading session</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
      <header className="h-14 shrink-0 relative bg-black backdrop-blur-xl flex items-center justify-between px-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/dashboard" className="flex items-center justify-center size-8 rounded-md hover:bg-white/5 text-white/60 hover:text-white transition-colors">
            <ChevronLeft className="size-4" />
          </Link>
          <div className="size-8 rounded-md bg-black border border-white/10 grid place-items-center shrink-0">
            <Sparkles className="size-4 text-white" />
          </div>
          <span className="wordmark text-sm hidden md:inline">
            <span className="meu text-white/70">meu </span>
            <span className="motion text-white">motion</span>
          </span>
          <div className="h-5 w-px bg-white/10 mx-1 hidden md:block" />
          <Input
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            onBlur={(e) => renameProject(e.target.value)}
            className="h-8 border-transparent bg-transparent hover:bg-white/5 focus:bg-white/5 px-3 text-sm font-semibold w-72 tracking-tight text-white focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>

        <div className="absolute left-1/2 -translate-x-1/2 hidden md:flex items-center gap-3 px-4 py-1.5 rounded-md bg-white/[0.03] border border-white/10">
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/40">TC</span>
          <span className="font-mono text-sm font-semibold text-white tabular-nums">
            {formatTime(currentTime)}
          </span>
          <span className="text-white/30">/</span>
          <span className="font-mono text-xs text-white/50 tabular-nums">
            {formatTime(duration)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <RotatingBorderButton onClick={handleExport} disabled={exporting} size="sm">
            {exporting ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
            Export
          </RotatingBorderButton>
        </div>
      </header>

      <div className="flex-1 flex min-h-0 relative">
        <AiChat
          projectId={projectId!}
          userId={user!.id}
          assets={assets}
          clips={clips}
          currentTime={currentTime}
          onApplyAction={applyAiAction}
          selectedVoiceId={selectedVoiceId}
          onSelectVoice={handleSelectVoice}
          pinnedAssets={pinnedAssets}
          onTogglePin={handleTogglePin}
        />

        <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-background relative">
          {clips.length === 0 && assets.filter(a => a.type === "video").length === 0 ? (
            <EmptyProjectHero onUpload={handleUpload} />
          ) : (
            <>
              <div className="absolute inset-0 bg-gradient-glow pointer-events-none" />
              <PreviewPlayer
                asset={activeAsset}
                videoRef={videoRef}
                onTimeUpdate={setCurrentTime}
                onDurationChange={(d) => setDuration(prev => Math.max(prev, d))}
                isPlaying={isPlaying}
                setIsPlaying={setIsPlaying}
                clips={clips}
                currentTime={currentTime}
                assets={assets}
              />
              {(() => {
                const sel = clips.find(c => c.id === selectedClipId);
                if (!sel || sel.track !== "audio") return null;
                const selAsset = assets.find(a => a.id === sel.asset_id) || null;
                return (
                  <AudioInspector
                    clip={sel}
                    asset={selAsset}
                    projectId={projectId!}
                    onClose={() => setSelectedClipId(null)}
                    onDelete={handleDelete}
                    onUpdateClip={(next) => {
                      const updated = clips.map(c => c.id === next.id ? next : c);
                      handleCommit(updated);
                    }}
                    onReplaceAsset={(newAsset, dur) => {
                      setAssets(prev => [...prev, newAsset]);
                      const updated = clips.map(c => c.id === sel.id
                        ? { ...c, asset_id: newAsset.id, end_time: c.start_time + dur, effects: { ...(c.effects||{}), text: newAsset.metadata?.text, voiceId: newAsset.metadata?.voiceId } }
                        : c);
                      handleCommit(updated);
                    }}
                  />
                );
              })()}
              <Timeline
                clips={clips}
                duration={Math.max(duration, clips.reduce((m, c) => Math.max(m, c.end_time), 0), 30)}
                currentTime={currentTime}
                onSeek={(t) => { setCurrentTime(t); if (videoRef.current) videoRef.current.currentTime = t; }}
                assets={assets}
                selectedClipId={selectedClipId}
                onSelectClip={setSelectedClipId}
                onLiveUpdate={setLiveClips}
                onCommit={handleCommit}
                onSplit={handleSplit}
                onDelete={handleDelete}
                onUndo={handleUndo}
                onRedo={handleRedo}
              />
            </>
          )}
        </div>

        <EditorSidebar
          assets={assets}
          onUpload={handleUpload}
          onSelectAsset={setActiveAsset}
          activeAssetId={activeAsset?.id}
          pinnedAssetIds={pinnedAssetIds}
          onTogglePin={handleTogglePin}
        />
      </div>
    </div>
  );
};

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, "0");
  const ms = Math.floor((s % 1) * 100).toString().padStart(2, "0");
  return `${m.toString().padStart(2, "0")}:${sec}:${ms}`;
}

export default Editor;
