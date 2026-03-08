
-- 1. Fixed fee model: add platform_fee and rider_fee to platform_settings
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS platform_fee numeric NOT NULL DEFAULT 500;
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS rider_fee numeric NOT NULL DEFAULT 500;

-- 2. Promo codes table
CREATE TABLE public.promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  discount_amount numeric NOT NULL DEFAULT 0,
  min_order numeric NOT NULL DEFAULT 0,
  max_uses integer NOT NULL DEFAULT 100,
  used_count integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active promo codes" ON public.promo_codes
  FOR SELECT TO authenticated USING (is_active = true);

CREATE POLICY "Admins can manage promo codes" ON public.promo_codes
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 3. Add discount fields to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount numeric NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS promo_code text DEFAULT NULL;

-- 4. Messages table for in-app chat
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Only the student and rider of the order can read/write messages
CREATE POLICY "Order participants can view messages" ON public.messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = messages.order_id
      AND (orders.student_id = auth.uid() OR orders.rider_id = auth.uid())
    )
  );

CREATE POLICY "Order participants can send messages" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = messages.order_id
      AND (orders.student_id = auth.uid() OR orders.rider_id = auth.uid())
    )
  );

-- Enable realtime on messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
