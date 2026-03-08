-- Update messages RLS to include vendor as chat participant
DROP POLICY IF EXISTS "Order participants can view messages" ON public.messages;
CREATE POLICY "Order participants can view messages" ON public.messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = messages.order_id
      AND (
        orders.student_id = auth.uid()
        OR orders.rider_id = auth.uid()
        OR EXISTS (SELECT 1 FROM vendors WHERE vendors.id = orders.vendor_id AND vendors.user_id = auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "Order participants can send messages" ON public.messages;
CREATE POLICY "Order participants can send messages" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = messages.order_id
      AND (
        orders.student_id = auth.uid()
        OR orders.rider_id = auth.uid()
        OR EXISTS (SELECT 1 FROM vendors WHERE vendors.id = orders.vendor_id AND vendors.user_id = auth.uid())
      )
    )
  );

-- Add rider_settings table for profile/settings
CREATE TABLE IF NOT EXISTS public.rider_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  vehicle_type text NOT NULL DEFAULT 'motorcycle',
  plate_number text DEFAULT '',
  bank_name text DEFAULT '',
  account_number text DEFAULT '',
  account_name text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rider_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Riders can view own settings" ON public.rider_settings
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Riders can insert own settings" ON public.rider_settings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Riders can update own settings" ON public.rider_settings
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_rider_settings_updated_at
  BEFORE UPDATE ON public.rider_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();