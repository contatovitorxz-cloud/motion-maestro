import { Link, useNavigate } from "react-router-dom";
import { Sparkles, Wand2, Scissors, Type, Film, ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { RotatingBorderButton } from "@/components/RotatingBorderButton";

const Index = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    document.title = "meu motion — AI Motion Video Editor";
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const goApp = () => navigate(user ? "/dashboard" : "/auth");

  const features = [
    { icon: Wand2, n: "01", k: "CREATE", t: "AI Motion Scenes", d: "Describe a scene and the AI generates the motion graphic for you." },
    { icon: Scissors, n: "02", k: "EDIT", t: "Smart Cuts", d: "Auto-trim silences, pick the best takes, fix pacing." },
    { icon: Type, n: "03", k: "CAPTION", t: "Animated Captions", d: "Lower-thirds, callouts and subtitles styled to match your brand." },
    { icon: Film, n: "04", k: "TIMELINE", t: "Pro Timeline", d: "Multi-track editor with keyboard shortcuts you already know." },
  ];

  const Wordmark = ({ className = "" }: { className?: string }) => (
    <span className={`tracking-tight ${className}`}>
      <span className="font-light text-white/70">meu</span>
      <span className="font-bold text-white"> motion</span>
    </span>
  );

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Background layers */}
      <div className="absolute inset-0 bg-grid-faint pointer-events-none" />
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_55%,#000_100%)]" />

      {/* Header */}
      <header
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
          scrolled ? "backdrop-blur-xl bg-black/60 border-b border-white/5" : ""
        }`}
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between px-8 py-4">
          <Link to="/" className="flex items-center gap-2.5 text-base">
            <div className="size-8 rounded-md bg-black border border-white/10 grid place-items-center">
              <Sparkles className="size-3.5 text-white" />
            </div>
            <Wordmark />
          </Link>
          <RotatingBorderButton size="sm" onClick={goApp} disabled={loading}>
            {user ? "Open dashboard" : "Sign in"}
            <ArrowRight className="size-3.5" />
          </RotatingBorderButton>
        </div>
      </header>

      <main className="relative z-10 max-w-6xl mx-auto px-8 pt-40 pb-32 text-center">
        {/* Pill */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.03] text-[11px] uppercase tracking-[0.2em] font-medium text-white/60 mb-10">
          <span className="size-1.5 rounded-full bg-white/80 animate-pulse" />
          v1.0 · Powered by AI
        </div>

        {/* Hero */}
        <h1 className="text-6xl md:text-8xl font-extrabold tracking-[-0.05em] leading-[0.9] mb-8">
          Motion video editing,<br />
          <span className="bg-gradient-to-b from-white to-white/30 bg-clip-text text-transparent">
            driven by AI.
          </span>
        </h1>
        <p className="text-lg text-white/55 max-w-xl mx-auto mb-12 leading-relaxed">
          Upload a clip, chat with the AI, and watch it cut silences, add lower-thirds,
          generate motion scenes and animated captions — in real time.
        </p>

        <div className="flex items-center justify-center gap-3 mb-20">
          <RotatingBorderButton onClick={goApp}>
            Start editing free
            <ArrowRight className="size-4" />
          </RotatingBorderButton>
          <button
            onClick={() => window.scrollTo({ top: 800, behavior: "smooth" })}
            className="h-12 px-6 text-base font-semibold tracking-tight text-white/70 hover:text-white transition-colors"
          >
            See features →
          </button>
        </div>

        {/* Trusted by */}
        <div className="mb-28">
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/30 mb-5">
            Trusted by creators at
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-white/35 text-sm font-semibold tracking-tight">
            <span>Northwave</span>
            <span>Lumen</span>
            <span>Studio Cair</span>
            <span>Halcyon</span>
            <span>Editora Verbo</span>
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-4 gap-3 text-left mb-28">
          {features.map((f) => (
            <div
              key={f.t}
              className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 hover:border-white/20 hover:-translate-y-0.5 transition-all duration-300"
            >
              <div className="text-[10px] font-mono tracking-[0.3em] text-white/30 mb-4">
                {f.n} · {f.k}
              </div>
              <div className="size-9 rounded-md bg-white/5 border border-white/5 grid place-items-center mb-4">
                <f.icon className="size-4 text-white" />
              </div>
              <h3 className="font-semibold text-base tracking-tight mb-1.5 text-white">{f.t}</h3>
              <p className="text-sm text-white/50 leading-relaxed">{f.d}</p>
            </div>
          ))}
        </div>

        {/* Showcase */}
        <div className="text-left mb-10">
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/30 mb-3">The editor</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-[-0.03em] mb-2">
            Multi-track timeline. Real-time AI edits.
          </h2>
          <p className="text-white/50 text-sm">A familiar pro interface — just faster.</p>
        </div>

        <div className="rounded-2xl p-[1px] bg-gradient-to-b from-white/15 to-white/[0.02]">
          <div className="rounded-2xl bg-black/80 backdrop-blur p-5 md:p-7">
            {/* Toolbar */}
            <div className="flex items-center gap-1.5 pb-4 border-b border-white/5 mb-4">
              <span className="size-2.5 rounded-full bg-white/15" />
              <span className="size-2.5 rounded-full bg-white/15" />
              <span className="size-2.5 rounded-full bg-white/15" />
              <span className="ml-3 text-[10px] uppercase tracking-[0.25em] text-white/30 font-mono">
                project · launch_teaser.mm
              </span>
            </div>

            {/* Tracks */}
            <div className="space-y-2 relative">
              {/* Playhead */}
              <div className="absolute top-0 bottom-0 w-px bg-white/40 left-[34%] z-10">
                <div className="absolute -top-1 -left-[3px] size-1.5 rounded-full bg-white" />
              </div>

              {[
                { label: "VIDEO", color: "bg-violet-500/40 border-violet-400/40", blocks: [{ l: 4, w: 38 }, { l: 46, w: 22 }, { l: 72, w: 24 }] },
                { label: "AUDIO", color: "bg-emerald-500/40 border-emerald-400/40", blocks: [{ l: 6, w: 60 }, { l: 70, w: 26 }] },
                { label: "TEXT", color: "bg-amber-500/40 border-amber-400/40", blocks: [{ l: 10, w: 14 }, { l: 30, w: 20 }, { l: 56, w: 18 }, { l: 80, w: 14 }] },
              ].map((t) => (
                <div key={t.label} className="flex items-center gap-3">
                  <div className="w-16 text-[9px] font-mono tracking-[0.2em] text-white/35">{t.label}</div>
                  <div className="flex-1 h-9 relative bg-white/[0.02] rounded-md border border-white/5">
                    {t.blocks.map((b, i) => (
                      <div
                        key={i}
                        className={`absolute top-1 bottom-1 rounded ${t.color} border`}
                        style={{ left: `${b.l}%`, width: `${b.w}%` }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 mt-10">
        <div className="max-w-6xl mx-auto px-8 py-12 grid grid-cols-2 md:grid-cols-4 gap-8 text-sm">
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-3">
              <div className="size-7 rounded-md bg-black border border-white/10 grid place-items-center">
                <Sparkles className="size-3 text-white" />
              </div>
              <Wordmark className="text-sm" />
            </Link>
            <p className="text-white/40 text-xs leading-relaxed">
              Motion video editing, driven by AI.
            </p>
          </div>
          {[
            { h: "Product", l: ["Editor", "Pricing", "Changelog"] },
            { h: "Company", l: ["About", "Contact"] },
            { h: "Legal", l: ["Terms", "Privacy"] },
          ].map((col) => (
            <div key={col.h}>
              <p className="text-[10px] uppercase tracking-[0.25em] text-white/40 mb-3 font-semibold">
                {col.h}
              </p>
              <ul className="space-y-2">
                {col.l.map((i) => (
                  <li key={i}>
                    <a href="#" className="text-white/60 hover:text-white transition-colors">
                      {i}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-white/5">
          <div className="max-w-6xl mx-auto px-8 py-5 text-xs text-white/35 flex items-center justify-between">
            <span>© {new Date().getFullYear()} meu motion</span>
            <span>Built with Lovable Cloud</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
