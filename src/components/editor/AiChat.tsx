import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Sparkles, Loader2, Wand2, CheckCircle2, Scissors, Captions, Type, Zap } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import type { Asset, Clip } from "@/pages/Editor";
import { toast } from "sonner";

interface Props {
  projectId: string;
  userId: string;
  assets: Asset[];
  clips: Clip[];
  currentTime: number;
  onApplyAction: (action: { name: string; args: any }) => void;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  actions?: { name: string; args: any }[];
}

const SUGGESTIONS = [
  { icon: Scissors, text: "Cut all the silences", hint: "Auto-detect" },
  { icon: Captions, text: "Add kinetic captions for the whole video", hint: "Word reveal" },
  { icon: Type, text: "Add a lower-third with my name at 0:03", hint: "Identity card" },
  { icon: Zap, text: "Create a motion opening scene", hint: "Hook intro" },
];

const AiChat = ({ projectId, userId, assets, clips, currentTime, onApplyAction }: Props) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [focused, setFocused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("chat_messages")
        .select("*").eq("project_id", projectId).order("created_at");
      setMessages((data || []).map((m: any) => ({
        id: m.id, role: m.role, content: m.content,
        actions: Array.isArray(m.applied_actions) ? m.applied_actions : [],
      })));
    })();
  }, [projectId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  const send = async (text: string) => {
    if (!text.trim() || streaming) return;
    setInput("");
    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: text };
    setMessages((p) => [...p, userMsg]);
    await supabase.from("chat_messages").insert({
      project_id: projectId, user_id: userId, role: "user", content: text,
    });

    setStreaming(true);
    let assistantText = "";
    let actions: { name: string; args: any }[] = [];
    const assistantId = crypto.randomUUID();
    setMessages((p) => [...p, { id: assistantId, role: "assistant", content: "", actions: [] }]);

    const upsertAssistant = (chunk: string) => {
      assistantText += chunk;
      setMessages((p) => p.map(m => m.id === assistantId ? { ...m, content: assistantText } : m));
    };
    const addAction = (action: { name: string; args: any }) => {
      actions.push(action);
      onApplyAction(action);
      setMessages((p) => p.map(m => m.id === assistantId ? { ...m, actions: [...actions] } : m));
    };

    try {
      const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-edit`;
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
          context: {
            assets: assets.map(a => ({ id: a.id, type: a.type, name: a.name })),
            clips: clips.map(c => ({ track: c.track, start: c.start_time, end: c.end_time, effects: c.effects })),
            currentTime,
          },
        }),
      });

      if (!resp.ok) {
        if (resp.status === 429) toast.error("Rate limit — try again in a moment");
        else if (resp.status === 402) toast.error("Add AI credits in your workspace");
        else toast.error("AI request failed");
        setStreaming(false);
        return;
      }
      if (!resp.body) throw new Error("No body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let done = false;

      while (!done) {
        const { done: d, value } = await reader.read();
        if (d) break;
        buffer += decoder.decode(value, { stream: true });
        let newline: number;
        while ((newline = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newline);
          buffer = buffer.slice(newline + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") { done = true; break; }
          try {
            const parsed = JSON.parse(json);
            const delta = parsed.choices?.[0]?.delta;
            if (delta?.content) upsertAssistant(delta.content);
            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                if (tc.function?.name && tc.function?.arguments) {
                  try {
                    const args = JSON.parse(tc.function.arguments);
                    addAction({ name: tc.function.name, args });
                  } catch {}
                }
              }
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      await supabase.from("chat_messages").insert({
        project_id: projectId, user_id: userId, role: "assistant",
        content: assistantText || "Done.",
        applied_actions: actions,
      });
    } catch (e: any) {
      toast.error(e.message || "Stream error");
    } finally {
      setStreaming(false);
    }
  };

  return (
    <aside className="w-96 shrink-0 bg-obsidian flex flex-col min-h-0 relative bg-grain">
      {/* Right divider */}
      <div className="absolute top-0 right-0 bottom-0 divider-v" />

      {/* Header */}
      <div className="h-12 shrink-0 relative flex items-center gap-3 px-4">
        <div className="absolute inset-x-0 bottom-0 divider-h" />
        <div className="relative">
          <div className="size-7 rounded-lg bg-gradient-primary grid place-items-center shadow-elegant">
            <Sparkles className="size-3.5 text-primary-foreground" />
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-success ring-2 ring-obsidian animate-pulse-soft" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold tracking-tight">AI Director</span>
          <span className="text-[10px] text-success font-medium">● Online</span>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="py-6 animate-fade-in">
            <div className="text-center mb-6">
              <div className="size-14 mx-auto mb-3 rounded-2xl bg-gradient-primary grid place-items-center">
                <Wand2 className="size-6 text-primary-foreground" />
              </div>
              <h3 className="font-bold text-base tracking-tight mb-1">Edit with words.</h3>
              <p className="text-xs text-muted-foreground max-w-[260px] mx-auto leading-relaxed">
                Tell the AI what you want — it directs the video for you.
              </p>
            </div>
            <div className="space-y-2">
              <div className="label-pro mb-2 px-1">Quick prompts</div>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.text}
                  onClick={() => send(s.text)}
                  className="w-full text-left p-3 rounded-lg glass-panel border border-border/50 hover:border-primary/40 hover:translate-y-[-1px] transition-cinema group flex items-start gap-3"
                >
                  <div className="size-8 rounded-md bg-gradient-primary-soft border border-primary/20 grid place-items-center shrink-0 group-hover:bg-gradient-primary group-hover:border-transparent transition-cinema">
                    <s.icon className="size-3.5 text-primary group-hover:text-primary-foreground transition-cinema" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium leading-snug">{s.text}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{s.hint}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={cn("flex flex-col gap-2 animate-fade-in", m.role === "user" ? "items-end" : "items-start")}>
            <div className={cn(
              "max-w-[88%] px-3.5 py-2.5 text-sm leading-relaxed shadow-panel",
              m.role === "user"
                ? "bg-gradient-primary text-primary-foreground rounded-2xl rounded-tr-sm font-medium"
                : "glass-panel border border-border-strong/40 rounded-2xl rounded-tl-sm"
            )}>
              {m.role === "assistant" ? (
                <div className="prose prose-sm prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_p]:text-foreground/95">
                  <ReactMarkdown>{m.content || (streaming ? "▍" : "")}</ReactMarkdown>
                </div>
              ) : (
                <div className="whitespace-pre-wrap">{m.content}</div>
              )}
            </div>
            {m.actions && m.actions.length > 0 && (
              <div className="space-y-1.5 w-full">
                {m.actions.map((a, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs px-3 py-2 bg-success/10 border border-success/25 rounded-lg text-success animate-slide-in-left">
                    <CheckCircle2 className="size-3.5 shrink-0" />
                    <span className="font-semibold capitalize">{a.name.replace(/_/g, " ")}</span>
                    <span className="text-muted-foreground/70 truncate text-[10px] font-mono">{JSON.stringify(a.args).slice(0, 50)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className="p-3 relative"
      >
        <div className="absolute inset-x-0 top-0 divider-h" />
        <div className={cn(
          "rounded-xl glass-panel border transition-cinema p-2",
          focused ? "border-primary/50 shadow-[0_0_24px_-4px_hsl(var(--primary)/0.4)]" : "border-border-strong/40"
        )}>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
            placeholder="Direct the edit…"
            className="min-h-[56px] resize-none bg-transparent border-0 text-sm focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/60"
            disabled={streaming}
          />
          <div className="flex items-center justify-between pt-1 px-1">
            <span className="text-[10px] text-muted-foreground/70 font-mono">⏎ send · ⇧⏎ newline</span>
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || streaming}
              className="size-9 rounded-full bg-gradient-primary hover:opacity-90 disabled:opacity-30 transition-cinema shadow-elegant"
            >
              {streaming ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
            </Button>
          </div>
        </div>
        <div className="text-center mt-2">
          <span className="text-[9px] text-muted-foreground/50 font-mono uppercase tracking-widest">Powered by Gemini 3 Flash</span>
        </div>
      </form>
    </aside>
  );
};

export default AiChat;
