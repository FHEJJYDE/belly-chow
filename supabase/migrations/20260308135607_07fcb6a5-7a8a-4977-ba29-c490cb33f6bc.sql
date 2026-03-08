
-- Notifications table for persistent in-app notification history
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'order_update',
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- System can insert notifications (via trigger)
CREATE POLICY "System can insert notifications" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Auto-create notifications on order status change
CREATE OR REPLACE FUNCTION public.notify_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  student_msg text;
  vendor_uid uuid;
  rider_msg text;
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Notify student
  student_msg := CASE NEW.status
    WHEN 'accepted' THEN 'Your order has been accepted! ✅'
    WHEN 'preparing' THEN 'Your food is being prepared 🍳'
    WHEN 'ready' THEN 'Your order is ready for pickup! 📦'
    WHEN 'picked_up' THEN 'A rider has picked up your order 🏍️'
    WHEN 'delivering' THEN 'Your order is on its way! 🚀'
    WHEN 'delivered' THEN 'Your order has been delivered! 🎉'
    WHEN 'cancelled' THEN 'Your order was cancelled ❌'
    WHEN 'rejected' THEN 'Your order was rejected 😞'
    ELSE NULL
  END;

  IF student_msg IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, type, order_id)
    VALUES (NEW.student_id, 'Order #' || LEFT(NEW.id::text, 8), student_msg, 'order_update', NEW.id);
  END IF;

  -- Notify vendor on new/picked_up/delivered
  SELECT user_id INTO vendor_uid FROM public.vendors WHERE id = NEW.vendor_id;
  IF vendor_uid IS NOT NULL THEN
    IF NEW.status = 'picked_up' THEN
      INSERT INTO public.notifications (user_id, title, message, type, order_id)
      VALUES (vendor_uid, 'Order Picked Up', 'Order #' || LEFT(NEW.id::text, 8) || ' was picked up by a rider', 'order_update', NEW.id);
    ELSIF NEW.status = 'delivered' THEN
      INSERT INTO public.notifications (user_id, title, message, type, order_id)
      VALUES (vendor_uid, 'Order Delivered', 'Order #' || LEFT(NEW.id::text, 8) || ' has been delivered', 'order_update', NEW.id);
    END IF;
  END IF;

  -- Notify rider
  IF NEW.rider_id IS NOT NULL AND NEW.status = 'delivered' THEN
    INSERT INTO public.notifications (user_id, title, message, type, order_id)
    VALUES (NEW.rider_id, 'Delivery Complete', 'Order #' || LEFT(NEW.id::text, 8) || ' delivered successfully! 🎉', 'order_update', NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_order_status_change
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_order_status_change();

-- Also notify vendor on new order insert
CREATE OR REPLACE FUNCTION public.notify_new_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  vendor_uid uuid;
BEGIN
  SELECT user_id INTO vendor_uid FROM public.vendors WHERE id = NEW.vendor_id;
  IF vendor_uid IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, type, order_id)
    VALUES (vendor_uid, '🔔 New Order!', 'New order #' || LEFT(NEW.id::text, 8) || ' received — check your orders!', 'new_order', NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_order
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_order();
