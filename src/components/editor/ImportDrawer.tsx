import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import EditorSidebar from "./EditorSidebar";
import type { Asset } from "@/pages/Editor";
import { Mic, Volume2, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VOICES } from "./voices";
import { Button } from "@/components/ui/button";
import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  assets: Asset[];
  onUpload: (files: File[]) => void;
  onSelectAsset: (a: Asset) => void;
  activeAssetId?: string;
  pinnedAssetIds: string[];
  onTogglePin: (id: string) => void;
  selectedVoiceId: string;
  onSelectVoice: (id: string) => void;
  projectId: string;
}

const ImportDrawer = ({
  open, onOpenChange, assets, onUpload, onSelectAsset, activeAssetId,
  pinnedAssetIds, onTogglePin, selectedVoiceId, onSelectVoice, projectId,
}: Props) => {
  const [previewing, setPreviewing] = useState(false);
  const cacheRef = useRef<Map<string, string>>(new Map());

  const playPreview = async () => {
    if (previewing) return;
    setPreviewing(true);
    try {
      let url = cacheRef.current.get(selectedVoiceId);
      if (!url) {
        const { data, error } = await supabase.functions.invoke("generate-narration", {
          body: { text: "Olá! Esta é minha voz para a sua narração.", voiceId: selectedVoiceId, projectId },
        });
        if (error) throw error;
        url = data?.signedUrl;
        if (url) cacheRef.current.set(selectedVoiceId, url);
      }
      if (!url) throw new Error("No preview");
      const audio = new Audio(url);
      audio.volume = 0.9;
      await audio.play();
      audio.onended = () => setPreviewing(false);
    } catch (e: any) {
      toast.error(e.message || "Falha no preview");
      setPreviewing(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[360px] sm:w-[400px] p-0 border-l flex flex-col"
        style={{ backgroundColor: "#0a0a0a", borderColor: "rgba(255,255,255,0.08)" }}
      >
        <SheetHeader className="px-4 h-12 flex flex-row items-center border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <SheetTitle className="text-sm font-semibold text-white">Importar</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <EditorSidebar
            assets={assets}
            onUpload={onUpload}
            onSelectAsset={onSelectAsset}
            activeAssetId={activeAssetId}
            pinnedAssetIds={pinnedAssetIds}
            onTogglePin={onTogglePin}
          />
        </div>

        {/* Voice picker */}
        <div className="border-t p-3" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-1.5 mb-2 text-[10px] uppercase tracking-widest font-semibold text-white/60">
            <Mic className="size-3" /> Voz da narração
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedVoiceId} onValueChange={onSelectVoice}>
              <SelectTrigger className="h-8 text-xs flex-1 bg-white/[0.04] border-white/10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VOICES.map((v) => (
                  <SelectItem key={v.id} value={v.id} className="text-xs">
                    <span className="font-semibold">{v.name}</span>
                    <span className="text-muted-foreground ml-2">{v.tone}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={playPreview}
              disabled={previewing}
              className="size-8 hover:bg-white/[0.05]"
              title="Pré-ouvir voz"
            >
              {previewing ? <Loader2 className="size-3.5 animate-spin" /> : <Volume2 className="size-3.5" />}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ImportDrawer;
