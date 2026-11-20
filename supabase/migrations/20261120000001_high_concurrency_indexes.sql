-- ==============================================================================
-- High-Concurrency Composite Indexes for Peak Campus Traffic
-- ==============================================================================
-- Speeds up hot queries across Orders, Order Items, Menu Items, and Notifications
-- so thousands of concurrent students, vendors, and riders experience fast reads.

CREATE INDEX IF NOT EXISTS idx_orders_student_created
  ON public.orders (student_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_vendor_status_created
  ON public.orders (vendor_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_status_rider_created
  ON public.orders (status, rider_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_rider_status_created
  ON public.orders (rider_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created
  ON public.notifications (user_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id
  ON public.order_items (order_id);

CREATE INDEX IF NOT EXISTS idx_menu_items_vendor_available
  ON public.menu_items (vendor_id, is_available);
