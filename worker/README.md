# Motiona Remotion Worker

Headless Node service that renders `MotionScene` JSON into MP4 using Remotion, then uploads to Supabase Storage.

## Deploy on Render.com (recommended)

1. Push this `worker/` folder to a **new GitHub repo** (it must be standalone — Render doesn't support subfolder roots on free plan).
2. Go to https://render.com → **New → Web Service** → connect that repo.
3. Pick **Docker** runtime. Render auto-detects `Dockerfile`.
4. Plan: **Starter ($7/mo)** is enough for short videos. Free plan sleeps and will fail mid-render.
5. Add these **Environment Variables**:
   - `SUPABASE_URL` — same as in your Lovable project
   - `SUPABASE_SERVICE_ROLE_KEY` — service role key (NOT anon)
   - `WORKER_SHARED_SECRET` — paste the secret your AI gave you
6. Deploy. Copy the public URL (e.g. `https://motiona-worker.onrender.com`).
7. Back in Lovable, add two secrets in Cloud:
   - `REMOTION_WORKER_URL` = the URL from step 6
   - `WORKER_SHARED_SECRET` = same value as step 5

That's it — the `enqueue-render` edge function will start dispatching jobs.

## Local testing

```bash
cd worker
npm install
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... WORKER_SHARED_SECRET=test npm run dev
```

POST to `http://localhost:3000/render`:
```json
{
  "jobId": "...",
  "projectId": "...",
  "userId": "...",
  "scene": { ...MotionScene... },
  "narrationUrl": "https://...mp3",
  "pinnedImageUrls": { "<assetId>": "https://...png" },
  "outputPath": "user/project/job.mp4"
}
```

## How it renders pinned images

The frontend AI puts `assetId` references inside `scene.background.assetId` or `scene.layers[].assetId`. The edge function resolves these into signed URLs and passes them as `pinnedImageUrls` (id → url). The worker swaps them in at render time.
