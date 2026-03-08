
-- Favourites table for students to save vendors
CREATE TABLE public.favourites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, vendor_id)
);

ALTER TABLE public.favourites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own favourites" ON public.favourites
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can add favourites" ON public.favourites
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove favourites" ON public.favourites
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
