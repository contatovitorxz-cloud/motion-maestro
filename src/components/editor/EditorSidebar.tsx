import { useDropzone } from "react-dropzone";
import { Upload, Film, Image as ImageIcon, Music, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Asset } from "@/pages/Editor";

interface Props {
  assets: Asset[];
  onUpload: (files: File[]) => void;
  onSelectAsset: (asset: Asset) => void;
  activeAssetId?: string;
}

const presets = [
  { label: "Lower-third", desc: "Animated name + title" },
  { label: "Kinetic captions", desc: "Word-by-word reveal" },
  { label: "Glitch transition", desc: "Quick cut" },
  { label: "Logo reveal", desc: "Motion intro" },
];

const EditorSidebar = ({ assets, onUpload, onSelectAsset, activeAssetId }: Props) => {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "video/*": [], "image/*": [], "audio/*": [] },
    onDrop: onUpload,
    noClick: true,
  });

  const iconFor = (t: string) => t === "video" ? Film : t === "image" ? ImageIcon : Music;

  return (
    <aside className="w-64 shrink-0 border-r border-border bg-panel flex flex-col min-h-0">
      <div {...getRootProps()} className={cn(
        "p-3 border-b border-border transition-colors",
        isDragActive && "bg-primary/10"
      )}>
        <input {...getInputProps()} />
        <label className="block">
          <input
            type="file" multiple hidden
            accept="video/*,image/*,audio/*"
            onChange={(e) => e.target.files && onUpload(Array.from(e.target.files))}
          />
          <Button asChild variant="outline" className="w-full justify-start cursor-pointer hover:border-primary/50 hover:bg-primary/5">
            <span><Upload className="size-4" /> {isDragActive ? "Drop files…" : "Upload media"}</span>
          </Button>
        </label>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="p-3">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Project assets ({assets.length})
          </h3>
          {assets.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">No assets yet. Drag files here.</p>
          ) : (
            <div className="space-y-1">
              {assets.map((a) => {
                const Icon = iconFor(a.type);
                return (
                  <button
                    key={a.id}
                    onClick={() => a.type === "video" && onSelectAsset(a)}
                    className={cn(
                      "w-full flex items-center gap-2 p-2 rounded text-left text-xs hover:bg-panel-elevated transition-colors",
                      activeAssetId === a.id && "bg-panel-elevated ring-1 ring-primary/40"
                    )}
                  >
                    <div className="size-8 rounded bg-secondary grid place-items-center shrink-0 overflow-hidden">
                      {a.type === "image" && a.url ? (
                        <img src={a.url} alt="" className="size-full object-cover" />
                      ) : (
                        <Icon className="size-3.5 text-muted-foreground" />
                      )}
                    </div>
                    <span className="truncate">{a.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-3 border-t border-border">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
            <Wand2 className="size-3" /> Motion presets
          </h3>
          <div className="space-y-1">
            {presets.map((p) => (
              <button key={p.label} className="w-full text-left p-2 rounded hover:bg-panel-elevated transition-colors group">
                <div className="text-xs font-medium group-hover:text-primary">{p.label}</div>
                <div className="text-[10px] text-muted-foreground">{p.desc}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
};

export default EditorSidebar;
