
-- Drop and recreate the update policy to allow riders to accept ready orders
DROP POLICY IF EXISTS "Authorized users can update orders" ON public.orders;

CREATE POLICY "Authorized users can update orders"
ON public.orders
FOR UPDATE
USING (
  (auth.uid() = student_id)
  OR (EXISTS (SELECT 1 FROM vendors WHERE vendors.id = orders.vendor_id AND vendors.user_id = auth.uid()))
  OR (auth.uid() = rider_id)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR (status = 'ready' AND rider_id IS NULL AND has_role(auth.uid(), 'rider'::app_role))
);
