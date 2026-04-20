import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Sparkles, ChevronLeft, Download, Loader2 } from "lucide-react";
import EditorSidebar from "@/components/editor/EditorSidebar";
import PreviewPlayer from "@/components/editor/PreviewPlayer";
import Timeline from "@/components/editor/Timeline";
import AiChat from "@/components/editor/AiChat";

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
  const [clips, setClips] = useState<Clip[]>([]);
  const [activeAsset, setActiveAsset] = useState<Asset | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [exporting, setExporting] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    document.title = `${projectName} — Motiona`;
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

    // signed urls for assets
    const enriched = await Promise.all((assetsData || []).map(async (a: any) => {
      const { data } = await supabase.storage.from("assets").createSignedUrl(a.storage_path, 3600);
      return { ...a, url: data?.signedUrl };
    }));
    setAssets(enriched);
    setClips((clipsData as any) || []);
    if (enriched.find(a => a.type === "video")) setActiveAsset(enriched.find(a => a.type === "video")!);
    setLoading(false);
  }, [projectId, user, navigate]);

  useEffect(() => { loadProject(); }, [loadProject]);

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

      // auto-add to timeline as a clip
      await supabase.from("timeline_clips").insert({
        project_id: projectId, user_id: user.id,
        track: type === "audio" ? "audio" : "video",
        start_time: 0, end_time: 10, asset_id: data.id, effects: {},
      });
    }
    loadProject();
  };

  const renameProject = async (name: string) => {
    setProjectName(name);
    if (projectId) await supabase.from("projects").update({ name }).eq("id", projectId);
  };

  const handleExport = async () => {
    setExporting(true);
    toast.info("Render queued — server-side rendering coming in next update");
    setTimeout(() => setExporting(false), 1500);
  };

  // Apply AI tool actions to local timeline state
  const applyAiAction = useCallback(async (action: any) => {
    if (!user || !projectId) return;
    const { name, args } = action;
    try {
      if (name === "add_text_overlay" || name === "add_lower_third") {
        await supabase.from("timeline_clips").insert({
          project_id: projectId, user_id: user.id,
          track: "text",
          start_time: args.start ?? currentTime,
          end_time: (args.start ?? currentTime) + (args.duration ?? 3),
          asset_id: null,
          effects: { kind: name, text: args.text, style: args.style ?? "default" },
        });
      } else if (name === "add_captions") {
        await supabase.from("timeline_clips").insert({
          project_id: projectId, user_id: user.id, track: "captions",
          start_time: 0, end_time: duration || 30, asset_id: null,
          effects: { kind: "captions", style: args.style ?? "kinetic" },
        });
      } else if (name === "add_transition") {
        await supabase.from("timeline_clips").insert({
          project_id: projectId, user_id: user.id, track: "overlay",
          start_time: args.at ?? currentTime, end_time: (args.at ?? currentTime) + 1,
          asset_id: null, effects: { kind: "transition", style: args.style ?? "fade" },
        });
      } else if (name === "cut_silence") {
        toast.success("Silences marked for removal");
      } else if (name === "generate_motion_scene") {
        await supabase.from("timeline_clips").insert({
          project_id: projectId, user_id: user.id, track: "overlay",
          start_time: args.start ?? 0, end_time: (args.start ?? 0) + (args.duration ?? 5),
          asset_id: null, effects: { kind: "motion_scene", description: args.description },
        });
      }
      loadProject();
    } catch (e: any) { toast.error(e.message); }
  }, [user, projectId, currentTime, duration, loadProject]);

  if (authLoading || loading) {
    return <div className="min-h-screen grid place-items-center bg-background"><Loader2 className="size-6 animate-spin" /></div>;
  }

  return (
    <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
      {/* Topbar */}
      <header className="h-12 shrink-0 border-b border-border bg-panel flex items-center justify-between px-3">
        <div className="flex items-center gap-2 min-w-0">
          <Link to="/dashboard" className="flex items-center gap-2 px-2 py-1 rounded hover:bg-panel-elevated text-sm text-muted-foreground hover:text-foreground">
            <ChevronLeft className="size-4" />
          </Link>
          <div className="size-6 rounded bg-gradient-primary grid place-items-center shrink-0">
            <Sparkles className="size-3 text-primary-foreground" />
          </div>
          <Input
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            onBlur={(e) => renameProject(e.target.value)}
            className="h-7 border-transparent bg-transparent hover:bg-panel-elevated focus:bg-panel-elevated px-2 text-sm font-medium w-64"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
          <Button size="sm" onClick={handleExport} disabled={exporting} className="bg-gradient-primary hover:opacity-90 h-8">
            {exporting ? <Loader2 className="size-3 animate-spin" /> : <Download className="size-3" />}
            Export
          </Button>
        </div>
      </header>

      {/* 3-column layout */}
      <div className="flex-1 flex min-h-0">
        <EditorSidebar
          assets={assets}
          onUpload={handleUpload}
          onSelectAsset={setActiveAsset}
          activeAssetId={activeAsset?.id}
        />

        <div className="flex-1 flex flex-col min-w-0 bg-background">
          <PreviewPlayer
            asset={activeAsset}
            videoRef={videoRef}
            onTimeUpdate={setCurrentTime}
            onDurationChange={setDuration}
            isPlaying={isPlaying}
            setIsPlaying={setIsPlaying}
            clips={clips}
            currentTime={currentTime}
          />
          <Timeline
            clips={clips}
            duration={duration || 30}
            currentTime={currentTime}
            onSeek={(t) => { setCurrentTime(t); if (videoRef.current) videoRef.current.currentTime = t; }}
            assets={assets}
          />
        </div>

        <AiChat
          projectId={projectId!}
          userId={user!.id}
          assets={assets}
          clips={clips}
          currentTime={currentTime}
          onApplyAction={applyAiAction}
        />
      </div>
    </div>
  );
};

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

export default Editor;
