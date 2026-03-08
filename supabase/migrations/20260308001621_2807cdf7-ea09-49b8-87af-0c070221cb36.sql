
-- Drop existing SELECT policy and recreate with rider access to ready orders
DROP POLICY IF EXISTS "Students can view own orders" ON public.orders;

CREATE POLICY "Users can view relevant orders"
ON public.orders FOR SELECT
TO authenticated
USING (
  (auth.uid() = student_id)
  OR (EXISTS (SELECT 1 FROM vendors WHERE vendors.id = orders.vendor_id AND vendors.user_id = auth.uid()))
  OR (auth.uid() = rider_id)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR (status = 'ready' AND rider_id IS NULL AND has_role(auth.uid(), 'rider'::app_role))
);
