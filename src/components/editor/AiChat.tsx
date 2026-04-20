import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Sparkles, Loader2, Wand2, CheckCircle2 } from "lucide-react";
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
  "Cut all the silences",
  "Add kinetic captions for the whole video",
  "Add a lower-third with my name at 0:03",
  "Create a motion opening scene",
];

const AiChat = ({ projectId, userId, assets, clips, currentTime, onApplyAction }: Props) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
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
    <aside className="w-96 shrink-0 border-l border-border bg-panel flex flex-col min-h-0">
      <div className="h-10 shrink-0 border-b border-border flex items-center gap-2 px-3">
        <div className="size-5 rounded bg-gradient-primary grid place-items-center">
          <Sparkles className="size-3 text-primary-foreground" />
        </div>
        <span className="text-sm font-semibold">AI Assistant</span>
        <span className="ml-auto text-[10px] text-muted-foreground font-mono">Gemini 3 Flash</span>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-8 px-4">
            <Wand2 className="size-8 mx-auto text-primary mb-3" />
            <h3 className="font-semibold mb-1 text-sm">Edit with words.</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Tell the AI what you want and it will edit the video for you.
            </p>
            <div className="space-y-1.5">
              {SUGGESTIONS.map((s) => (
                <button key={s}
                  onClick={() => send(s)}
                  className="w-full text-left text-xs px-3 py-2 rounded-md border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={cn("flex flex-col gap-2", m.role === "user" ? "items-end" : "items-start")}>
            <div className={cn(
              "max-w-[90%] rounded-lg px-3 py-2 text-sm",
              m.role === "user" ? "bg-primary text-primary-foreground" : "bg-panel-elevated border border-border"
            )}>
              {m.role === "assistant" ? (
                <div className="prose prose-sm prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1">
                  <ReactMarkdown>{m.content || (streaming ? "..." : "")}</ReactMarkdown>
                </div>
              ) : (
                <div className="whitespace-pre-wrap">{m.content}</div>
              )}
            </div>
            {m.actions && m.actions.length > 0 && (
              <div className="space-y-1 w-full">
                {m.actions.map((a, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs px-2.5 py-1.5 bg-success/10 border border-success/30 rounded text-success">
                    <CheckCircle2 className="size-3" />
                    <span className="font-medium">{a.name.replace(/_/g, " ")}</span>
                    <span className="text-muted-foreground truncate">{JSON.stringify(a.args).slice(0, 60)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); send(input); }}
        className="p-3 border-t border-border space-y-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
          placeholder="Tell the AI what to edit…"
          className="min-h-[60px] resize-none bg-background border-border text-sm"
          disabled={streaming}
        />
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">Enter to send · Shift+Enter newline</span>
          <Button type="submit" size="sm" disabled={!input.trim() || streaming} className="bg-gradient-primary hover:opacity-90 h-8">
            {streaming ? <Loader2 className="size-3 animate-spin" /> : <Send className="size-3" />}
            Send
          </Button>
        </div>
      </form>
    </aside>
  );
};

export default AiChat;
