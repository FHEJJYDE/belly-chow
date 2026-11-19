-- ==============================================================================
-- 📍 BELLY-CHOW: CAMPUS LOCATION & PICKUP INTELLIGENCE UPGRADE (NO MOCK DATA)
-- ==============================================================================
-- Run this standalone script in your Supabase SQL Editor to upgrade
-- campus_locations, delivery_zones management, student-contributed slang aliases,
-- profiles saved places, orders micro-dropoff fields, and 10k-user indexes.
-- ==============================================================================

-- 1. Unify & Extend campus_locations schema (No hardcoded mock locations)
CREATE TABLE IF NOT EXISTS public.campus_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL DEFAULT 'Hostel',
  description TEXT DEFAULT '',
  short_code TEXT DEFAULT NULL,
  aliases TEXT[] DEFAULT '{}',
  zone_name VARCHAR(100) DEFAULT NULL,
  delivery_fee NUMERIC NOT NULL DEFAULT 500,
  estimated_delivery_mins INTEGER DEFAULT 15,
  dropoff_points TEXT[] DEFAULT ARRAY['Main Gate / Porter''s Lodge', 'Main Entrance'],
  is_popular BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  lat NUMERIC DEFAULT NULL,
  lng NUMERIC DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.campus_locations ADD COLUMN IF NOT EXISTS short_code TEXT DEFAULT NULL;
ALTER TABLE public.campus_locations ADD COLUMN IF NOT EXISTS aliases TEXT[] DEFAULT '{}';
ALTER TABLE public.campus_locations ADD COLUMN IF NOT EXISTS zone_name VARCHAR(100) DEFAULT NULL;
ALTER TABLE public.campus_locations ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC NOT NULL DEFAULT 500;
ALTER TABLE public.campus_locations ADD COLUMN IF NOT EXISTS estimated_delivery_mins INTEGER DEFAULT 15;
ALTER TABLE public.campus_locations ADD COLUMN IF NOT EXISTS dropoff_points TEXT[] DEFAULT ARRAY['Main Gate / Porter''s Lodge', 'Main Entrance'];
ALTER TABLE public.campus_locations ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;
ALTER TABLE public.campus_locations ADD COLUMN IF NOT EXISTS lat NUMERIC DEFAULT NULL;
ALTER TABLE public.campus_locations ADD COLUMN IF NOT EXISTS lng NUMERIC DEFAULT NULL;

-- Ensure unique constraint on name
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'campus_locations_name_key'
  ) THEN
    DELETE FROM public.campus_locations a
    USING public.campus_locations b
    WHERE a.id > b.id AND a.name = b.name;

    ALTER TABLE public.campus_locations ADD CONSTRAINT campus_locations_name_key UNIQUE (name);
  END IF;
END $$;

-- 2. Add Saved Places (My Hostel, My Dept, Study Spot) to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS saved_locations JSONB DEFAULT '[]'::jsonb;

-- 3. Add Micro-Dropoff & Delivery Instructions to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS dropoff_point TEXT DEFAULT NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS room_number TEXT DEFAULT NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_instruction TEXT DEFAULT NULL;

-- 4. RPC: Allow authenticated students to contribute a slang / nickname to any campus location
-- Safely validates length, prevents duplicates, and caps aliases per location.
CREATE OR REPLACE FUNCTION public.add_location_slang(
  p_location_id UUID,
  p_slang TEXT
)
RETURNS TEXT[] AS $$
DECLARE
  v_clean TEXT;
  v_existing TEXT[];
  v_updated TEXT[];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be logged in to add a campus slang or nickname';
  END IF;

  v_clean := TRIM(REGEXP_REPLACE(p_slang, '\s+', ' ', 'g'));

  IF LENGTH(v_clean) < 2 OR LENGTH(v_clean) > 30 THEN
    RAISE EXCEPTION 'Campus slang must be between 2 and 30 characters';
  END IF;

  SELECT COALESCE(aliases, '{}') INTO v_existing
  FROM public.campus_locations
  WHERE id = p_location_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Campus location not found';
  END IF;

  -- Check if slang already exists (case-insensitive)
  IF EXISTS (
    SELECT 1 FROM unnest(v_existing) AS elem
    WHERE LOWER(elem) = LOWER(v_clean)
  ) THEN
    RETURN v_existing;
  END IF;

  IF COALESCE(array_length(v_existing, 1), 0) >= 25 THEN
    RAISE EXCEPTION 'Maximum number of slang tags reached for this location';
  END IF;

  UPDATE public.campus_locations
  SET aliases = array_append(COALESCE(aliases, '{}'), v_clean),
      updated_at = NOW()
  WHERE id = p_location_id
  RETURNING aliases INTO v_updated;

  RETURN v_updated;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. High-Concurrency Indexes for 10,000+ Campus Users
CREATE INDEX IF NOT EXISTS idx_campus_locations_active_popular
  ON public.campus_locations (is_active, is_popular DESC, display_order ASC);

CREATE INDEX IF NOT EXISTS idx_campus_locations_category
  ON public.campus_locations (category) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_orders_active_rider_tracking
  ON public.orders (rider_id, status)
  WHERE status IN ('accepted', 'preparing', 'ready', 'picked_up', 'delivering', 'arrived');

CREATE INDEX IF NOT EXISTS idx_orders_active_student_tracking
  ON public.orders (student_id, status)
  WHERE status IN ('pending', 'accepted', 'preparing', 'ready', 'picked_up', 'delivering', 'arrived');
