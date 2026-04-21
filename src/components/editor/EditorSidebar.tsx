import { useDropzone } from "react-dropzone";
import { Upload, Film, Image as ImageIcon, Music, Wand2, Plus, Sparkles, Pin } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Asset } from "@/pages/Editor";

interface Props {
  assets: Asset[];
  onUpload: (files: File[]) => void;
  onSelectAsset: (asset: Asset) => void;
  activeAssetId?: string;
  pinnedAssetIds?: string[];
  onTogglePin?: (assetId: string) => void;
}

const presets = [
  { label: "Lower-third", desc: "Animated name + title", color: "from-track-text/40 to-track-text/10" },
  { label: "Kinetic captions", desc: "Word-by-word reveal", color: "from-track-captions/40 to-track-captions/10" },
  { label: "Glitch transition", desc: "Quick cut", color: "from-track-overlay/40 to-track-overlay/10" },
  { label: "Logo reveal", desc: "Motion intro", color: "from-track-video/40 to-track-video/10" },
];

const EditorSidebar = ({ assets, onUpload, onSelectAsset, activeAssetId, pinnedAssetIds = [], onTogglePin }: Props) => {
  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    accept: { "video/*": [], "image/*": [], "audio/*": [] },
    onDrop: onUpload,
    noClick: true,
  });

  const iconFor = (t: string) => t === "video" ? Film : t === "image" ? ImageIcon : Music;

  return (
    <aside
      {...getRootProps()}
      className="w-72 shrink-0 bg-black flex flex-col min-h-0 relative border-l border-white/[0.06]"
    >
      <input {...getInputProps()} />

      {/* Left divider */}
      <div className="absolute top-0 left-0 bottom-0 divider-v" />

      {/* Drag overlay */}
      {isDragActive && (
        <div className="absolute inset-2 z-50 rounded-xl border-2 border-dashed border-primary bg-primary/10 backdrop-blur-sm grid place-items-center pointer-events-none animate-fade-in">
          <div className="text-center">
            <Upload className="size-10 mx-auto mb-2 text-primary animate-pulse" />
            <p className="text-sm font-bold text-primary">Drop to import</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="h-12 shrink-0 relative flex items-center justify-between px-4">
        <div className="absolute inset-x-0 bottom-0 divider-h" />
        <div className="flex items-center gap-2">
          <span className="label-pro">Project</span>
          <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
            {assets.length.toString().padStart(2, "0")}
          </span>
        </div>
        <button
          onClick={open}
          className="size-7 rounded-md bg-panel-elevated border border-border-strong/40 hover:border-primary/50 hover:bg-primary/10 grid place-items-center transition-cinema group"
          title="Upload media"
        >
          <Plus className="size-3.5 text-muted-foreground group-hover:text-primary transition-cinema" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {/* Assets */}
        <div className="p-3">
          {assets.length === 0 ? (
            <button
              onClick={open}
              className="w-full py-12 px-4 rounded-xl border border-dashed border-border-strong/60 hover:border-primary/50 hover:bg-primary/5 transition-cinema group"
            >
              <Upload className="size-8 mx-auto mb-2 text-muted-foreground/50 group-hover:text-primary transition-cinema" />
              <p className="text-xs text-muted-foreground">Drag files here</p>
              <p className="text-[10px] text-muted-foreground/60 mt-0.5">or click to browse</p>
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {assets.map((a) => {
                const Icon = iconFor(a.type);
                const isPinned = pinnedAssetIds.includes(a.id);
                const canPin = a.type === "image" && !!onTogglePin;
                return (
                  <div
                    key={a.id}
                    className={cn(
                      "group relative aspect-video rounded-lg overflow-hidden bg-panel border border-white/[0.06] hover:border-white/30 transition-cinema cursor-pointer",
                      activeAssetId === a.id && "border-white ring-1 ring-white/40",
                      isPinned && "border-amber-400/60 ring-2 ring-amber-400/40"
                    )}
                    onClick={() => a.type === "video" && onSelectAsset(a)}
                  >
                    {a.type === "image" && a.url ? (
                      <img src={a.url} alt={a.name} className="size-full object-cover group-hover:scale-105 transition-cinema" />
                    ) : a.type === "video" && a.url ? (
                      <video src={a.url} className="size-full object-cover" muted />
                    ) : (
                      <div className="size-full grid place-items-center bg-white/[0.03]">
                        <Icon className="size-6 text-white/40" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
                    <div className="absolute bottom-1 left-1.5 right-1.5 flex items-center gap-1">
                      <Icon className="size-2.5 text-white/70 shrink-0" />
                      <span className="text-[10px] text-white truncate font-medium">{a.name}</span>
                    </div>
                    {canPin && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onTogglePin!(a.id); }}
                        title={isPinned ? "Desafixar referência" : "Fixar como referência para a AI"}
                        className={cn(
                          "absolute top-1 right-1 size-6 rounded-md grid place-items-center transition-cinema backdrop-blur-md border",
                          isPinned
                            ? "bg-amber-400/90 border-amber-300 text-black opacity-100"
                            : "bg-black/60 border-white/20 text-white/70 opacity-0 group-hover:opacity-100 hover:bg-black/80 hover:text-white"
                        )}
                      >
                        <Pin className={cn("size-3", isPinned && "fill-current")} />
                      </button>
                    )}
                    {activeAssetId === a.id && !isPinned && (
                      <div className="absolute top-1 left-1 size-1.5 rounded-full bg-white" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Presets */}
        <div className="px-3 py-3 relative">
          <div className="absolute top-0 inset-x-3 divider-h" />
          <h3 className="label-pro mb-2.5 flex items-center gap-1.5">
            <Wand2 className="size-3" /> Motion presets
          </h3>
          <div className="space-y-1.5">
            {presets.map((p) => (
              <button
                key={p.label}
                className={cn(
                  "w-full text-left p-2.5 rounded-lg border border-border-strong/30 hover:border-primary/40 transition-cinema group relative overflow-hidden",
                  "bg-gradient-to-br", p.color
                )}
              >
                <div className="flex items-start gap-2.5 relative">
                  <div className="size-7 rounded-md bg-obsidian/60 backdrop-blur grid place-items-center shrink-0 group-hover:scale-110 transition-cinema">
                    <Sparkles className="size-3 text-foreground/80" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold group-hover:text-primary transition-cinema">{p.label}</div>
                    <div className="text-[10px] text-muted-foreground">{p.desc}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
};

export default EditorSidebar;
