-- ==============================================================================
-- 🚀 ADD FEATURED VENDOR PROMOTION COLUMNS TO VENDORS TABLE
-- ==============================================================================

ALTER TABLE public.vendors 
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS featured_tier TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS featured_until TIMESTAMP WITH TIME ZONE DEFAULT NULL;
