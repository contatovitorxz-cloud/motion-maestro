import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Anthropic tool format uses input_schema instead of parameters
const tools = [
  {
    name: "add_text_overlay",
    description: "Add a text overlay on top of the video at a given time.",
    input_schema: {
      type: "object",
      properties: {
        text: { type: "string" },
        start: { type: "number", description: "start time in seconds" },
        duration: { type: "number" },
        style: { type: "string", enum: ["default", "bold", "minimal"] },
      },
      required: ["text"],
    },
  },
  {
    name: "add_lower_third",
    description: "Add an animated lower-third with name/title.",
    input_schema: {
      type: "object",
      properties: {
        text: { type: "string" },
        start: { type: "number" },
        duration: { type: "number" },
      },
      required: ["text"],
    },
  },
  {
    name: "add_captions",
    description: "Add animated captions/subtitles for the entire video.",
    input_schema: {
      type: "object",
      properties: { style: { type: "string", enum: ["kinetic", "minimal", "highlight"] } },
    },
  },
  {
    name: "cut_silence",
    description: "Detect and cut silent parts of the video.",
    input_schema: { type: "object", properties: { threshold_db: { type: "number" } } },
  },
  {
    name: "add_transition",
    description: "Add a transition between two cuts.",
    input_schema: {
      type: "object",
      properties: {
        at: { type: "number" },
        style: { type: "string", enum: ["fade", "slide", "wipe", "glitch", "zoom"] },
      },
    },
  },
  {
    name: "generate_motion_scene",
    description: "Generate a brand-new motion graphics scene from a description (Remotion-style).",
    input_schema: {
      type: "object",
      properties: {
        description: { type: "string" },
        start: { type: "number" },
        duration: { type: "number" },
      },
      required: ["description"],
    },
  },
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, context } = await req.json();
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

    const systemPrompt = `You are Motiona, an AI video editor that operates a CapCut-style timeline.
You help users edit their video by calling tools that mutate the timeline (add text, lower-thirds, captions, transitions, generate motion scenes, cut silences).

Current editor context:
- Assets: ${JSON.stringify(context?.assets || [])}
- Existing timeline clips: ${JSON.stringify(context?.clips || [])}
- Playhead is at: ${context?.currentTime ?? 0}s

When the user asks for something, briefly explain (1-2 sentences) what you're going to do, then CALL the appropriate tool(s). You may call multiple tools in one turn.
If a request is ambiguous, ask one short clarifying question. Otherwise, act.
Be friendly, concise, and confident — like a senior motion designer.`;

    // Anthropic expects messages WITHOUT system role (system is a top-level field)
    const anthropicMessages = (messages || [])
      .filter((m: any) => m.role === "user" || m.role === "assistant")
      .map((m: any) => ({ role: m.role, content: m.content }));

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 4096,
        system: systemPrompt,
        messages: anthropicMessages,
        tools,
        stream: true,
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("Anthropic error", response.status, t);
      if (response.status === 401) {
        return new Response(JSON.stringify({ error: "Invalid Anthropic API key" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 529) {
        return new Response(JSON.stringify({ error: "Anthropic overloaded — retry shortly" }), {
          status: 529, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Anthropic gateway error", detail: t }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat-edit error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
