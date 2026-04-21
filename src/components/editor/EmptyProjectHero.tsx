import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyProjectHeroProps {
  onUpload: (files: File[]) => void | Promise<void>;
}

const EmptyProjectHero = ({ onUpload }: EmptyProjectHeroProps) => {
  const [busy, setBusy] = useState(false);

  const onDrop = useCallback(async (files: File[]) => {
    if (!files.length) return;
    setBusy(true);
    try {
      await onUpload(files);
    } finally {
      setBusy(false);
    }
  }, [onUpload]);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: { "video/*": [], "image/*": [], "audio/*": [] },
    multiple: true,
    noClick: true,
    noKeyboard: true,
    maxSize: 500 * 1024 * 1024,
  });

  return (
    <div className="flex-1 min-h-0 grid place-items-center p-8 bg-background relative">
      <div className="absolute inset-0 bg-gradient-glow pointer-events-none" />
      <div
        {...getRootProps()}
        className={cn(
          "relative w-full max-w-2xl aspect-[16/10] rounded-2xl border-2 border-dashed bg-obsidian/60 backdrop-blur-sm transition-cinema flex flex-col items-center justify-center gap-6 p-10 text-center",
          isDragActive
            ? "border-primary bg-primary/5 scale-[1.01]"
            : "border-border-strong/50 hover:border-border-strong"
        )}
      >
        <input {...getInputProps()} />

        <div className="size-20 rounded-2xl bg-panel-elevated grid place-items-center">
          {isDragActive ? (
            <Upload className="size-9 text-primary animate-pulse" />
          ) : (
            <Film className="size-9 text-muted-foreground" />
          )}
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">
            {isDragActive ? "Solte para fazer upload" : "Comece pelo seu vídeo"}
          </h2>
          <p className="text-sm text-muted-foreground max-w-md">
            Arraste um vídeo aqui ou clique no botão abaixo. Assim que carregar, ele vai aparecer na timeline pronto para editar.
          </p>
        </div>

        <Button
          size="lg"
          onClick={open}
          disabled={busy}
          className="bg-gradient-primary hover:opacity-90 transition-cinema h-11 px-6 font-semibold"
        >
          <Upload className="size-4" />
          {busy ? "Carregando…" : "Escolher arquivo"}
        </Button>

        <p className="label-pro text-muted-foreground/70">
          MP4 · MOV · WebM · até 500MB
        </p>
      </div>
    </div>
  );
};

export default EmptyProjectHero;
