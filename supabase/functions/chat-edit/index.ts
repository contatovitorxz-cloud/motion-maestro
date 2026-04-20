import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const tools = [
  {
    type: "function",
    function: {
      name: "add_text_overlay",
      description: "Add a text overlay on top of the video at a given time.",
      parameters: {
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
  },
  {
    type: "function",
    function: {
      name: "add_lower_third",
      description: "Add an animated lower-third with name/title.",
      parameters: {
        type: "object",
        properties: {
          text: { type: "string" },
          start: { type: "number" },
          duration: { type: "number" },
        },
        required: ["text"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_captions",
      description: "Add animated captions/subtitles for the entire video.",
      parameters: {
        type: "object",
        properties: { style: { type: "string", enum: ["kinetic", "minimal", "highlight"] } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cut_silence",
      description: "Detect and cut silent parts of the video.",
      parameters: { type: "object", properties: { threshold_db: { type: "number" } } },
    },
  },
  {
    type: "function",
    function: {
      name: "add_transition",
      description: "Add a transition between two cuts.",
      parameters: {
        type: "object",
        properties: {
          at: { type: "number" },
          style: { type: "string", enum: ["fade", "slide", "wipe", "glitch", "zoom"] },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_motion_scene",
      description: "Generate a brand-new motion graphics scene from a description (Remotion-style).",
      parameters: {
        type: "object",
        properties: {
          description: { type: "string" },
          start: { type: "number" },
          duration: { type: "number" },
        },
        required: ["description"],
      },
    },
  },
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, context } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `You are Motiona, an AI video editor that operates a CapCut-style timeline.
You help users edit their video by calling tools that mutate the timeline (add text, lower-thirds, captions, transitions, generate motion scenes, cut silences).

Current editor context:
- Assets: ${JSON.stringify(context?.assets || [])}
- Existing timeline clips: ${JSON.stringify(context?.clips || [])}
- Playhead is at: ${context?.currentTime ?? 0}s

When the user asks for something, briefly explain (1-2 sentences) what you're going to do, then CALL the appropriate tool(s). You may call multiple tools in one turn.
If a request is ambiguous, ask one short clarifying question. Otherwise, act.
Be friendly, concise, and confident — like a senior motion designer.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        tools,
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
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
