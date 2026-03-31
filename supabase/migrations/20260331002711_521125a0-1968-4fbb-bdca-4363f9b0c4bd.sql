
-- Create drinks table (admin-managed global drink catalog)
CREATE TABLE public.drinks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  image_url text DEFAULT '',
  is_available boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.drinks ENABLE ROW LEVEL SECURITY;

-- Anyone can view available drinks
CREATE POLICY "Anyone can view available drinks" ON public.drinks
  FOR SELECT TO public
  USING (is_available = true OR has_role(auth.uid(), 'admin'::app_role));

-- Admins can manage drinks
CREATE POLICY "Admins can manage drinks" ON public.drinks
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Add drink_items column to orders to store selected drinks as JSONB
ALTER TABLE public.orders ADD COLUMN drink_items jsonb DEFAULT '[]'::jsonb;
-- Add custom_drink_request for "don't like these" form
ALTER TABLE public.orders ADD COLUMN custom_drink_request jsonb DEFAULT NULL;
