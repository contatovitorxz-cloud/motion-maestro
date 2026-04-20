import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sparkles, Plus, Film, LogOut, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

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
    document.title = "Dashboard — Motiona";
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
    return <div className="min-h-screen grid place-items-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 border-b border-border bg-panel flex items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2 font-bold">
          <div className="size-7 rounded-md bg-gradient-primary grid place-items-center">
            <Sparkles className="size-4 text-primary-foreground" />
          </div>
          Motiona
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground hidden sm:inline">{user?.email}</span>
          <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="size-4" /> Sign out</Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-1">Your projects</h1>
            <p className="text-muted-foreground">Pick up where you left off, or start something new.</p>
          </div>
          <Button onClick={createProject} disabled={creating} className="bg-gradient-primary hover:opacity-90 shadow-elegant">
            {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            New project
          </Button>
        </div>

        {projects.length === 0 ? (
          <Card className="p-16 text-center bg-panel border-dashed border-2 border-border">
            <Film className="size-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">No projects yet</h3>
            <p className="text-muted-foreground mb-6">Create your first project to start editing with AI.</p>
            <Button onClick={createProject} disabled={creating} className="bg-gradient-primary hover:opacity-90">
              <Plus className="size-4" /> Create project
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {projects.map((p) => (
              <Card
                key={p.id}
                onClick={() => navigate(`/editor/${p.id}`)}
                className="group cursor-pointer overflow-hidden bg-panel border-border hover:border-primary/40 transition-all hover:shadow-elegant"
              >
                <div className="aspect-video bg-gradient-panel relative overflow-hidden">
                  {p.thumbnail_url ? (
                    <img src={p.thumbnail_url} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full grid place-items-center">
                      <Film className="size-10 text-muted-foreground/40" />
                    </div>
                  )}
                  <span className="absolute top-2 right-2 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-background/70 backdrop-blur text-muted-foreground">
                    {p.status}
                  </span>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold truncate group-hover:text-primary transition-colors">{p.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Edited {formatDistanceToNow(new Date(p.updated_at), { addSuffix: true })}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
