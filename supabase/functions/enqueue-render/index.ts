import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const WORKER_URL = Deno.env.get("REMOTION_WORKER_URL");
    const WORKER_SECRET = Deno.env.get("WORKER_SHARED_SECRET");

    if (!WORKER_URL || !WORKER_SECRET) {
      return new Response(
        JSON.stringify({
          error:
            "Worker não configurado. Defina REMOTION_WORKER_URL e WORKER_SHARED_SECRET nos secrets.",
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate user
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Invalid auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const body = await req.json();
    const { projectId, scene, narrationAssetId, pinnedAssetIds = [] } = body || {};
    if (!projectId || !scene) {
      return new Response(JSON.stringify({ error: "projectId and scene required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Resolve narration signed URL
    let narrationUrl: string | null = null;
    if (narrationAssetId) {
      const { data: asset } = await admin
        .from("assets")
        .select("storage_path")
        .eq("id", narrationAssetId)
        .maybeSingle();
      if (asset?.storage_path) {
        const { data: signed } = await admin.storage
          .from("assets")
          .createSignedUrl(asset.storage_path, 3600);
        narrationUrl = signed?.signedUrl || null;
      }
    }

    // Resolve pinned image URLs (map id → url)
    const pinnedImageUrls: Record<string, string> = {};
    if (Array.isArray(pinnedAssetIds) && pinnedAssetIds.length) {
      const { data: pinned } = await admin
        .from("assets")
        .select("id, storage_path")
        .in("id", pinnedAssetIds);
      for (const a of pinned || []) {
        const { data: signed } = await admin.storage
          .from("assets")
          .createSignedUrl(a.storage_path, 3600);
        if (signed?.signedUrl) pinnedImageUrls[a.id] = signed.signedUrl;
      }
    }

    // Create job row
    const { data: job, error: jobErr } = await admin
      .from("render_jobs")
      .insert({
        project_id: projectId,
        user_id: userId,
        status: "queued",
        scene,
        narration_asset_id: narrationAssetId || null,
        pinned_asset_ids: pinnedAssetIds,
      })
      .select()
      .single();

    if (jobErr || !job) {
      return new Response(
        JSON.stringify({ error: jobErr?.message || "Failed to create job" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fire-and-forget POST to worker
    const outputPath = `${userId}/${projectId}/${job.id}.mp4`;
    const workerPayload = {
      jobId: job.id,
      projectId,
      userId,
      scene,
      narrationUrl,
      pinnedImageUrls,
      outputPath,
    };

    // Don't await — worker can take 30+s
    fetch(`${WORKER_URL.replace(/\/$/, "")}/render`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-worker-secret": WORKER_SECRET,
      },
      body: JSON.stringify(workerPayload),
    }).catch((e) => console.error("worker dispatch failed", e));

    return new Response(JSON.stringify({ jobId: job.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("enqueue-render error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
