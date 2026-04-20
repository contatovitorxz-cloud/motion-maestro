
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- replace overly broad public read on thumbnails (still public per-object via signed/public urls)
DROP POLICY IF EXISTS "thumbs_public_read" ON storage.objects;
CREATE POLICY "thumbs_owner_select" ON storage.objects FOR SELECT USING (
  bucket_id='thumbnails' AND auth.uid()::text = (storage.foldername(name))[1]
);
