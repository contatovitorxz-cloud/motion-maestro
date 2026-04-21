import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { createClient } from "@supabase/supabase-js";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SHARED_SECRET = process.env.WORKER_SHARED_SECRET!;
const PORT = Number(process.env.PORT || 3000);

if (!SUPABASE_URL || !SERVICE_ROLE || !SHARED_SECRET) {
  console.error("Missing env: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / WORKER_SHARED_SECRET");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

const app = express();
app.use(express.json({ limit: "5mb" }));

app.get("/health", (_, res) => res.json({ ok: true }));

// Bundle once on boot — keep warm across requests
let bundleUrlPromise: Promise<string> | null = null;
function getBundle() {
  if (!bundleUrlPromise) {
    bundleUrlPromise = bundle({
      entryPoint: path.join(__dirname, "index.ts"),
      webpackOverride: (c) => c,
    });
  }
  return bundleUrlPromise;
}

interface RenderBody {
  jobId: string;
  projectId: string;
  userId: string;
  scene: any;
  narrationUrl: string | null;
  pinnedImageUrls: Record<string, string>;
  outputPath: string;
}

app.post("/render", async (req, res) => {
  if (req.headers["x-worker-secret"] !== SHARED_SECRET) {
    return res.status(401).json({ error: "Bad secret" });
  }
  const body = req.body as RenderBody;
  if (!body?.jobId || !body?.scene || !body?.outputPath) {
    return res.status(400).json({ error: "Missing fields" });
  }

  // Respond immediately — render in background
  res.json({ accepted: true, jobId: body.jobId });

  renderJob(body).catch(async (e) => {
    console.error("renderJob crash", e);
    await supabase
      .from("render_jobs")
      .update({ status: "error", error: String(e?.message || e) })
      .eq("id", body.jobId);
  });
});

async function renderJob(body: RenderBody) {
  const { jobId, scene, narrationUrl, pinnedImageUrls, outputPath } = body;
  console.log(`[${jobId}] starting`);

  await supabase.from("render_jobs").update({ status: "rendering", progress: 5 }).eq("id", jobId);

  const serveUrl = await getBundle();
  console.log(`[${jobId}] bundled`);

  const inputProps = { scene, narrationUrl, imageUrls: pinnedImageUrls };

  const composition = await selectComposition({
    serveUrl,
    id: "MotionScene",
    inputProps,
  });

  const tmp = mkdtempSync(path.join(tmpdir(), "render-"));
  const outFile = path.join(tmp, "out.mp4");

  try {
    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      outputLocation: outFile,
      inputProps,
      concurrency: 1,
      chromiumOptions: { gl: "swangle", enableMultiProcessOnLinux: false },
      onProgress: ({ progress }) => {
        const pct = Math.round(progress * 90) + 5;
        supabase.from("render_jobs").update({ progress: pct }).eq("id", jobId).then(() => {});
      },
    });

    console.log(`[${jobId}] rendered, uploading to ${outputPath}`);

    const fileBuf = readFileSync(outFile);
    const { error: upErr } = await supabase.storage
      .from("renders")
      .upload(outputPath, fileBuf, { contentType: "video/mp4", upsert: true });
    if (upErr) throw upErr;

    const { data: signed } = await supabase.storage
      .from("renders")
      .createSignedUrl(outputPath, 60 * 60 * 24 * 7); // 7 days

    await supabase
      .from("render_jobs")
      .update({
        status: "done",
        progress: 100,
        output_path: outputPath,
        output_url: signed?.signedUrl || null,
      })
      .eq("id", jobId);

    console.log(`[${jobId}] done`);
  } finally {
    try { rmSync(tmp, { recursive: true, force: true }); } catch { }
  }
}

app.listen(PORT, () => {
  console.log(`Motiona worker listening on :${PORT}`);
});
