import { useState } from "react";
import { Volume2, Mic, Trash2, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Clip, Asset } from "@/pages/Editor";
import { VOICES } from "./voices";

interface Props {
  clip: Clip;
  asset: Asset | null;
  projectId: string;
  onClose: () => void;
  onDelete: () => void;
  onUpdateClip: (next: Clip) => void;
  onReplaceAsset: (newAsset: Asset, duration: number) => void;
}

const AudioInspector = ({ clip, asset, projectId, onClose, onDelete, onUpdateClip, onReplaceAsset }: Props) => {
  const initialVolume = typeof clip.effects?.volume === "number" ? clip.effects.volume : 100;
  const [volume, setVolume] = useState<number>(initialVolume);
  const initialText = clip.effects?.text || asset?.metadata?.text || "";
  const initialVoice = clip.effects?.voiceId || asset?.metadata?.voiceId || VOICES[0].id;
  const [editText, setEditText] = useState(initialText);
  const [voiceId, setVoiceId] = useState<string>(initialVoice);
  const [showRegen, setShowRegen] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const onVolumeChange = (v: number) => {
    setVolume(v);
    onUpdateClip({ ...clip, effects: { ...(clip.effects || {}), volume: v } });
  };

  const onRegenerate = async () => {
    if (!editText.trim()) { toast.error("Provide a script first"); return; }
    setRegenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-narration", {
        body: { text: editText, voiceId, projectId },
      });
      if (error) throw error;
      if (!data?.assetId) throw new Error("No asset returned");
      const newAsset: Asset = {
        id: data.assetId,
        type: "audio",
        name: `🎙️ ${editText.slice(0, 50)}`,
        storage_path: data.storagePath,
        metadata: { source: "elevenlabs", voiceId, duration: data.duration, text: editText },
        url: data.signedUrl,
      };
      onReplaceAsset(newAsset, data.duration);
      toast.success("Narration regenerated");
      setShowRegen(false);
    } catch (e: any) {
      toast.error(e.message || "Failed to regenerate");
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="absolute right-4 top-4 z-30 w-72 rounded-xl bg-obsidian border border-border-strong/60 shadow-xl p-4 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Mic className="size-4 text-primary" />
          <h3 className="text-sm font-semibold tracking-tight">Audio clip</h3>
        </div>
        <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">✕</button>
      </div>

      {/* Volume */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between">
          <span className="label-pro">
            <Volume2 className="size-3 inline mr-1" />
            Volume
          </span>
          <span className="text-xs font-mono tabular-nums text-muted-foreground">{volume}%</span>
        </div>
        <Slider value={[volume]} max={100} step={1} onValueChange={(v) => onVolumeChange(v[0])} />
      </div>

      {/* Regenerate / Replace voice */}
      {!showRegen ? (
        <Button
          size="sm"
          variant="outline"
          className="w-full mb-2 justify-center gap-2"
          onClick={() => setShowRegen(true)}
        >
          <RefreshCw className="size-3.5" /> Trocar voz / Regerar
        </Button>
      ) : (
        <div className="space-y-2 mb-3 p-2 rounded-lg bg-panel-elevated/50 border border-border/50">
          <Textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            placeholder="Texto da narração…"
            className="min-h-[60px] text-xs resize-none"
            disabled={regenerating}
          />
          <Select value={voiceId} onValueChange={setVoiceId} disabled={regenerating}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VOICES.map((v) => (
                <SelectItem key={v.id} value={v.id} className="text-xs">
                  {v.name} <span className="text-muted-foreground ml-1">— {v.tone}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-1.5">
            <Button size="sm" variant="ghost" className="flex-1 h-7 text-xs" onClick={() => setShowRegen(false)} disabled={regenerating}>
              Cancelar
            </Button>
            <Button size="sm" className="flex-1 h-7 text-xs bg-gradient-primary" onClick={onRegenerate} disabled={regenerating}>
              {regenerating ? <Loader2 className="size-3 animate-spin" /> : "Regerar"}
            </Button>
          </div>
        </div>
      )}

      {/* Delete */}
      <Button
        size="sm"
        variant="ghost"
        className="w-full justify-center gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
        onClick={onDelete}
      >
        <Trash2 className="size-3.5" /> Remover clipe
      </Button>
    </div>
  );
};

export default AudioInspector;
