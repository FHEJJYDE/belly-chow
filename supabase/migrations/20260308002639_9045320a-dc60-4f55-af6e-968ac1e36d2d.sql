
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS delivery_lat double precision,
ADD COLUMN IF NOT EXISTS delivery_lng double precision,
ADD COLUMN IF NOT EXISTS rider_lat double precision,
ADD COLUMN IF NOT EXISTS rider_lng double precision;
