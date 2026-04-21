ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS scene jsonb;
DROP TABLE IF EXISTS public.render_jobs CASCADE;
DROP TABLE IF EXISTS public.renders CASCADE;