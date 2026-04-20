import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sparkles, Wand2, Scissors, Type, Film, ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";

const Index = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    document.title = "Motiona — AI Motion Video Editor";
  }, []);

  const goApp = () => navigate(user ? "/dashboard" : "/auth");

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-glow pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[600px] bg-primary/10 blur-[120px] rounded-full pointer-events-none" />

      <header className="relative z-10 flex items-center justify-between px-8 py-5 border-b border-border/50 backdrop-blur">
        <Link to="/" className="flex items-center gap-2 font-bold text-lg">
          <div className="size-8 rounded-md bg-gradient-primary grid place-items-center shadow-elegant">
            <Sparkles className="size-4 text-primary-foreground" />
          </div>
          <span>Motiona</span>
        </Link>
        <Button onClick={goApp} disabled={loading} variant="default" className="bg-gradient-primary hover:opacity-90">
          {user ? "Open dashboard" : "Sign in"} <ArrowRight className="size-4" />
        </Button>
      </header>

      <main className="relative z-10 max-w-6xl mx-auto px-8 pt-28 pb-32 text-center">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-border bg-panel/60 text-[11px] uppercase tracking-[0.18em] font-medium text-muted-foreground mb-10">
          <span className="size-1.5 rounded-full bg-success animate-pulse" />
          Powered by Lovable AI · Gemini 3 Flash
        </div>
        <h1 className="text-6xl md:text-8xl font-extrabold tracking-[-0.04em] leading-[0.95] mb-8 text-foreground">
          Motion video editing,<br />
          <span className="text-gradient">driven by AI.</span>
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground/90 max-w-2xl mx-auto mb-12 leading-relaxed font-normal">
          Upload a clip, chat with the AI, and watch it cut silences, add lower-thirds,
          generate motion scenes and animated captions — in real time.
        </p>
        <div className="flex items-center justify-center gap-3 mb-24">
          <Button size="lg" onClick={goApp} className="bg-gradient-primary hover:opacity-90 shadow-elegant h-12 px-7 text-base font-semibold tracking-tight">
            Start editing free <ArrowRight className="size-4" />
          </Button>
          <Button size="lg" variant="outline" className="h-12 px-7 text-base font-semibold tracking-tight" onClick={() => window.scrollTo({ top: 800, behavior: "smooth" })}>
            See features
          </Button>
        </div>

        <div className="grid md:grid-cols-4 gap-4 text-left">
          {[
            { icon: Wand2, t: "AI Motion Scenes", d: "Describe a scene and the AI generates the motion graphic for you." },
            { icon: Scissors, t: "Smart Cuts", d: "Auto-trim silences, pick the best takes, fix pacing." },
            { icon: Type, t: "Animated Captions", d: "Lower-thirds, callouts and subtitles styled to match your brand." },
            { icon: Film, t: "Pro Timeline", d: "Multi-track editor with keyboard shortcuts you already know." },
          ].map((f) => (
            <div key={f.t} className="rounded-xl border border-border bg-panel/50 backdrop-blur p-6 hover:border-primary/40 transition-colors">
              <div className="size-9 rounded-md bg-primary/10 grid place-items-center mb-4">
                <f.icon className="size-4 text-primary" />
              </div>
              <h3 className="font-semibold text-base tracking-tight mb-1.5">{f.t}</h3>
              <p className="text-sm text-muted-foreground/80 leading-relaxed">{f.d}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="relative z-10 border-t border-border/50 py-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Motiona — Built with Lovable Cloud
      </footer>
    </div>
  );
};

export default Index;
