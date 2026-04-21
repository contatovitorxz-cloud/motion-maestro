import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  text: z.string().min(1).max(4000),
  voiceId: z.string().min(1).max(100),
  projectId: z.string().uuid(),
});

// Estimate MP3 duration from byte length given the bitrate (mp3_44100_128 = 128kbps)
function estimateMp3DurationSeconds(byteLength: number, kbps = 128): number {
  return (byteLength * 8) / (kbps * 1000);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

    if (!ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY not configured");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) throw new Error("Supabase env not configured");

    // Validate user via JWT
    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    // Validate input
    const body = await req.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { text, voiceId, projectId } = parsed.data;

    // Call ElevenLabs
    const ttsRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.3,
            use_speaker_boost: true,
          },
        }),
      },
    );

    if (!ttsRes.ok) {
      const errText = await ttsRes.text();
      console.error("ElevenLabs error", ttsRes.status, errText);
      return new Response(JSON.stringify({ error: `ElevenLabs ${ttsRes.status}: ${errText.slice(0, 200)}` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const audioBuffer = await ttsRes.arrayBuffer();
    const audioBytes = new Uint8Array(audioBuffer);
    const duration = Math.max(0.5, estimateMp3DurationSeconds(audioBytes.byteLength, 128));

    // Upload to Storage with service role to bypass RLS, but scoped under user's path
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const timestamp = Date.now();
    const path = `${userId}/${projectId}/narration-${timestamp}.mp3`;

    const { error: upErr } = await adminClient.storage
      .from("assets")
      .upload(path, audioBytes, { contentType: "audio/mpeg", upsert: false });

    if (upErr) {
      console.error("Upload error", upErr);
      return new Response(JSON.stringify({ error: upErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert asset (use admin client; RLS would also pass since user_id is set)
    const name = text.length > 60 ? text.slice(0, 57) + "..." : text;
    const { data: assetData, error: assetErr } = await adminClient
      .from("assets")
      .insert({
        project_id: projectId,
        user_id: userId,
        type: "audio",
        name: `🎙️ ${name}`,
        storage_path: path,
        metadata: { source: "elevenlabs", voiceId, duration, text },
      })
      .select()
      .single();

    if (assetErr) {
      console.error("Asset insert error", assetErr);
      return new Response(JSON.stringify({ error: assetErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Signed URL for immediate playback
    const { data: signed } = await adminClient.storage
      .from("assets")
      .createSignedUrl(path, 3600);

    return new Response(
      JSON.stringify({
        assetId: assetData.id,
        storagePath: path,
        duration,
        signedUrl: signed?.signedUrl ?? null,
        text,
        voiceId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("generate-narration error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
