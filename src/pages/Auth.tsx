import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Sparkles, Loader2, ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { RotatingBorderButton } from "@/components/RotatingBorderButton";

const Auth = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = mode === "signin" ? "Sign in — meu motion" : "Create account — meu motion";
  }, [mode]);

  useEffect(() => {
    if (user) navigate("/dashboard", { replace: true });
  }, [user, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/dashboard` },
        });
        if (error) throw error;
        toast.success("Account created. Check your inbox if confirmation is required.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back");
        navigate("/dashboard", { replace: true });
      }
    } catch (err: any) {
      toast.error(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-black relative overflow-hidden px-6">
      <div className="absolute inset-0 bg-grid-faint pointer-events-none" />
      <div className="absolute inset-0 bg-vignette pointer-events-none" />

      <div className="relative w-full max-w-md surface-panel p-8 rounded-2xl shadow-elegant">
        <div className="flex items-center gap-2.5 mb-8">
          <div className="size-8 rounded-md bg-black border border-white/10 grid place-items-center">
            <Sparkles className="size-4 text-white" />
          </div>
          <span className="wordmark text-base">
            <span className="meu text-white/70">meu </span>
            <span className="motion text-white">motion</span>
          </span>
        </div>

        <h1 className="text-3xl font-extrabold tracking-[-0.04em] leading-[1] mb-2 text-white">
          {mode === "signin" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="text-sm text-white/50 mb-8">
          {mode === "signin" ? "Sign in to continue editing." : "Start creating AI-driven motion videos."}
        </p>

        <form onSubmit={submit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-[10px] uppercase tracking-[0.2em] text-white/60 font-semibold">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@studio.com"
              className="h-11 bg-white/[0.03] border-white/10 text-white placeholder:text-white/30 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-white/30 rounded-lg"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-[10px] uppercase tracking-[0.2em] text-white/60 font-semibold">Password</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="h-11 bg-white/[0.03] border-white/10 text-white placeholder:text-white/30 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-white/30 rounded-lg"
            />
          </div>
          <RotatingBorderButton type="submit" disabled={loading} size="lg" className="w-full">
            {loading ? <Loader2 className="size-4 animate-spin" /> : <>
              {mode === "signin" ? "Sign in" : "Create account"}
              <ArrowRight className="size-4" />
            </>}
          </RotatingBorderButton>
        </form>

        <div className="mt-8 text-center text-sm text-white/50">
          {mode === "signin" ? "No account?" : "Already have one?"}{" "}
          <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="text-white hover:text-white font-semibold underline-offset-4 hover:underline">
            {mode === "signin" ? "Sign up" : "Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Auth;
