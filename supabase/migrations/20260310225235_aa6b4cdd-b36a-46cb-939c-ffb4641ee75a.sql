ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS default_lat double precision,
  ADD COLUMN IF NOT EXISTS default_lng double precision,
  ADD COLUMN IF NOT EXISTS default_location_name text DEFAULT '';