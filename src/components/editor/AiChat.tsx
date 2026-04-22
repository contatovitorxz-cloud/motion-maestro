import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Send, Sparkles, Loader2, CheckCircle2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import type { Asset, Clip } from "@/pages/Editor";
import { toast } from "sonner";
import { getVoice } from "./voices";

interface Props {
  projectId: string;
  userId: string;
  assets: Asset[];
  clips: Clip[];
  currentTime: number;
  onApplyAction: (action: { name: string; args: any }) => void | Promise<void>;
  selectedVoiceId: string;
  pinnedAssets?: Asset[];
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  actions?: { name: string; args: any }[];
}

const SUGGESTIONS = [
  "Cortar do 10 ao 15",
  "Legendar tudo",
  "Adicionar música",
  "Adicionar efeitos",
];

const INITIAL_MSG: Message = {
  id: "intro",
  role: "assistant",
  content:
    "Oi! Me diga o que quer fazer no vídeo. Experimente clicar em uma das sugestões abaixo.",
};

const AiChat = ({
  projectId, userId, assets, clips, currentTime,
  onApplyAction, selectedVoiceId, pinnedAssets = [],
}: Props) => {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MSG]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedVoice = getVoice(selectedVoiceId);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at");
      const persisted = (data || []).map((m: any) => ({
        id: m.id, role: m.role, content: m.content,
        actions: Array.isArray(m.applied_actions) ? m.applied_actions : [],
      })) as Message[];
      setMessages(persisted.length ? persisted : [INITIAL_MSG]);
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
      setMessages((p) => p.map((m) => m.id === assistantId ? { ...m, content: assistantText } : m));
    };
    const addAction = (action: { name: string; args: any }) => {
      actions.push(action);
      onApplyAction(action);
      setMessages((p) => p.map((m) => m.id === assistantId ? { ...m, actions: [...actions] } : m));
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
          messages: [...messages, userMsg].map((m) => ({ role: m.role, content: m.content })),
          context: {
            assets: assets.map((a) => ({ id: a.id, type: a.type, name: a.name })),
            clips: clips.map((c) => ({ track: c.track, start: c.start_time, end: c.end_time, effects: c.effects })),
            currentTime,
            selectedVoice: `${selectedVoice.name} (${selectedVoice.tone}) — id ${selectedVoice.id}`,
            autoMode: true,
            pinnedImages: pinnedAssets.map((a) => ({
              name: a.name, url: a.url, description: a.metadata?.pin_description ?? null,
            })),
          },
        }),
      });

      if (!resp.ok) {
        if (resp.status === 429) toast.error("Limite de uso — tente em alguns instantes");
        else if (resp.status === 402) toast.error("Adicione créditos de IA no workspace");
        else toast.error("Falha na requisição da IA");
        setStreaming(false);
        return;
      }
      if (!resp.body) throw new Error("No body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let done = false;
      const blocks: Record<number, { type: "text" | "tool_use"; name?: string; jsonBuf?: string }> = {};

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
          if (!json || json === "[DONE]") { if (json === "[DONE]") done = true; continue; }
          try {
            const evt = JSON.parse(json);
            if (evt.type === "content_block_start") {
              const idx = evt.index;
              const cb = evt.content_block;
              if (cb?.type === "text") blocks[idx] = { type: "text" };
              else if (cb?.type === "tool_use") blocks[idx] = { type: "tool_use", name: cb.name, jsonBuf: "" };
            } else if (evt.type === "content_block_delta") {
              const idx = evt.index;
              const block = blocks[idx];
              const delta = evt.delta;
              if (!block || !delta) continue;
              if (delta.type === "text_delta" && delta.text) upsertAssistant(delta.text);
              else if (delta.type === "input_json_delta" && typeof delta.partial_json === "string") {
                block.jsonBuf = (block.jsonBuf || "") + delta.partial_json;
              }
            } else if (evt.type === "content_block_stop") {
              const idx = evt.index;
              const block = blocks[idx];
              if (block?.type === "tool_use" && block.name) {
                let args: any = {};
                try { args = block.jsonBuf ? JSON.parse(block.jsonBuf) : {}; } catch {}
                await addAction({ name: block.name, args });
              }
              delete blocks[idx];
            } else if (evt.type === "message_stop") {
              done = true;
            } else if (evt.type === "error") {
              toast.error(evt.error?.message || "Erro no stream");
              done = true;
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      await supabase.from("chat_messages").insert({
        project_id: projectId, user_id: userId, role: "assistant",
        content: assistantText || "Pronto.",
        applied_actions: actions,
      });
    } catch (e: any) {
      toast.error(e.message || "Erro no stream");
    } finally {
      setStreaming(false);
    }
  };

  return (
    <aside
      className="shrink-0 flex flex-col min-h-0 border-r"
      style={{ width: 320, backgroundColor: "#0a0a0a", borderColor: "rgba(255,255,255,0.06)" }}
    >
      {/* Header */}
      <div className="h-12 flex items-center gap-2.5 px-4 border-b shrink-0" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <div className="relative">
          <div
            className="size-7 rounded-lg grid place-items-center"
            style={{ background: "linear-gradient(135deg,#7B2CBF,#FFB627)" }}
          >
            <Sparkles className="size-3.5 text-black" />
          </div>
          <span
            className="absolute -bottom-0.5 -right-0.5 size-2 rounded-full ring-2"
            style={{ backgroundColor: "#22c55e", boxShadow: "0 0 0 2px #0a0a0a" }}
          />
        </div>
        <div className="flex flex-col flex-1 min-w-0">
          <span className="text-sm font-semibold text-white">Assistente IA</span>
          <span className="text-[10px] text-white/50 flex items-center gap-1">
            <span className="size-1 rounded-full" style={{ backgroundColor: "#22c55e" }} /> online
          </span>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin px-3 py-3 space-y-3">
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn("flex flex-col gap-1.5 animate-fade-in", m.role === "user" ? "items-end" : "items-start")}
          >
            <div
              className="max-w-[85%] px-3 py-2 text-[12px] leading-relaxed rounded-2xl"
              style={
                m.role === "user"
                  ? { backgroundColor: "#FFB627", color: "#000", borderTopRightRadius: 4, fontWeight: 500 }
                  : { backgroundColor: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.9)", border: "1px solid rgba(255,255,255,0.06)", borderTopLeftRadius: 4 }
              }
            >
              {m.role === "assistant" ? (
                <div className="prose prose-sm prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1">
                  <ReactMarkdown>{m.content || (streaming ? "▍" : "")}</ReactMarkdown>
                </div>
              ) : (
                <div className="whitespace-pre-wrap">{m.content}</div>
              )}
            </div>
            {m.actions && m.actions.length > 0 && (
              <div className="space-y-1 w-full">
                {m.actions.map((a, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1.5 text-[10px] px-2 py-1 rounded text-white/70 animate-slide-in-left"
                    style={{ backgroundColor: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}
                  >
                    <CheckCircle2 className="size-3 shrink-0" style={{ color: "#22c55e" }} />
                    <span className="font-semibold capitalize">{a.name.replace(/_/g, " ")}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {streaming && (
          <div className="flex gap-1 px-3">
            <span className="size-1.5 rounded-full bg-white/40 animate-pulse" style={{ animationDelay: "0ms" }} />
            <span className="size-1.5 rounded-full bg-white/40 animate-pulse" style={{ animationDelay: "150ms" }} />
            <span className="size-1.5 rounded-full bg-white/40 animate-pulse" style={{ animationDelay: "300ms" }} />
          </div>
        )}
      </div>

      {/* Sugestões */}
      <div className="px-3 pb-2 pt-1 flex flex-wrap gap-1.5 shrink-0">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => send(s)}
            disabled={streaming}
            className="px-2.5 py-1.5 text-[11px] rounded-md text-white/80 hover:text-white disabled:opacity-40 transition-colors"
            style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className="p-3 border-t shrink-0"
        style={{ borderColor: "rgba(255,255,255,0.06)" }}
      >
        <div
          className="flex items-end gap-2 rounded-xl p-2"
          style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder="Escreva o que quer fazer..."
            rows={1}
            disabled={streaming}
            className="flex-1 bg-transparent text-[12px] text-white outline-none border-none resize-none px-1 py-1 placeholder:text-white/40 max-h-20"
            style={{ fontFamily: "inherit" }}
          />
          <button
            type="submit"
            disabled={!input.trim() || streaming}
            className="size-7 rounded-md grid place-items-center disabled:cursor-not-allowed transition-opacity"
            style={{
              backgroundColor: input.trim() && !streaming ? "#FFB627" : "rgba(255,255,255,0.08)",
              opacity: input.trim() && !streaming ? 1 : 0.5,
            }}
          >
            {streaming
              ? <Loader2 className="size-3 animate-spin" style={{ color: "rgba(255,255,255,0.6)" }} />
              : <Send className="size-3" style={{ color: input.trim() ? "#000" : "rgba(255,255,255,0.4)" }} />}
          </button>
        </div>
      </form>
    </aside>
  );
};

export default AiChat;
