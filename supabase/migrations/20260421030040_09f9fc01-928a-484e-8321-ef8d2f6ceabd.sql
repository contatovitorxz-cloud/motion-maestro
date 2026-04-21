CREATE TABLE public.render_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  scene JSONB NOT NULL,
  narration_asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL,
  pinned_asset_ids UUID[] NOT NULL DEFAULT '{}',
  output_path TEXT,
  output_url TEXT,
  error TEXT,
  progress NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_render_jobs_project ON public.render_jobs(project_id);
CREATE INDEX idx_render_jobs_user ON public.render_jobs(user_id);
CREATE INDEX idx_render_jobs_status ON public.render_jobs(status);

ALTER TABLE public.render_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "render_jobs_select_own"
  ON public.render_jobs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "render_jobs_insert_own"
  ON public.render_jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "render_jobs_update_own"
  ON public.render_jobs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "render_jobs_delete_own"
  ON public.render_jobs FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_render_jobs_updated_at
  BEFORE UPDATE ON public.render_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.render_jobs REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.render_jobs;