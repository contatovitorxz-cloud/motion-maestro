import { Link } from "react-router-dom";
import { ChevronLeft, Download, Upload, Loader2, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";

interface Props {
  projectName: string;
  onRename: (name: string) => void;
  onOpenImport: () => void;
  onExport: () => void;
  exporting: boolean;
}

const TopBar = ({ projectName, onRename, onOpenImport, onExport, exporting }: Props) => {
  return (
    <header
      className="h-12 shrink-0 flex items-center justify-between px-3 border-b"
      style={{ backgroundColor: "#0a0a0a", borderColor: "rgba(255,255,255,0.06)" }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Link
          to="/dashboard"
          className="size-7 rounded-md grid place-items-center text-white/60 hover:bg-white/[0.05] hover:text-white transition-colors"
          title="Voltar"
        >
          <ChevronLeft className="size-4" />
        </Link>
        <div
          className="size-7 rounded-md grid place-items-center"
          style={{ background: "linear-gradient(135deg,#7B2CBF,#FFB627)" }}
        >
          <Sparkles className="size-3.5 text-black" />
        </div>
        <span className="text-sm font-bold tracking-tight text-white">Motion</span>
        <span className="text-white/30 mx-1">·</span>
        <Input
          value={projectName}
          onChange={(e) => onRename(e.target.value)}
          onBlur={(e) => onRename(e.target.value)}
          className="h-7 w-56 border-transparent bg-transparent hover:bg-white/[0.05] focus:bg-white/[0.05] px-2 text-xs text-white/80 focus-visible:ring-0 focus-visible:ring-offset-0"
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenImport}
          className="flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium text-white/80 hover:text-white border transition-colors"
          style={{ backgroundColor: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)" }}
        >
          <Upload className="size-3.5" />
          Importar
        </button>
        <button
          type="button"
          onClick={onExport}
          disabled={exporting}
          className="flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-bold text-black disabled:opacity-50"
          style={{ backgroundColor: "#FFB627" }}
        >
          {exporting ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
          Exportar
        </button>
      </div>
    </header>
  );
};

export default TopBar;
