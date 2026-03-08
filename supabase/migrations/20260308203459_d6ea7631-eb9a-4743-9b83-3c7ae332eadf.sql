-- Update default delivery_fee to match actual service fee (platform 500 + rider 500)
ALTER TABLE public.orders ALTER COLUMN delivery_fee SET DEFAULT 1000;