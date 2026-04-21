import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Sparkles, Plus, Film, LogOut, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { RotatingBorderButton } from "@/components/RotatingBorderButton";

interface Project {
  id: string;
  name: string;
  thumbnail_url: string | null;
  duration: number | null;
  status: string;
  updated_at: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    document.title = "Dashboard — meu motion";
  }, []);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth", { replace: true });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) toast.error(error.message);
      else setProjects(data || []);
      setLoading(false);
    })();
  }, [user]);

  const createProject = async () => {
    if (!user) return;
    setCreating(true);
    const { data, error } = await supabase
      .from("projects")
      .insert({ user_id: user.id, name: "Untitled Project" })
      .select()
      .single();
    setCreating(false);
    if (error) return toast.error(error.message);
    navigate(`/editor/${data.id}`);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-black">
        <Loader2 className="size-6 animate-spin text-white/40" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black relative">
      <div className="absolute inset-0 bg-grid-faint pointer-events-none" />
      <div className="absolute inset-0 bg-vignette pointer-events-none" />

      <header className="relative h-14 backdrop-blur-xl bg-black/60 border-b border-white/[0.06] flex items-center justify-between px-6 z-10">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="size-7 rounded-md bg-black border border-white/10 grid place-items-center">
            <Sparkles className="size-3.5 text-white" />
          </div>
          <span className="wordmark text-sm">
            <span className="meu text-white/70">meu </span>
            <span className="motion text-white">motion</span>
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-white/40 hidden sm:inline">{user?.email}</span>
          <Button variant="ghost" size="sm" onClick={signOut} className="text-white/60 hover:text-white hover:bg-white/5">
            <LogOut className="size-4" /> Sign out
          </Button>
        </div>
      </header>

      <main className="relative max-w-7xl mx-auto px-6 py-12 z-10">
        <div className="flex items-end justify-between mb-10">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-white/30 mb-3">WORKSPACE</div>
            <h1 className="text-4xl font-extrabold tracking-[-0.04em] leading-[0.95] text-white mb-2">Your projects</h1>
            <p className="text-white/50">Pick up where you left off, or start something new.</p>
          </div>
          <RotatingBorderButton onClick={createProject} disabled={creating} size="sm">
            {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            New project
          </RotatingBorderButton>
        </div>

        {projects.length === 0 ? (
          <div className="surface-panel p-16 text-center rounded-2xl">
            <div className="size-14 rounded-xl bg-white/[0.04] border border-white/10 grid place-items-center mx-auto mb-5">
              <Film className="size-6 text-white/60" />
            </div>
            <h3 className="font-bold text-white text-lg tracking-[-0.02em] mb-2">No projects yet</h3>
            <p className="text-white/50 mb-8 max-w-sm mx-auto">Create your first project to start editing with AI.</p>
            <div className="flex justify-center">
              <RotatingBorderButton onClick={createProject} disabled={creating} size="lg">
                <Plus className="size-4" /> Create your first project <ArrowRight className="size-4" />
              </RotatingBorderButton>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => navigate(`/editor/${p.id}`)}
                className="group text-left surface-panel rounded-xl overflow-hidden hover:border-white/20 hover:-translate-y-0.5 transition-all"
              >
                <div className="aspect-video bg-gradient-to-br from-white/[0.04] to-black relative overflow-hidden border-b border-white/[0.06]">
                  {p.thumbnail_url ? (
                    <img src={p.thumbnail_url} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full grid place-items-center">
                      <Film className="size-10 text-white/15" />
                    </div>
                  )}
                  <span className="absolute top-2 right-2 text-[9px] font-mono uppercase tracking-[0.2em] px-2 py-0.5 rounded bg-black/70 backdrop-blur text-white/60 border border-white/10">
                    {p.status}
                  </span>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold truncate text-white tracking-tight group-hover:text-white">{p.name}</h3>
                  <p className="text-[11px] font-mono text-white/40 mt-1.5">
                    {formatDistanceToNow(new Date(p.updated_at), { addSuffix: true })}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
