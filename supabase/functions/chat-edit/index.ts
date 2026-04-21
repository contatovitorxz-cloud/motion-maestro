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
  {
    name: "generate_narration",
    description:
      "Generate AI voice narration with ElevenLabs and place it on the audio track. Use this when the user wants spoken audio, voiceover, or narration. If the user did not provide the script, write a short cinematic script yourself (1-3 sentences) and pass it as `text`. The user has selected a default voice in the UI — only pass `voice_id` if they explicitly named a different voice.",
    input_schema: {
      type: "object",
      properties: {
        text: { type: "string", description: "The script to narrate. Required." },
        voice_id: { type: "string", description: "Optional ElevenLabs voice id. If omitted, the user's selected voice is used." },
        start: { type: "number", description: "Start time in seconds on the audio track. Defaults to current playhead." },
      },
      required: ["text"],
    },
  },
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, context } = await req.json();
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

    const ctxBlock = `Current editor context:
- Assets: ${JSON.stringify(context?.assets || [])}
- Existing timeline clips: ${JSON.stringify(context?.clips || [])}
- Playhead is at: ${context?.currentTime ?? 0}s
- User's selected default voice: ${context?.selectedVoice || "Sarah (clear, conversational)"}`;

    const autoPrompt = `You are Motiona Auto-Director — an AI that turns ANY user message into a complete short video, with ZERO follow-up questions.

${ctxBlock}

CRITICAL RULES (Auto mode):
1. Treat EVERY user message as a complete creative brief, even if it's just 2 words like "iPhone 17 launch" or "motivational quote".
2. NEVER ask clarifying questions. NEVER ask for confirmation. Just produce.
3. For EVERY message you MUST call ALL THREE of these tools in the SAME turn (in parallel):
   a) \`generate_motion_scene\` — describe a cinematic visual scene matching the topic.
   b) \`generate_narration\` — YOU write a 2-4 sentence cinematic script in the SAME LANGUAGE as the user, then pass it as \`text\`. Do not pass \`voice_id\` (the UI handles voice).
   c) \`add_captions\` — style: "kinetic".
4. Use \`start: 0\` and \`duration: 8\` for the motion_scene by default — the frontend will auto-stretch it to match the narration length.
5. Reply format (markdown, concise, in the user's language):
   **🎬 Roteiro:** <the script you wrote>
   **🎨 Cena:** <one-line visual description>
   **✨ Pronto — confira a timeline.**

Be bold and cinematic. Do NOT explain process. Do NOT ask. Just deliver.`;

    const conversationalPrompt = `You are Motiona, an AI video editor that operates a CapCut-style timeline.
You help users edit their video by calling tools that mutate the timeline (add text, lower-thirds, captions, transitions, generate motion scenes, cut silences, generate narration with ElevenLabs).

${ctxBlock}

When the user asks for something, briefly explain (1-2 sentences) what you're going to do, then CALL the appropriate tool(s). You may call multiple tools in one turn.

NARRATION RULES:
- When the user asks for narration, voiceover, or spoken audio along with a motion scene, call BOTH \`generate_motion_scene\` AND \`generate_narration\` in the same turn.
- If the user did not provide the script text, WRITE a short cinematic script yourself (1-3 sentences), show it in your reply ("Roteiro: …"), then call \`generate_narration\` with that text.
- Do NOT ask for a voice — the user picks the voice in the UI. Only pass \`voice_id\` if the user explicitly names a voice in their message.
- Respond in the same language the user wrote in (Portuguese in/Portuguese out, English in/English out).

If a request is ambiguous, ask one short clarifying question. Otherwise, act.
Be friendly, concise, and confident — like a senior motion designer.`;

    const systemPrompt = context?.autoMode ? autoPrompt : conversationalPrompt;

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
